package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.CartItem;
import com.sef.coshop.backend.model.CartResponse;
import com.sef.coshop.backend.model.ChatMessage;
import com.sef.coshop.backend.repository.ChatMessageRepository;
import com.sef.coshop.backend.security.JwtUtil;
import com.sef.coshop.backend.service.CartService;
import com.sef.coshop.backend.service.RoomActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/extension")
@RequiredArgsConstructor
public class ExtensionCollabController {

    private final JwtUtil jwtUtil;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final CartService cartService;
    private final RoomActivityService roomActivityService;

    @Value("${app.extension.api-key:}")
    private String extensionApiKey;

    @GetMapping("/chat/{roomId}")
    public List<ChatMessage> getChat(
            @PathVariable String roomId,
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        try {
            validateAccess(apiKey, authorization);
            return chatMessageRepository.findByRoomIdOrderByTimestampAsc(roomId);
        } catch (Exception ex) {
            return List.of();
        }
    }

    @PostMapping("/chat/{roomId}")
    public ResponseEntity<?> sendChat(
            @PathVariable String roomId,
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, String> payload
    ) {
        try {
            String content = payload.getOrDefault("content", "").trim();
            if (content.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Mesaj boş olamaz."));
            }

            String username = validateAccess(apiKey, authorization);
            String sender = (username != null && !username.isBlank())
                    ? username
                    : payload.getOrDefault("sender", "anonim");

            ChatMessage message = new ChatMessage();
            message.setRoomId(roomId);
            message.setSender(sender);
            message.setContent(content);
            message.setTimestamp(LocalDateTime.now());
            message.setType("MESSAGE");

            chatMessageRepository.save(message);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", message);
            roomActivityService.recordActivity(roomId, sender);
            return ResponseEntity.ok(message);
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("message", ex.getReason() == null ? "Mesaj gonderilemedi." : ex.getReason()));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Mesaj gonderilemedi."));
        }
    }

    @PostMapping("/cart/{roomId}/decrease")
    public ResponseEntity<?> decreaseCartItem(
            @PathVariable String roomId,
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> payload
    ) {
        try {
            String username = validateAccess(apiKey, authorization);
            String fallbackUser = payload.getOrDefault("user", "anonim").toString().trim();
            String user = (username != null && !username.isBlank()) ? username : fallbackUser;

            Long productId;
            try {
                Object productIdRaw = payload.get("productId");
                if (productIdRaw == null) {
                    return ResponseEntity.badRequest().body(Map.of("message", "productId zorunlu"));
                }
                productId = Long.parseLong(productIdRaw.toString());
            } catch (NumberFormatException ex) {
                return ResponseEntity.badRequest().body(Map.of("message", "productId gecersiz"));
            }

            List<CartItem> updatedCart = cartService.decreaseItem(roomId, productId, user);
            double total = cartService.calculateTotal(roomId);
            roomActivityService.recordActivity(roomId, user);
            CartResponse response = new CartResponse(updatedCart, total);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/cart", response);
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("message", ex.getReason() == null ? "Eksiltme basarisiz." : ex.getReason()));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Eksiltme basarisiz."));
        }
    }

    private String validateAccess(String providedKey, String authorization) {
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

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Gecersiz extension yetkilendirmesi.");
    }
}
