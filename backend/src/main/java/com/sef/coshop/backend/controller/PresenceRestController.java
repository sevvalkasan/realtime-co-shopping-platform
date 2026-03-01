package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@RestController
@RequestMapping("/api/rooms/{roomId}/presence")
@RequiredArgsConstructor
public class PresenceRestController {

    private final PresenceService presenceService;

    @GetMapping
    public Set<String> getPresence(@PathVariable String roomId) {
        return presenceService.getUsers(roomId);
    }
}
