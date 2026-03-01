package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.RoomSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
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
    private final StringRedisTemplate stringRedisTemplate;

    private final ConcurrentMap<String, Instant> roomLastActivity = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CopyOnWriteArraySet<String>> roomUsers = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CopyOnWriteArraySet<String>> userRooms = new ConcurrentHashMap<>();

    @Value("${app.rooms.inactive-ttl-hours:24}")
    private long inactiveTtlHours;
    @Value("${app.redis.enabled:false}")
    private boolean redisEnabled;

    private static final String ROOM_LAST_ACTIVITY_HASH = "room:lastActivity";
    private static final String ROOM_USERS_PREFIX = "room:users:";
    private static final String USER_ROOMS_PREFIX = "user:rooms:";

    private boolean useRedis() {
        return redisEnabled && stringRedisTemplate != null;
    }

    public void joinRoom(String roomId, String username) {
        String normalizedRoomId = normalizeRoomId(roomId);
        String normalizedUser = normalizeUser(username);
        if (normalizedRoomId == null || normalizedUser == null) return;

        if (useRedis()) {
            try {
                stringRedisTemplate.opsForSet().add(ROOM_USERS_PREFIX + normalizedRoomId, normalizedUser);
                stringRedisTemplate.opsForSet().add(USER_ROOMS_PREFIX + normalizedUser, normalizedRoomId);
                touchRoom(normalizedRoomId);
                return;
            } catch (Exception ignored) {
                // Redis sorununda in-memory fallback
            }
        }

        roomUsers.computeIfAbsent(normalizedRoomId, ignored -> new CopyOnWriteArraySet<>()).add(normalizedUser);
        userRooms.computeIfAbsent(normalizedUser, ignored -> new CopyOnWriteArraySet<>()).add(normalizedRoomId);
        touchRoom(normalizedRoomId);
    }

    public void leaveRoom(String roomId, String username) {
        String normalizedRoomId = normalizeRoomId(roomId);
        String normalizedUser = normalizeUser(username);
        if (normalizedRoomId == null || normalizedUser == null) return;

        if (useRedis()) {
            try {
                stringRedisTemplate.opsForSet().remove(ROOM_USERS_PREFIX + normalizedRoomId, normalizedUser);
                stringRedisTemplate.opsForSet().remove(USER_ROOMS_PREFIX + normalizedUser, normalizedRoomId);
                touchRoom(normalizedRoomId);
                return;
            } catch (Exception ignored) {
                // Redis sorununda in-memory fallback
            }
        }

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

        if (useRedis()) {
            try {
                Set<String> rooms = stringRedisTemplate.opsForSet().members(USER_ROOMS_PREFIX + normalizedUser);
                if (rooms == null || rooms.isEmpty()) return List.of();

                List<RoomSummary> summaries = new ArrayList<>();
                for (String roomId : rooms) {
                    String lastActivityRaw = stringRedisTemplate.opsForHash().get(ROOM_LAST_ACTIVITY_HASH, roomId) != null
                            ? stringRedisTemplate.opsForHash().get(ROOM_LAST_ACTIVITY_HASH, roomId).toString()
                            : null;
                    if (lastActivityRaw == null) continue;
                    Instant lastActivity = Instant.ofEpochMilli(Long.parseLong(lastActivityRaw));
                    Long memberCountRaw = stringRedisTemplate.opsForSet().size(ROOM_USERS_PREFIX + roomId);
                    int memberCount = memberCountRaw == null ? 0 : memberCountRaw.intValue();
                    summaries.add(new RoomSummary(roomId, lastActivity, memberCount));
                }

                return summaries.stream()
                        .sorted(Comparator.comparing(RoomSummary::getLastActivityAt).reversed())
                        .collect(Collectors.toList());
            } catch (Exception ignored) {
                // Redis sorununda in-memory fallback
            }
        }

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

        if (useRedis()) {
            try {
                Map<Object, Object> lastActivityEntries = stringRedisTemplate.opsForHash().entries(ROOM_LAST_ACTIVITY_HASH);
                for (Map.Entry<Object, Object> entry : lastActivityEntries.entrySet()) {
                    String roomId = entry.getKey().toString();
                    Instant lastActivity = Instant.ofEpochMilli(Long.parseLong(entry.getValue().toString()));
                    if (!lastActivity.isBefore(threshold)) continue;

                    stringRedisTemplate.opsForHash().delete(ROOM_LAST_ACTIVITY_HASH, roomId);

                    Set<String> users = stringRedisTemplate.opsForSet().members(ROOM_USERS_PREFIX + roomId);
                    if (users != null) {
                        for (String user : users) {
                            stringRedisTemplate.opsForSet().remove(USER_ROOMS_PREFIX + user, roomId);
                        }
                    }
                    stringRedisTemplate.delete(ROOM_USERS_PREFIX + roomId);

                    cartService.clearCart(roomId);
                    sharedListEventService.clearRoom(roomId);
                    presenceService.clearRoom(roomId);
                }
                return;
            } catch (Exception ignored) {
                // Redis sorununda in-memory fallback
            }
        }

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
        if (useRedis()) {
            try {
                stringRedisTemplate.opsForHash().put(ROOM_LAST_ACTIVITY_HASH, roomId, String.valueOf(Instant.now().toEpochMilli()));
                return;
            } catch (Exception ignored) {
                // Redis sorununda in-memory fallback
            }
        }
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
