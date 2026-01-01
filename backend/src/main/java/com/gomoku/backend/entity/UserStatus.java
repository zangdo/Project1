package com.gomoku.backend.entity;

public enum UserStatus {
    IDLE,       // Rảnh
    MATCHING,   // Đang xoay vòng tìm
    MATCHED,    // Đã tìm thấy, chờ bấm Sẵn sàng (10s)
    IN_GAME     // Đang đánh
}