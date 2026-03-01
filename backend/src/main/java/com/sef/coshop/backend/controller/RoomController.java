package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.RoomSummary;
import com.sef.coshop.backend.security.JwtUtil;
import com.sef.coshop.backend.service.RoomActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomActivityService roomActivityService;
    private final JwtUtil jwtUtil;
    @Value("${app.extension.api-key:}")
    private String extensionApiKey;

    @GetMapping("/mine")
    public List<RoomSummary> myRooms(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return List.of();
        }
        return roomActivityService.getRoomsForUser(authentication.getName());
    }

    @PostMapping("/join")
    public Map<String, String> joinRoom(
            @RequestBody Map<String, String> payload,
            Authentication authentication,
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String username = resolveUsername(authentication, apiKey, authorization);
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Gecersiz yetkilendirme.");
        }
        String roomId = payload.getOrDefault("roomId", "").trim();
        if (roomId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomId zorunlu");
        }
        roomActivityService.joinRoom(roomId, username);
        return Map.of("roomId", roomId, "username", username, "message", "Katilim basarili");
    }

    private String resolveUsername(Authentication authentication, String providedKey, String authorization) {
        if (authentication != null && authentication.getName() != null && !authentication.getName().isBlank()) {
            return authentication.getName();
        }

        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7).trim();
            if (!token.isBlank() && jwtUtil.validateToken(token)) {
                return jwtUtil.extractUsername(token);
            }
        }

        if (providedKey != null && !providedKey.isBlank()) {
            if (extensionApiKey == null || extensionApiKey.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "APP_EXTENSION_API_KEY ayarlanmadigi icin extension endpointleri kapali."
                );
            }
            boolean matches = MessageDigest.isEqual(
                    extensionApiKey.getBytes(StandardCharsets.UTF_8),
                    providedKey.getBytes(StandardCharsets.UTF_8)
            );
            if (!matches) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Gecersiz extension api key.");
            }
            return null;
        }
        return null;
    }
}
