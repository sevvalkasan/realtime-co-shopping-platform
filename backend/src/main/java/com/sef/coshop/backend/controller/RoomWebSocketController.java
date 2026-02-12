package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.RoomMessageDto;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class RoomWebSocketController {

    @MessageMapping("/room/{roomId}/message")
    @SendTo("/topic/room/{roomId}")
    public RoomMessageDto sendToRoom(@DestinationVariable String roomId,
                                  RoomMessageDto message) {

        return new RoomMessageDto(
                roomId,
                message.getSender(),
                message.getContent()
        );
    }
    @MessageMapping("/room/{roomId}/join")
    @SendTo("/topic/room/{roomId}")
    public RoomMessageDto joinRoom(@DestinationVariable String roomId,
                                   RoomMessageDto message) {

        return new RoomMessageDto(
                roomId,
                message.getSender(),
                "odaya katıldı 👋"
        );
    }

}

