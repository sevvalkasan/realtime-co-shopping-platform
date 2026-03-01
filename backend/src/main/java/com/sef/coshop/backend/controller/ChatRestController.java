package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.ChatMessage;
import com.sef.coshop.backend.repository.ChatMessageRepository;
import com.sef.coshop.backend.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatRestController {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final JwtUtil jwtUtil;
    @Value("${app.extension.api-key:}")
    private String extensionApiKey;

    public ChatRestController(
            ChatMessageRepository chatMessageRepository,
            SimpMessagingTemplate messagingTemplate,
            JwtUtil jwtUtil
    ) {
        this.chatMessageRepository = chatMessageRepository;
        this.messagingTemplate = messagingTemplate;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/{roomId}")
    public List<ChatMessage> getRoomMessages(
            @PathVariable String roomId
    ) {
        return chatMessageRepository.findByRoomIdOrderByTimestampAsc(roomId);
    }

    @PostMapping("/{roomId}")
    public ResponseEntity<?> sendRoomMessage(
            @PathVariable String roomId,
            @RequestBody Map<String, String> payload,
            Authentication authentication,
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        String content = payload.getOrDefault("content", "").trim();
        if (content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mesaj boş olamaz."));
        }

        String validatedUsername = resolveOptionalUsername(apiKey, authorization);
        String sender = authentication != null
                ? authentication.getName()
                : (validatedUsername != null ? validatedUsername : payload.getOrDefault("sender", "anonim"));

        ChatMessage message = new ChatMessage();
        message.setRoomId(roomId);
        message.setSender(sender);
        message.setContent(content);
        message.setTimestamp(LocalDateTime.now());
        message.setType("MESSAGE");

        chatMessageRepository.save(message);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", message);
        return ResponseEntity.ok(message);
    }

    private String resolveOptionalUsername(String providedKey, String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7).trim();
            if (!token.isBlank() && jwtUtil.validateToken(token)) {
                return jwtUtil.extractUsername(token);
            }
        }

        if (providedKey != null && !providedKey.isBlank()) {
            if (extensionApiKey == null || extensionApiKey.isBlank()) return null;

            boolean matches = MessageDigest.isEqual(
                    extensionApiKey.getBytes(StandardCharsets.UTF_8),
                    providedKey.getBytes(StandardCharsets.UTF_8)
            );
            if (!matches) return null;
            return null;
        }

        return null;
    }
}
