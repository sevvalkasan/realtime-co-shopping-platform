package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import com.sef.coshop.backend.repository.ChatMessageRepository;

import java.time.LocalDateTime;

@Controller
public class ChatWebSocketController {
    @Autowired
    private ChatMessageRepository chatMessageRepository;
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat/{roomId}")
    public void sendMessage(@DestinationVariable String roomId,
                            ChatMessage message) {

        message.setRoomId(roomId);
        message.setTimestamp(LocalDateTime.now());
        message.setType("MESSAGE");

        // 🔥 DB'ye kaydet
        chatMessageRepository.save(message);

        // 🔥 Sonra broadcast et
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomId + "/chat",
                message
        );
    }

    @MessageMapping("/chat.typing")
    public void typing(ChatMessage message) {

        message.setType("TYPING");

        messagingTemplate.convertAndSend(
                "/topic/room/" + message.getRoomId() + "/typing",
                message
        );
    }

    @MessageMapping("/chat.stopTyping")
    public void stopTyping(ChatMessage message) {

        message.setType("STOP_TYPING");

        messagingTemplate.convertAndSend(
                "/topic/room/" + message.getRoomId() + "/typing",
                message
        );
    }
}
