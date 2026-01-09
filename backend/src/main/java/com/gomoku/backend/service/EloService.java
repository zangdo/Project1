package com.gomoku.backend.service;

import com.gomoku.backend.entity.User;
import org.springframework.stereotype.Service;

@Service
public class EloService {
    private static final int K_FACTOR = 32;

    public void updateElo(User winner, User loser, boolean isDraw) {
        double ratingA = winner.getElo();
        double ratingB = loser.getElo();

        // Tính xác suất thắng (Expected Score)
        double expectedA = 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
        double expectedB = 1.0 / (1.0 + Math.pow(10, (ratingA - ratingB) / 400.0));

        double actualA = isDraw ? 0.5 : 1.0;
        double actualB = isDraw ? 0.5 : 0.0;

        // Công thức Elo: NewRating = OldRating + K * (Actual - Expected)
        int newEloA = (int) (ratingA + K_FACTOR * (actualA - expectedA));
        int newEloB = (int) (ratingB + K_FACTOR * (actualB - expectedB));

        // Cập nhật chỉ số
        winner.setElo(newEloA);
        loser.setElo(newEloB);

        if (!isDraw) {
            winner.setWins(winner.getWins() + 1);
            loser.setLosses(loser.getLosses() + 1);
        } else {
            winner.setDraws(winner.getDraws() + 1);
            loser.setDraws(loser.getDraws() + 1);
        }
    }
}