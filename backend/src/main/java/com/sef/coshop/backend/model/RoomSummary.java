package com.sef.coshop.backend.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class RoomSummary {
    private String roomId;
    private Instant lastActivityAt;
    private int memberCount;
}
