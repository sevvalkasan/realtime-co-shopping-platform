package com.sef.coshop.backend.controller;
import com.sef.coshop.backend.model.PresenceRequest;
import com.sef.coshop.backend.service.PresenceService;
import com.sef.coshop.backend.service.RoomActivityService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Set;

@Controller
public class PresenceWebSocketController {

    private final PresenceService presenceService;
    private final RoomActivityService roomActivityService;

    public PresenceWebSocketController(PresenceService presenceService, RoomActivityService roomActivityService) {
        this.presenceService = presenceService;
        this.roomActivityService = roomActivityService;
    }

    @MessageMapping("/room/{roomId}/leave")
    @SendTo("/topic/room/{roomId}/presence")
    public Set<String> leave(@DestinationVariable String roomId,
                             PresenceRequest request) {
        roomActivityService.leaveRoom(roomId, request.getUsername());
        return presenceService.leaveRoom(roomId, request.getUsername());
    }
    @MessageMapping("/room/{roomId}/join")
    @SendTo("/topic/room/{roomId}/presence")
    public Set<String> join(@DestinationVariable String roomId,
                            PresenceRequest request,
                            SimpMessageHeaderAccessor headerAccessor) {

        headerAccessor.getSessionAttributes().put("username", request.getUsername());
        headerAccessor.getSessionAttributes().put("roomId", roomId);
        roomActivityService.joinRoom(roomId, request.getUsername());

        return presenceService.joinRoom(roomId, request.getUsername());
    }
}
