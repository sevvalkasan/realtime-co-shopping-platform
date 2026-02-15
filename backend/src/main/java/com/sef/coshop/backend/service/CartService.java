package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.CartItem;
import com.sef.coshop.backend.model.Product;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CartService {

    private final Map<String, List<CartItem>> roomCarts = new HashMap<>();

    public List<CartItem> getCart(String roomId) {
        return roomCarts.getOrDefault(roomId, new ArrayList<>());
    }

    public List<CartItem> addToCart(String roomId, Product product, String user) {

        roomCarts.putIfAbsent(roomId, new ArrayList<>());
        List<CartItem> cart = roomCarts.get(roomId);

        Optional<CartItem> existingItem = cart.stream()
                .filter(item -> item.getProduct().getId().equals(product.getId()))
                .findFirst();

        if (existingItem.isPresent()) {
            existingItem.get().increase(user);
        } else {
            cart.add(new CartItem(product, user));
        }

        return cart;
    }

    public List<CartItem> decreaseItem(String roomId, Long productId, String user) {

        List<CartItem> cart = roomCarts.get(roomId);
        if (cart == null) return new ArrayList<>();

        Iterator<CartItem> iterator = cart.iterator();

        while (iterator.hasNext()) {
            CartItem item = iterator.next();

            if (item.getProduct().getId().equals(productId)) {

                item.decrease(user);

                if (item.getQuantity() <= 0) {
                    iterator.remove();
                }

                break;
            }
        }

        return cart;
    }

    public List<CartItem> removeItem(String roomId, Long productId) {

        List<CartItem> cart = roomCarts.get(roomId);
        if (cart == null) return new ArrayList<>();

        cart.removeIf(item ->
                item.getProduct().getId().equals(productId)
        );

        return cart;
    }

    public void clearCart(String roomId) {
        roomCarts.remove(roomId);
    }

    public double calculateTotal(String roomId) {

        List<CartItem> cart = roomCarts.get(roomId);
        if (cart == null) return 0.0;

        return cart.stream()
                .mapToDouble(item ->
                        item.getProduct().getPrice() * item.getQuantity()
                )
                .sum();
    }
}
