package com.gomoku.backend.service;
import org.springframework.stereotype.Service;

@Service    
public class GameService {
    public boolean checkWin(int[][] board, int x, int y, int symbol) {
        // Kiểm tra 4 hướng: Ngang, Dọc, Chéo chính, Chéo phụ
        return checkDirection(board, x, y, symbol, 1, 0) || // Ngang
               checkDirection(board, x, y, symbol, 0, 1) || // Dọc
               checkDirection(board, x, y, symbol, 1, 1) || // Chéo chính
               checkDirection(board, x, y, symbol, 1, -1);  // Chéo phụ
    }

    private boolean checkDirection(int[][] board, int x, int y, int symbol, int dx, int dy) {
        int count = 1; // Đếm quân vừa đánh là 1
        
        // Duyệt về 1 phía
        for (int i = 1; i < 5; i++) {
            int nx = x + dx * i;
            int ny = y + dy * i;
            if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[nx][ny] != symbol) break;
            count++;
        }
        
        // Duyệt về phía ngược lại
        for (int i = 1; i < 5; i++) {
            int nx = x - dx * i;
            int ny = y - dy * i;
            if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15 || board[nx][ny] != symbol) break;
            count++;
        }

        return count >= 5; // Đủ 5 con là thắng
    }
    public boolean isBoardFull(int[][] board) {
        for (int i = 0; i < 15; i++) {
            for (int j = 0; j < 15; j++) {
                if (board[i][j] == 0) return false; // Còn ô trống -> Chưa hòa
            }
        }
        return true;
    }
}
