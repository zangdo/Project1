package com.gomoku.backend.service;

import com.gomoku.backend.dto.RegisterRequest;
import com.gomoku.backend.entity.User;
import com.gomoku.backend.entity.UserStatus;
import com.gomoku.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import com.gomoku.backend.dto.LoginRequest;
import com.gomoku.backend.dto.AuthResponse;
import com.gomoku.backend.security.JwtService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtService jwtService;

    // Lưu OTP tạm trong RAM (Key: Email, Value: OtpInfo)
    // Sau này xịn hơn thì lưu Redis, giờ làm game nhỏ dùng Map cho nhanh
    private Map<String, OtpInfo> otpStorage = new HashMap<>();

    // Class con để lưu thông tin OTP
    private static class OtpInfo {
        String otp;
        LocalDateTime expiryTime;

        public OtpInfo(String otp, LocalDateTime expiryTime) {
            this.otp = otp;
            this.expiryTime = expiryTime;
        }
    }

    // 1. Đăng ký tài khoản
    public String register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã tồn tại!");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username đã tồn tại!");
        }

        // Tạo user nhưng chưa kích hoạt (enabled = false)
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role("USER")
                .enabled(false) // Chưa xác thực OTP
                .elo(1000) // Điểm khởi đầu
                .status(UserStatus.IDLE)
                .avatar("https://api.dicebear.com/9.x/adventurer/svg?seed=" + request.getUsername())
                .build();

        userRepository.save(user);

        // Gửi OTP
        sendOtp(request.getEmail());
        
        return "Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.";
    }

    // 2. Gửi OTP
    public void sendOtp(String email) {
        // Tạo mã 6 số ngẫu nhiên
        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        
        // Lưu vào Map, hết hạn sau 2 phút
        otpStorage.put(email, new OtpInfo(otp, LocalDateTime.now().plusMinutes(2)));

        // Gửi email
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Mã xác thực Gomoku Game");
        message.setText("Mã OTP của bạn là: " + otp + "\nMã này có hiệu lực trong 2 phút.");
        
        mailSender.send(message);
    }

    // 3. Xác thực OTP
    public String verifyOtp(String email, String otpCode) {
        OtpInfo info = otpStorage.get(email);

        if (info == null) {
            throw new RuntimeException("Không tìm thấy mã OTP hoặc email chưa đăng ký!");
        }

        if (LocalDateTime.now().isAfter(info.expiryTime)) {
            otpStorage.remove(email); // Xóa OTP hết hạn
            throw new RuntimeException("Mã OTP đã hết hạn!");
        }

        if (!info.otp.equals(otpCode)) {
            throw new RuntimeException("Mã OTP không chính xác!");
        }

        // OTP đúng -> Kích hoạt tài khoản
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User không tồn tại!"));
        
        user.setEnabled(true);
        userRepository.save(user);
        
        // Xóa OTP sau khi dùng xong
        otpStorage.remove(email);

        return "Xác thực thành công! Bạn có thể đăng nhập ngay bây giờ.";
    }
    public AuthResponse login(LoginRequest request) {
        // 1. Xác thực user/pass (Spring Security tự làm)
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getEmail(),
                request.getPassword()
            )
        );

        // 2. Nếu pass đúng -> Lấy user ra
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow();

        user.setStatus(UserStatus.IDLE); 
        userRepository.save(user);

        // 3. Tạo token
        var jwtToken = jwtService.generateToken(user);

        // 4. Trả về
        return AuthResponse.builder()
                .token(jwtToken)
                .username(user.getUsername())
                .build();
    }
    public String forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email này chưa đăng ký tài khoản nào!"));

        // Gửi OTP (tái sử dụng hàm cũ)
        sendOtp(email);

        return "Đã gửi mã xác nhận đổi mật khẩu vào email của bạn.";
    }
    public String resetPassword(String email, String otpCode, String newPassword) {
        OtpInfo info = otpStorage.get(email);

        if (info == null) {
            throw new RuntimeException("Yêu cầu không hợp lệ hoặc đã hết hạn!");
        }
        
        if (LocalDateTime.now().isAfter(info.expiryTime)) {
            otpStorage.remove(email);
            throw new RuntimeException("Mã OTP đã hết hạn!");
        }

        if (!info.otp.equals(otpCode)) {
            throw new RuntimeException("Mã OTP không chính xác!");
        }

        // OTP chuẩn -> Tiến hành đổi pass
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User không tồn tại!")); // Chắc chắn tồn tại rồi nhưng cứ check
        
        // Mã hóa mật khẩu mới trước khi lưu
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Xóa OTP
        otpStorage.remove(email);

        return "Đổi mật khẩu thành công! Hãy đăng nhập lại.";
    }
}