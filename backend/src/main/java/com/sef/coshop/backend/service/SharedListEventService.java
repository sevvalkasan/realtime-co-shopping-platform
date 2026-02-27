package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.SharedListAddRequest;
import com.sef.coshop.backend.model.SharedListEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class SharedListEventService {

    private static final String DEFAULT_ROOM = "room-ortak";
    private static final int MAX_EVENTS_PER_ROOM = 500;

    private final AtomicLong idGenerator = new AtomicLong(0);
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SharedListEvent>> roomEvents = new ConcurrentHashMap<>();

    public SharedListEvent addEvent(SharedListAddRequest request) {
        String roomId = normalize(request.getRoomId(), DEFAULT_ROOM);
        String addedBy = normalize(request.getAddedBy(), "Bilinmeyen Kullanici");

        SharedListEvent event = SharedListEvent.builder()
                .id(idGenerator.incrementAndGet())
                .roomId(roomId)
                .addedBy(addedBy)
                .title(normalize(request.getTitle(), "Basliksiz Urun"))
                .url(normalize(request.getUrl(), ""))
                .image(normalize(request.getImage(), ""))
                .price(normalize(request.getPrice(), ""))
                .createdAt(Instant.now())
                .build();

        CopyOnWriteArrayList<SharedListEvent> events =
                roomEvents.computeIfAbsent(roomId, key -> new CopyOnWriteArrayList<>());
        events.add(event);

        if (events.size() > MAX_EVENTS_PER_ROOM) {
            events.remove(0);
        }

        return event;
    }

    public List<SharedListEvent> getEventsAfter(String roomId, long sinceId) {
        String normalizedRoomId = normalize(roomId, DEFAULT_ROOM);
        List<SharedListEvent> events = roomEvents.getOrDefault(normalizedRoomId, new CopyOnWriteArrayList<>());

        List<SharedListEvent> result = new ArrayList<>();
        for (SharedListEvent event : events) {
            if (event.getId() > sinceId) {
                result.add(event);
            }
        }
        return result;
    }

    private String normalize(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
