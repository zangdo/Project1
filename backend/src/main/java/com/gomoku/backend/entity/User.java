package com.gomoku.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
import com.gomoku.backend.entity.UserStatus;

@Entity
@Table(name = "users") // Đặt tên bảng là 'users' vì 'user' hay trùng từ khóa SQL
@Data // Lombok tự sinh Getter/Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private UserStatus status; // Thêm dòng này

    // Lưu role (ví dụ: "USER", "ADMIN")
    private String role;

    // Trạng thái tài khoản (true = đã xác thực OTP, false = chưa)
    private boolean enabled;
    
    // Ảnh đại diện (sau này làm, để null trước cũng được)
    private String avatar;
    
    // Điểm Elo xếp hạng cờ
    private int elo;


    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Trả về quyền (Role) của user
        return List.of(new SimpleGrantedAuthority("ROLE_" + this.role)); 
    }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return this.enabled; } // Dùng trường enabled của mình
}
