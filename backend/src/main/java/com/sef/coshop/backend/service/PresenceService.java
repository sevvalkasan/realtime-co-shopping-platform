package com.sef.coshop.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.Set;

@Service
public class PresenceService {

    private final RedisTemplate<String, String> redisTemplate;

    public PresenceService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String getRoomKey(String roomId) {
        return "room:" + roomId + ":users";
    }

    public Set<String> joinRoom(String roomId, String username) {

        String key = getRoomKey(roomId);

        redisTemplate.opsForSet().add(key, username);

        redisTemplate.expire(key, Duration.ofHours(1));

        stringRedisTemplate.convertAndSend(CHANNEL, roomId);

        return getUsers(roomId);
    }

    public Set<String> leaveRoom(String roomId, String username) {

        String key = getRoomKey(roomId);

        redisTemplate.opsForSet().remove(key, username);

        Long size = redisTemplate.opsForSet().size(key);

        if (size == null || size == 0) {
            redisTemplate.expire(key, Duration.ofHours(1));
        } else {
            redisTemplate.expire(key, Duration.ofHours(1));
        }

        // 🔥 HER DURUMDA publish
        stringRedisTemplate.convertAndSend(CHANNEL, roomId);

        return getUsers(roomId);
    }

    public Set<String> getUsers(String roomId) {
        return redisTemplate.opsForSet().members(getRoomKey(roomId));
    }
    public void clearRoom(String roomId) {
        redisTemplate.delete(getRoomKey(roomId));
    }
    private void refreshTTL(String roomId) {
        redisTemplate.expire(getRoomKey(roomId), Duration.ofHours(1));
    }
    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    private static final String CHANNEL = "presence-events";
}
