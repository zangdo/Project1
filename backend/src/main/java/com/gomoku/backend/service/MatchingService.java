package com.gomoku.backend.service;

import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;
import com.gomoku.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.gomoku.backend.controller.GameSocketController;
import com.gomoku.backend.dto.Room; 

import java.util.HashMap;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.Map;

@Service
public class MatchingService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate; // Dùng để bắn tin WebSocket

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    // Chạy mỗi 3 giây một lần (3000ms)
    @Scheduled(fixedDelay = 3000)
    @Transactional // Để đảm bảo update DB an toàn
    public void findMatch() {
        // 1. Lấy tất cả những người đang tìm trận
        List<User> matchingUsers = userRepository.findByStatus(UserStatus.MATCHING);
        
        if (matchingUsers.size() < 2) return; // Không đủ 2 người thì nghỉ

        System.out.println("Đang quét tìm trận cho " + matchingUsers.size() + " người...");

        // Danh sách những người đã được ghép trong lượt này (để tránh ghép trùng)
        // Ta sẽ dùng cách đơn giản: Khi ghép xong thì đổi status luôn, nên query lần sau sẽ không thấy nữa.

        for (User player1 : matchingUsers) {
            // Kiểm tra lại xem player1 còn MATCHING không (vì có thể đã bị ghép với người trước đó trong vòng lặp này)
            // (Tuy nhiên vì ta load list ra RAM, nên cần check lại DB hoặc cẩn thận hơn. 
            // Ở đây demo logic đơn giản: Nếu status đã đổi thì bỏ qua)
            if (userRepository.findById(player1.getId()).get().getStatus() != UserStatus.MATCHING) continue;

            User player2 = findOpponent(player1, matchingUsers);

            if (player2 != null) {
                // TÌM THẤY ĐỐI THỦ! -> BẮT ĐẦU GHÉP
                startMatch(player1, player2);
            }
        }
    }

    private User findOpponent(User p1, List<User> pool) {
        Random rand = new Random();
        boolean findHigher = rand.nextBoolean(); // 50% Cao, 50% Thấp

        User bestMatch = null;

        // Chiến thuật 1: Tìm theo vận may (50/50)
        if (findHigher) {
            bestMatch = findBestMatch(p1, pool, true); // Tìm cao hơn
            if (bestMatch == null) bestMatch = findBestMatch(p1, pool, false); // Không có thì tìm thấp hơn
        } else {
            bestMatch = findBestMatch(p1, pool, false); // Tìm thấp hơn
            if (bestMatch == null) bestMatch = findBestMatch(p1, pool, true); // Không có thì tìm cao hơn
        }

        return bestMatch;
    }

    // Hàm tìm người gần Elo nhất trong list
    private User findBestMatch(User target, List<User> pool, boolean findHigher) {
        User candidate = null;
        int minEloDiff = Integer.MAX_VALUE;

        for (User u : pool) {
            if (u.getId().equals(target.getId())) continue; // Không tự ghép với chính mình
            // Check lại DB xem người này còn rảnh không (quan trọng)
            if (userRepository.findById(u.getId()).get().getStatus() != UserStatus.MATCHING) continue;

            int diff = u.getElo() - target.getElo();

            // Nếu tìm cao hơn: diff phải >= 0. Nếu tìm thấp hơn: diff phải <= 0
            if ((findHigher && diff >= 0) || (!findHigher && diff <= 0)) {
                if (Math.abs(diff) < minEloDiff) {
                    minEloDiff = Math.abs(diff);
                    candidate = u;
                }
            }
        }
        return candidate;
    }

    private void startMatch(User p1, User p2) {
        String roomId = UUID.randomUUID().toString();
        
        Room room = new Room();
        room.setRoomId(roomId);
        room.setPlayer1(p1.getRealUsername()); 
        room.setPlayer2(p2.getRealUsername());
        room.setReadyDeadline(System.currentTimeMillis() + 20000); // 12 giây
        GameSocketController.rooms.put(roomId, room);

        System.out.println("Đã ghép: " + p1.getRealUsername() + " vs " + p2.getRealUsername() + " tại phòng " + roomId);

        // 1. Cập nhật trạng thái sang MATCHED (hoặc IN_GAME luôn tùy logic)
        // Theo logic của ông: Chuyển sang MATCHED chờ bấm sẵn sàng
        p1.setStatus(UserStatus.MATCHED);
        p2.setStatus(UserStatus.MATCHED);
        
        userRepository.save(p1);
        userRepository.save(p2);

        // Bắn tin báo cho P1: Kèm thông tin của P2
        Map<String, Object> p1Info = new HashMap<>();
        p1Info.put("roomId", roomId);
        p1Info.put("opponent", p2.getRealUsername()); // Gửi tên đối thủ
        p1Info.put("opponentElo", p2.getElo());
        p1Info.put("opponentAvatar", p2.getAvatar());
        p1Info.put("readyDeadline", room.getReadyDeadline());
        messagingTemplate.convertAndSendToUser(p1.getUsername(), "/queue/match", p1Info);

        // Bắn tin báo cho P2: Kèm thông tin của P1
        Map<String, Object> p2Info = new HashMap<>();
        p2Info.put("roomId", roomId);
        p2Info.put("opponent", p1.getRealUsername());
        p2Info.put("opponentElo", p1.getElo());
        p2Info.put("opponentAvatar", p1.getAvatar());
        p2Info.put("readyDeadline", room.getReadyDeadline());
        messagingTemplate.convertAndSendToUser(p2.getUsername(), "/queue/match", p2Info);
        scheduler.schedule(() -> {
            // Lấy phòng ra xem tình hình thế nào
            Room r = GameSocketController.rooms.get(roomId);
            
            // Nếu phòng vẫn còn đó VÀ trạng thái vẫn là WAITING (chưa ai chơi)
            if (r != null && "WAITING".equals(r.getGameState())) {
                
                // Xóa sổ ngay lập tức!
                GameSocketController.rooms.remove(roomId);
                
                System.out.println("Đã dọn dẹp phòng treo: " + roomId);
                
                // (Optional) Có thể reset status user về IDLE nếu cần thiết
                // p1.setStatus(UserStatus.IDLE); ...
            }
        }, 15, TimeUnit.SECONDS); // 15 giây
            
            // Lưu ý: Để dùng convertAndSendToUser, phần WebSocketConfig cần config thêm chút xíu (làm ở bước sau)
    }
}