package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.RoomSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomActivityService {

    private final CartService cartService;
    private final SharedListEventService sharedListEventService;
    private final PresenceService presenceService;

    private final ConcurrentMap<String, Instant> roomLastActivity = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CopyOnWriteArraySet<String>> roomUsers = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CopyOnWriteArraySet<String>> userRooms = new ConcurrentHashMap<>();

    @Value("${app.rooms.inactive-ttl-hours:24}")
    private long inactiveTtlHours;

    public void joinRoom(String roomId, String username) {
        String normalizedRoomId = normalizeRoomId(roomId);
        String normalizedUser = normalizeUser(username);
        if (normalizedRoomId == null || normalizedUser == null) return;

        roomUsers.computeIfAbsent(normalizedRoomId, ignored -> new CopyOnWriteArraySet<>()).add(normalizedUser);
        userRooms.computeIfAbsent(normalizedUser, ignored -> new CopyOnWriteArraySet<>()).add(normalizedRoomId);
        touchRoom(normalizedRoomId);
    }

    public void leaveRoom(String roomId, String username) {
        String normalizedRoomId = normalizeRoomId(roomId);
        String normalizedUser = normalizeUser(username);
        if (normalizedRoomId == null || normalizedUser == null) return;

        Set<String> users = roomUsers.get(normalizedRoomId);
        if (users != null) {
            users.remove(normalizedUser);
            if (users.isEmpty()) {
                roomUsers.remove(normalizedRoomId);
            }
        }
        touchRoom(normalizedRoomId);
    }

    public void recordActivity(String roomId, String username) {
        String normalizedRoomId = normalizeRoomId(roomId);
        if (normalizedRoomId == null) return;
        if (username != null && !username.isBlank()) {
            joinRoom(normalizedRoomId, username);
            return;
        }
        touchRoom(normalizedRoomId);
    }

    public List<RoomSummary> getRoomsForUser(String username) {
        String normalizedUser = normalizeUser(username);
        if (normalizedUser == null) return List.of();

        Set<String> rooms = userRooms.getOrDefault(normalizedUser, new CopyOnWriteArraySet<>());
        List<RoomSummary> summaries = new ArrayList<>();
        for (String roomId : rooms) {
            Instant lastActivity = roomLastActivity.get(roomId);
            if (lastActivity == null) continue;
            int memberCount = roomUsers.getOrDefault(roomId, new CopyOnWriteArraySet<>()).size();
            summaries.add(new RoomSummary(roomId, lastActivity, memberCount));
        }

        return summaries.stream()
                .sorted(Comparator.comparing(RoomSummary::getLastActivityAt).reversed())
                .collect(Collectors.toList());
    }

    @Scheduled(fixedDelayString = "${app.rooms.cleanup-interval-ms:600000}")
    public void cleanupInactiveRooms() {
        Instant threshold = Instant.now().minus(Duration.ofHours(Math.max(1, inactiveTtlHours)));
        List<String> inactiveRooms = roomLastActivity.entrySet().stream()
                .filter(entry -> entry.getValue().isBefore(threshold))
                .map(Map.Entry::getKey)
                .toList();

        for (String roomId : inactiveRooms) {
            roomLastActivity.remove(roomId);
            roomUsers.remove(roomId);
            userRooms.values().forEach(rooms -> rooms.remove(roomId));

            cartService.clearCart(roomId);
            sharedListEventService.clearRoom(roomId);
            presenceService.clearRoom(roomId);
        }
    }

    private void touchRoom(String roomId) {
        roomLastActivity.put(roomId, Instant.now());
    }

    private String normalizeRoomId(String roomId) {
        if (roomId == null) return null;
        String normalized = roomId.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeUser(String username) {
        if (username == null) return null;
        String normalized = username.trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }
}
