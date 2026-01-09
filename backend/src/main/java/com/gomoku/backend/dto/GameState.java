package com.gomoku.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GameState {
    private String playername; // Ai vừa đánh (username)
    private int[][] board;  // Trạng thái bàn cờ hiện tại
    private long p1TimeLeft; // Thời gian còn lại của Player 1 (ms)
    private long p2TimeLeft; // Thời gian còn lại của Player 2 (
    private String winner;
    // Sau này có thể thêm: timeLeft, winner...
}