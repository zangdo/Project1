package com.gomoku.backend.controller;

import com.gomoku.backend.dto.Room;
import com.gomoku.backend.dto.UserResponse;
import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;
import com.gomoku.backend.repository.UserRepository;

import java.util.HashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import com.gomoku.backend.controller.GameSocketController;
import java.util.List;

@RestController
@RequestMapping("/api/game")
public class GameController {

    @Autowired
    private UserRepository userRepository;

    // API đổi trạng thái (Khiêu chiến / Nghỉ ngơi)
    @PostMapping("/status")
    public ResponseEntity<?> setUserStatus(
            @RequestParam String status, 
            @AuthenticationPrincipal UserDetails userDetails // Lấy user từ token
    ) {
        String email = userDetails.getUsername();
        User user = userRepository.findByEmail(email).orElseThrow();

        try {
            // Chuyển string sang Enum (MATCHING hoặc IDLE)
            UserStatus newStatus = UserStatus.valueOf(status.toUpperCase());
            user.setStatus(newStatus);
            userRepository.save(user);
            return ResponseEntity.ok("Đã chuyển sang trạng thái: " + newStatus);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Trạng thái không hợp lệ!");
        }
    }
    @GetMapping("/user")
    public ResponseEntity<UserResponse> getUserInfo(
            @RequestParam(required = false) String username, // Tham số tùy chọn
            @AuthenticationPrincipal UserDetails userDetails // Người đang gọi API
    ) {
        User targetUser;
        boolean isMeOrAdmin = false;
        String myEmail = userDetails.getUsername();

        // 1. Xác định đối tượng cần lấy tin
        if (username == null || username.isEmpty()) {
            // Không truyền username -> Lấy chính mình
            targetUser = userRepository.findByEmail(myEmail).orElseThrow();
            isMeOrAdmin = true;
        } else {
            // Có truyền -> Tìm người đó
            targetUser = userRepository.findByUsername(username) // Nhớ viết hàm này trong Repo
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy đại hiệp này!"));
            
            // Check xem có phải chính mình hoặc Admin không
            if (targetUser.getEmail().equals(myEmail) || 
               userRepository.findByEmail(myEmail).get().getRole().equals("ADMIN")) {
                isMeOrAdmin = true;
            }
        }

        // 2. Trả về kết quả (Ẩn hiện email tùy quyền)
        return ResponseEntity.ok(UserResponse.builder()
        .username(targetUser.getRealUsername())
        .email(isMeOrAdmin ? targetUser.getEmail() : "Email bị ẩn")
        .elo(targetUser.getElo())
        // Nếu DB có avatar thì dùng, không có thì tự gen theo tên
        .avatar(targetUser.getAvatar() != null ? targetUser.getAvatar() : 
               "https://api.dicebear.com/7.x/avataaars/svg?seed=" + targetUser.getRealUsername())
        .wins(targetUser.getWins())
        .losses(targetUser.getLosses())
        .draws(targetUser.getDraws())
        .build());
    }
    // Trong GameController
    @GetMapping("/current")
    public ResponseEntity<?> getCurrentGame(@AuthenticationPrincipal UserDetails userDetails) {

        String myUsername = userRepository.findByEmail(userDetails.getUsername()).get().getRealUsername();
        Map<String, Object> response = new HashMap<>();
        
        // Duyệt qua tất cả các phòng trong RAM để tìm (Cách này hơi thủ công nhưng nhanh)
        // Sau này tối ưu bằng cách lưu roomId vào User trong DB
        for (Room room : GameSocketController.rooms.values()) {
            if (myUsername.equals(room.getPlayer1()) || myUsername.equals(room.getPlayer2())) {
                if ("WAITING".equals(room.getGameState()) && 
                    System.currentTimeMillis() > room.getReadyDeadline()) {
                    
                    // Phòng này đã hết hạn Ready -> Coi như rác -> Bỏ qua
                    // (Có thể tiện tay xóa luôn ở đây cũng được: GameSocketController.rooms.remove(room.getRoomId());)
                    continue; 
                }
                // Tìm thấy! Trả về thông tin để Frontend vẽ lại
                response.put("roomId", room.getRoomId());
                response.put("board", room.getBoard());
                response.put("gameState", room.getGameState()); // WAITING hoặc PLAYING
                
                // Xác định đối thủ là ai để trả về info
                String opponentName = myUsername.equals(room.getPlayer1()) ? room.getPlayer2() : room.getPlayer1();
                User opponent = userRepository.findByUsername(opponentName).orElseThrow();
                
                response.put("opponent", opponent.getRealUsername());
                response.put("opponentElo", opponent.getElo());
                response.put("opponentAvatar", opponent.getAvatar() != null ? opponent.getAvatar() : 
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=" + opponent.getRealUsername());
                response.put("currentTurn", room.getCurrentTurn());
                long p1Time = room.getP1TimeLeft();
                long p2Time = room.getP2TimeLeft();

                // NẾU GAME ĐANG CHẠY: Phải trừ đi thời gian người hiện tại đang ngồi nghĩ
                if ("PLAYING".equals(room.getGameState())) {
                    long thinkingTime = System.currentTimeMillis() - room.getLastMoveTimestamp();
                    if (room.getCurrentTurn().equals(room.getPlayer1())) {
                        p1Time = Math.max(0, p1Time - thinkingTime);
                    } else {
                        p2Time = Math.max(0, p2Time - thinkingTime);
                    }
                }

                response.put("p1TimeLeft", p1Time); // Trả về thời gian đã khấu trừ
                response.put("p2TimeLeft", p2Time);
                response.put("readyDeadline", room.getReadyDeadline()); 
                response.put("p1isReady", room.isP1Ready());
                response.put("p2isReady", room.isP2Ready());
                response.put("p1Username", room.getPlayer1());
                return ResponseEntity.ok(response);
            }
        }
        return ResponseEntity.noContent().build(); // Không có trận nào
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<UserResponse>> getLeaderboard() {
        // Lấy Top 10 cao thủ
        List<User> topUsers = userRepository.findAllByOrderByEloDesc(PageRequest.of(0, 10));
        
        List<UserResponse> response = topUsers.stream().map(u -> UserResponse.builder()
                .username(u.getRealUsername()) // Tên hiển thị
                // .email() -> Không trả về email để bảo mật
                .elo(u.getElo())
                .wins(u.getWins())
                .losses(u.getLosses())
                .draws(u.getDraws())
                .avatar(u.getAvatar() != null ? u.getAvatar() : 
                        "https://api.dicebear.com/9.x/adventurer/svg?seed=" + u.getRealUsername())
                .build()).toList();

        return ResponseEntity.ok(response);
    }
}
