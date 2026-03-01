package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.SharedListEvent;
import com.sef.coshop.backend.service.SharedListEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rooms/{roomId}/shared-list")
@RequiredArgsConstructor
public class SharedListController {

    private final SharedListEventService sharedListEventService;

    @GetMapping
    public ResponseEntity<?> getSharedList(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "0") long sinceId
    ) {
        try {
            return ResponseEntity.ok(sharedListEventService.getEventsAfter(roomId, sinceId));
        } catch (Exception ex) {
            return ResponseEntity.ok(List.of());
        }
    }
}
