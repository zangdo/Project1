package com.gomoku.backend.controller;

import com.gomoku.backend.dto.*;
import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;
import com.gomoku.backend.repository.UserRepository;
import com.gomoku.backend.service.EloService;
import com.gomoku.backend.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.util.concurrent.ScheduledFuture;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;

@Controller
public class GameSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EloService eloService;
    @Autowired
    private GameService gameService;
    @Autowired
    private ThreadPoolTaskScheduler taskScheduler;

    // Lưu trữ phòng chơi trong RAM (Key: roomId, Value: Room)
    public static final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> timeoutTasks = new ConcurrentHashMap<>();
    // --- 1. XỬ LÝ READY ---
    @MessageMapping("/game/ready")
    public void handleReady(@Payload Map<String, String> payload) {
        String roomId = payload.get("roomId");
         // Chỉ lấy ra, không tự tiện tạo mới
        Room room = rooms.get(roomId);
        
        // Nếu không tìm thấy phòng -> Cút (Return luôn)
        if (room == null) return; 
        String username = payload.get("username");
        boolean isReady = Boolean.parseBoolean(payload.get("isReady"));

        // Gán người chơi vào phòng nếu chưa có (Logic đơn giản hóa)
        if (room.getPlayer1() == null) room.setPlayer1(username);
        else if (room.getPlayer2() == null && !username.equals(room.getPlayer1())) room.setPlayer2(username);

        // Cập nhật trạng thái Ready
        if (username.equals(room.getPlayer1())) room.setP1Ready(isReady);
        else if (username.equals(room.getPlayer2())) room.setP2Ready(isReady);

        // Báo cho cả phòng biết ông này đã Ready chưa (để đèn sáng/tối)
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/ready", 
            Map.of("username", username, "isReady", isReady));
        System.out.println("User bấm Ready: [" + username + "]");
        System.out.println("Player 1 trong phòng: [" + room.getPlayer1() + "]");
        System.out.println("Player 2 trong phòng: [" + room.getPlayer2() + "]");

        // Kiểm tra nếu cả 2 đều Ready -> BẮT ĐẦU GAME
        if (room.isP1Ready() && room.isP2Ready()) {
            // Gửi tin Start Game: P1 đi trước (X), P2 đi sau (O)
            room.setLastMoveTimestamp(System.currentTimeMillis()); // Bắt đầu tính giờ ngay lập tức!
            scheduleTimeout(roomId, room.getPlayer1(), room.getP1TimeLeft());
            room.setCurrentTurn(room.getPlayer1());
            room.setGameState("PLAYING");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/start", 
                Map.of("p1", room.getPlayer1(), "p2", room.getPlayer2()));
        }
    }

    @MessageMapping("/game/move")
    public void handleMove(@Payload MoveRequest request) {
        Room room = rooms.get(request.getRoomId());
        if (room == null) return;
        String currentUser = request.getUsername();
        String opponent = currentUser.equals(room.getPlayer1()) ? room.getPlayer2() : room.getPlayer1();
        String winner = null;

        if (request.getX() == -1 && request.getY() == -1) {
            winner = opponent; // Mình đầu hàng thì đối thủ thắng
        } else {
            int symbol = request.getUsername().equals(room.getPlayer1()) ? 1 : 2;
            
            // 2. Cập nhật bàn cờ
            // Kiểm tra xem ô đó có trống không đã (chống hack đè)
            if (room.getBoard()[request.getX()][request.getY()] != 0) return;
            
            room.getBoard()[request.getX()][request.getY()] = symbol;

            // 3. Tính thời gian (Trừ giờ)
            long now = System.currentTimeMillis();
            if (room.getLastMoveTimestamp() > 0) {
                long duration = now - room.getLastMoveTimestamp();
                if (symbol == 1) { // P1 vừa đánh -> Tức là P1 vừa nghĩ xong -> Trừ giờ P1
                    room.setP1TimeLeft(room.getP1TimeLeft() - duration);
                } else {
                    room.setP2TimeLeft(room.getP2TimeLeft() - duration);
                }
            }
            room.setLastMoveTimestamp(now);

            String nextPlayer = symbol == 1 ? room.getPlayer2() : room.getPlayer1();
            room.setCurrentTurn(nextPlayer);
            long nextTimeLeft = symbol == 1 ? room.getP2TimeLeft() : room.getP1TimeLeft();

            if (gameService.checkWin(room.getBoard(), request.getX(), request.getY(), symbol)) {
                winner = currentUser;
                ScheduledFuture<?> task = timeoutTasks.get(request.getRoomId());
                if (task != null) task.cancel(false);
            }
            else if (gameService.isBoardFull(room.getBoard())) {
                // Hòa cờ
                winner = "DRAW";
                ScheduledFuture<?> task = timeoutTasks.get(request.getRoomId());
                if (task != null) task.cancel(false);
            }
            else {
                // Đặt lại hẹn giờ cho người tiếp theo
                scheduleTimeout(request.getRoomId(), nextPlayer, nextTimeLeft);
            }
            
        }
        GameState state = GameState.builder()
                .playername(currentUser)
                .board(room.getBoard())
                .p1TimeLeft(room.getP1TimeLeft())
                .p2TimeLeft(room.getP2TimeLeft())
                .winner(winner) // Gửi kèm người thắng (nếu có)
                .build();

        messagingTemplate.convertAndSend("/topic/room/" + request.getRoomId() + "/move", state);

        // --- XỬ LÝ HẬU KỲ (Tính Elo, Dọn phòng) ---
        if (winner != null) {
            handleEndGame(request.getRoomId(), winner, winner.equals(currentUser) ? opponent : currentUser, false);
        }
    }
    // --- HÀM KẾT THÚC GAME & TÍNH ELO ---
    private void handleEndGame(String roomId, String winnerName, String loserName, boolean isDraw) {
        User winner = userRepository.findByUsername(winnerName).orElseThrow();
        User loser = userRepository.findByUsername(loserName).orElseThrow();

        // Tính Elo
        eloService.updateElo(winner, loser, isDraw);
        
        // Reset trạng thái về IDLE
        winner.setStatus(UserStatus.IDLE);
        loser.setStatus(UserStatus.IDLE);
        
        userRepository.save(winner);
        userRepository.save(loser);
        rooms.remove(roomId);
    }
    private void scheduleTimeout(String roomId, String loserName, long timeLeft) {
        // 1. Hủy bom cũ (nếu có)
        ScheduledFuture<?> oldTask = timeoutTasks.get(roomId);
        if (oldTask != null) {
            oldTask.cancel(false);
        }

        // 2. Đặt bom mới
        ScheduledFuture<?> newTask = taskScheduler.schedule(() -> {
            System.out.println("HẾT GIỜ! Phòng: " + roomId + " - Người thua: " + loserName);
            
            // Xác định người thắng
            Room room = rooms.get(roomId);
            if (room != null) {
                String winnerName = loserName.equals(room.getPlayer1()) ? room.getPlayer2() : room.getPlayer1();
                long p1Time = room.getP1TimeLeft();
                long p2Time = room.getP2TimeLeft();

                // Ai thua thì cho thời gian về 0 luôn cho chừa
                if (loserName.equals(room.getPlayer1())) {
                    p1Time = 0;
                } else {
                    p2Time = 0;
                }
                // Gửi tin báo về Client FULL OPTION
                GameState state = GameState.builder()
                        .playername(loserName) // Người vừa đánh (thực ra là người hết giờ)
                        .board(room.getBoard()) // Gửi lại bàn cờ hiện tại
                        .p1TimeLeft(p1Time)
                        .p2TimeLeft(p2Time)
                        .winner(winnerName) // QUAN TRỌNG NHẤT
                        .build();
                        
                messagingTemplate.convertAndSend("/topic/room/" + roomId + "/move", state);
                
                // Xử lý hậu kỳ
                handleEndGame(roomId, winnerName, loserName, false);
            }
            
            timeoutTasks.remove(roomId); 
            
        }, Instant.now().plusMillis(timeLeft + 1000)); 

        timeoutTasks.put(roomId, newTask);
    }
}