package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.ProductViewEvent;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ProductViewSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    public ProductViewSocketController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/product/view")
    public void onProductViewed(ProductViewEvent event) {
        messagingTemplate.convertAndSend("/topic/product-view", event);
    }
}

