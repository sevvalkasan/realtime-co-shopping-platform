package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.*;
import com.sef.coshop.backend.service.CartService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class CartWebSocketController {

    private final CartService cartService;

    public CartWebSocketController(CartService cartService) {
        this.cartService = cartService;
    }

    @MessageMapping("/room/{roomId}/cart/add")
    @SendTo("/topic/room/{roomId}/cart")
    public CartResponse addToCart(@DestinationVariable String roomId,
                                  AddToCartRequest request) {

        List<CartItem> updatedCart = cartService.addToCart(
                roomId,
                request.getProduct(),
                request.getAddedBy()
        );

        double total = cartService.calculateTotal(roomId);

        return new CartResponse(updatedCart, total);
    }

    @MessageMapping("/room/{roomId}/cart/decrease")
    @SendTo("/topic/room/{roomId}/cart")
    public CartResponse decrease(@DestinationVariable String roomId,
                                 DecreaseRequest request) {

        List<CartItem> updatedCart = cartService.decreaseItem(
                roomId,
                request.getProductId(),
                request.getUser()
        );

        double total = cartService.calculateTotal(roomId);

        return new CartResponse(updatedCart, total);
    }
}
