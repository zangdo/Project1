package com.gomoku.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String username; // Có thể là email hoặc username tùy logic login

        // 1. Kiểm tra header có token không (Bắt đầu bằng Bearer)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Lấy token ra (bỏ chữ "Bearer " đi)
        jwt = authHeader.substring(7);
        
        // 3. Trích xuất username từ token
        username = jwtService.extractUsername(jwt);

        // 4. Nếu có username và chưa được xác thực
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            // Lấy thông tin user từ DB
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

            // Kiểm tra token có hợp lệ với user này không
            if (jwtService.isTokenValid(jwt, userDetails)) {
                // Tạo đối tượng xác thực
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                
                // Đóng dấu vào hệ thống: "Thằng này đã đăng nhập ngon lành!"
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        
        // Cho đi tiếp
        filterChain.doFilter(request, response);
    }
}