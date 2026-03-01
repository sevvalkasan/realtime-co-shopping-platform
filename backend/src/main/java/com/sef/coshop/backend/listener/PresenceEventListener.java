package com.sef.coshop.backend.listener;

import com.sef.coshop.backend.service.PresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Set;

@Component
public class PresenceEventListener {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private PresenceService presenceService;

    @Bean
    @ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
    RedisMessageListenerContainer redisContainer(
            RedisConnectionFactory connectionFactory) {

        RedisMessageListenerContainer container =
                new RedisMessageListenerContainer();

        container.setConnectionFactory(connectionFactory);
        container.addMessageListener((message, pattern) -> {

            String roomId = new String(message.getBody());
            Set<String> users = presenceService.getUsers(roomId);

            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomId + "/presence",
                    users
            );

        }, Collections.singleton(new ChannelTopic("presence-events")));

        return container;
    }
}
