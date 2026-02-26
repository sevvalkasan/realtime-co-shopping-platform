package com.sef.coshop.backend.websocket;

import com.sef.coshop.backend.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketEventListener {

    private final PresenceService presenceService;

    public WebSocketEventListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        String username = accessor.getSessionAttributes() != null
                ? (String) accessor.getSessionAttributes().get("username")
                : null;

        String roomId = accessor.getSessionAttributes() != null
                ? (String) accessor.getSessionAttributes().get("roomId")
                : null;

        if (username != null && roomId != null) {
            presenceService.leaveRoom(roomId, username);
        }
    }
}
