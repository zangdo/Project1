package com.gomoku.backend.dto;

import lombok.Data;

@Data
public class Room {
    private String roomId;
    private String player1; // Username hoặc Email
    private String player2;
    private boolean p1Ready = false;
    private boolean p2Ready = false;
    private long p1TimeLeft = 600000; // 10 phút mặc định
    private long p2TimeLeft = 600000;
    private String gameState = "WAITING"; // WAITING, PLAYING, ENDED
    private String currentTurn; // Username của người đang đánh
    private long lastMoveTimestamp = 0;
    private long readyDeadline = 0;
    private int[][] board = new int[15][15];
}