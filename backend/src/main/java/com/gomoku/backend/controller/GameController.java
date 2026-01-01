package com.gomoku.backend.controller;

import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;
import com.gomoku.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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
}
