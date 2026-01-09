package com.gomoku.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponse {
    private String username;
    private String email;
    private int elo;
    private String avatar;
    private int wins;
    private int losses;
    private int draws;
    // Sau này thêm avatarUrl...
}