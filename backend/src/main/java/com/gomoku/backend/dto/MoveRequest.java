package com.gomoku.backend.dto;

import lombok.Data;

@Data
public class MoveRequest {
    private String roomId; // Mã phòng chơi
    private int x;         // Tọa độ dòng
    private int y;         // Tọa độ cột
    // Không cần gửi "player" vì Server sẽ tự biết ai gửi qua Token (làm sau)
    private String username;
}