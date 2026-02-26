package com.sef.coshop.backend.controller;
import com.sef.coshop.backend.model.PresenceRequest;
import com.sef.coshop.backend.service.PresenceService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Set;

@Controller
public class PresenceWebSocketController {

    private final PresenceService presenceService;

    public PresenceWebSocketController(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @MessageMapping("/room/{roomId}/leave")
    @SendTo("/topic/room/{roomId}/presence")
    public Set<String> leave(@DestinationVariable String roomId,
                             PresenceRequest request) {

        return presenceService.leaveRoom(roomId, request.getUsername());
    }
    @MessageMapping("/room/{roomId}/join")
    @SendTo("/topic/room/{roomId}/presence")
    public Set<String> join(@DestinationVariable String roomId,
                            PresenceRequest request,
                            SimpMessageHeaderAccessor headerAccessor) {

        headerAccessor.getSessionAttributes().put("username", request.getUsername());
        headerAccessor.getSessionAttributes().put("roomId", roomId);

        return presenceService.joinRoom(roomId, request.getUsername());
    }
}

