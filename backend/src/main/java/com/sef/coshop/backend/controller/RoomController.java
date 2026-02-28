package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.RoomSummary;
import com.sef.coshop.backend.service.RoomActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomActivityService roomActivityService;

    @GetMapping("/mine")
    public List<RoomSummary> myRooms(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return List.of();
        }
        return roomActivityService.getRoomsForUser(authentication.getName());
    }
}
