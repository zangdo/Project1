package com.gomoku.backend.repository;

import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import java.util.List;
public interface UserRepository extends JpaRepository<User, Long> {
    List<User> findAllByOrderByEloDesc(Pageable pageable);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    List<User> findByStatus(UserStatus status);
}