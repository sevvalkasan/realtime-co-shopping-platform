package com.sef.coshop.backend.model;

import lombok.*;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String phone;

    private String password;

    @Builder.Default
    private boolean verified = false;

    private String verificationCode;

    private LocalDateTime verificationExpiresAt;

    private String resetCode;

    private LocalDateTime resetCodeExpiresAt;

    @Builder.Default
    private String role = "USER";
}
