package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.AuthRequest;
import com.sef.coshop.backend.model.User;
import com.sef.coshop.backend.repository.UserRepository;
import com.sef.coshop.backend.security.JwtUtil;
import com.sef.coshop.backend.service.CodeDeliveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final CodeDeliveryService codeDeliveryService;

    private String normalizeEmail(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private String normalizePhone(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isEmailIdentifier(String identifier) {
        return identifier != null && identifier.contains("@");
    }

    private User findByIdentifier(String identifier) {
        String normalized = identifier == null ? "" : identifier.trim();
        if (normalized.isBlank()) {
            throw new RuntimeException("Doğrulama hedefi boş olamaz.");
        }

        if (normalized.contains("@")) {
            return userRepository.findByEmail(normalized.toLowerCase())
                    .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));
        }

        return userRepository.findByPhone(normalized)
                .or(() -> userRepository.findByUsername(normalized))
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));
    }

    private String generateVerificationCode() {
        int code = ThreadLocalRandom.current().nextInt(100000, 1000000);
        return String.valueOf(code);
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody AuthRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        String email = normalizeEmail(request.getEmail());
        String phone = normalizePhone(request.getPhone());
        String password = request.getPassword() == null ? "" : request.getPassword().trim();

        if (username.isBlank() || email.isBlank() || phone.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body("Hata: Kullanıcı adı, e-posta, telefon ve şifre zorunludur.");
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body("Hata: Bu kullanıcı adı zaten alınmış!");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body("Hata: Bu e-posta zaten kullanılıyor!");
        }
        if (userRepository.findByPhone(phone).isPresent()) {
            return ResponseEntity.badRequest().body("Hata: Bu telefon zaten kullanılıyor!");
        }

        User user = User.builder()
                .username(username)
                .email(email)
                .phone(phone)
                .password(passwordEncoder.encode(password))
                .verified(false)
                .role("USER")
                .build();

        userRepository.save(user);
        return ResponseEntity.ok("Kullanıcı kaydedildi. Giriş için e-posta veya telefon doğrulaması yapmalısınız.");
    }

    @PostMapping("/send-verification")
    public ResponseEntity<?> sendVerification(@RequestBody Map<String, String> payload) {
        String identifier = payload.get("identifier") == null ? "" : payload.get("identifier").trim();
        User user;
        try {
            user = findByIdentifier(identifier);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
        boolean emailChannel = isEmailIdentifier(identifier);
        String destination = emailChannel ? user.getEmail() : user.getPhone();

        String code = generateVerificationCode();
        if (emailChannel) {
            user.setVerificationCode(code);
            user.setVerificationExpiresAt(LocalDateTime.now().plusMinutes(10));
        }
        userRepository.save(user);

        try {
            codeDeliveryService.sendVerificationCode(destination, code);
            return ResponseEntity.ok(Map.of("message", "Doğrulama kodu gönderildi."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Kod gönderilemedi: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody Map<String, String> payload) {
        String identifier = payload.get("identifier") == null ? "" : payload.get("identifier").trim();
        String code = payload.get("code") == null ? "" : payload.get("code").trim();
        User user;
        try {
            user = findByIdentifier(identifier);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }

        if (user.isVerified()) {
            return ResponseEntity.ok(Map.of("message", "Hesap zaten doğrulanmış."));
        }

        if (isEmailIdentifier(identifier)) {
            if (user.getVerificationCode() == null || user.getVerificationExpiresAt() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Önce doğrulama kodu isteyin."));
            }
            if (LocalDateTime.now().isAfter(user.getVerificationExpiresAt())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Doğrulama kodunun süresi doldu."));
            }
            if (!user.getVerificationCode().equals(code)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Doğrulama kodu hatalı."));
            }
        } else {
            boolean approved;
            try {
                approved = codeDeliveryService.verifyPhoneCode(user.getPhone(), code);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Telefon kodu doğrulanamadı: " + e.getMessage()));
            }
            if (!approved) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Doğrulama kodu hatalı veya süresi doldu."));
            }
        }

        user.setVerified(true);
        user.setVerificationCode(null);
        user.setVerificationExpiresAt(null);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Hesap doğrulandı. Artık giriş yapabilirsiniz."));
    }

    @PostMapping("/send-reset-code")
    public ResponseEntity<?> sendResetCode(@RequestBody Map<String, String> payload) {
        String identifier = payload.get("identifier") == null ? "" : payload.get("identifier").trim();
        User user;
        try {
            user = findByIdentifier(identifier);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
        boolean emailChannel = isEmailIdentifier(identifier);
        String destination = emailChannel ? user.getEmail() : user.getPhone();

        String code = generateVerificationCode();
        if (emailChannel) {
            user.setResetCode(code);
            user.setResetCodeExpiresAt(LocalDateTime.now().plusMinutes(10));
        }
        userRepository.save(user);

        try {
            codeDeliveryService.sendResetCode(destination, code);
            return ResponseEntity.ok(Map.of("message", "Şifre sıfırlama kodu gönderildi."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Kod gönderilemedi: " + e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> payload) {
        String identifier = payload.get("identifier") == null ? "" : payload.get("identifier").trim();
        String code = payload.get("code") == null ? "" : payload.get("code").trim();
        String newPassword = payload.get("newPassword") == null ? "" : payload.get("newPassword").trim();

        if (newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Yeni şifre boş olamaz."));
        }

        User user;
        try {
            user = findByIdentifier(identifier);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }

        if (isEmailIdentifier(identifier)) {
            if (user.getResetCode() == null || user.getResetCodeExpiresAt() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Önce şifre sıfırlama kodu isteyin."));
            }
            if (LocalDateTime.now().isAfter(user.getResetCodeExpiresAt())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Şifre sıfırlama kodunun süresi doldu."));
            }
            if (!user.getResetCode().equals(code)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Şifre sıfırlama kodu hatalı."));
            }
        } else {
            boolean approved;
            try {
                approved = codeDeliveryService.verifyPhoneCode(user.getPhone(), code);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Telefon kodu doğrulanamadı: " + e.getMessage()));
            }
            if (!approved) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Şifre sıfırlama kodu hatalı veya süresi doldu."));
            }
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetCode(null);
        user.setResetCodeExpiresAt(null);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Şifre başarıyla güncellendi."));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        String loginInput = request.getUsername() == null ? "" : request.getUsername().trim();
        String password = request.getPassword() == null ? "" : request.getPassword().trim();

        User user = userRepository.findByUsernameOrEmail(loginInput, loginInput.toLowerCase())
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı!"));

        if (!user.isVerified()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Hesap doğrulanmamış. Lütfen e-posta veya telefon doğrulaması yapın."));
        }

        if (!passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Geçersiz kullanıcı adı veya şifre!"));
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return ResponseEntity.ok(Map.of("token", token));
    }
}
