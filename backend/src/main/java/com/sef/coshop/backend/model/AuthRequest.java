package com.sef.coshop.backend.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthRequest {
    private String username;
    private String email;
    private String phone;
    private String password;
}
