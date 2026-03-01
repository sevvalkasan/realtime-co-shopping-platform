package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.CartItem;
import java.util.List;

import com.sef.coshop.backend.model.Product;
import com.sef.coshop.backend.service.CartService;
import com.sef.coshop.backend.service.ProductService;
import com.sef.coshop.backend.service.RoomActivityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/rooms/{roomId}/cart")
public class CartController {

    private final CartService cartService;
    private final ProductService productService;
    private final RoomActivityService roomActivityService;

    public CartController(CartService cartService, ProductService productService, RoomActivityService roomActivityService) {
        this.cartService = cartService;
        this.productService = productService;
        this.roomActivityService = roomActivityService;
    }

    @PostMapping("/add")
    public void addToCart(
            @PathVariable String roomId,
            @RequestParam Long productId,
            @RequestParam String user
    ) {
        Product product = productService.getTextileProducts().stream()
                .filter(p -> p.getId().equals(productId))
                .findFirst()
                .orElseThrow();

        cartService.addToCart(roomId, product, user);
        roomActivityService.recordActivity(roomId, user);
    }

    @GetMapping
    public ResponseEntity<?> getCart(@PathVariable String roomId) {
        try {
            roomActivityService.recordActivity(roomId, null);
            return ResponseEntity.ok(cartService.getCart(roomId));
        } catch (Exception ex) {
            return ResponseEntity.ok(List.of());
        }
    }
}
