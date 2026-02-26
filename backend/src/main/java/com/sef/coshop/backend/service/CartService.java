package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.CartItem;
import com.sef.coshop.backend.model.Product;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String CART_KEY_PREFIX = "cart:";

    // Her oda için benzersiz bir Redis anahtarı oluşturur (örn: cart:room123)
    private String getCartKey(String roomId) {
        return CART_KEY_PREFIX + roomId;
    }

    public List<CartItem> getCart(String roomId) {
        // Odadaki tüm ürünleri Redis Hash'inden çekiyoruz
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(getCartKey(roomId));
        return entries.values().stream()
                .map(obj -> (CartItem) obj)
                .collect(Collectors.toList());
    }

    public List<CartItem> addToCart(String roomId, Product product, String user) {
        String cartKey = getCartKey(roomId);
        String productId = String.valueOf(product.getId());

        // Ürünü Hash içinden çek (Varsa miktar artacak, yoksa yeni eklenecek)
        CartItem item = (CartItem) redisTemplate.opsForHash().get(cartKey, productId);

        if (item != null) {
            item.increase(user);
        } else {
            item = new CartItem(product, user);
        }

        redisTemplate.opsForHash().put(cartKey, productId, item);
        return getCart(roomId);
    }

    public List<CartItem> decreaseItem(String roomId, Long productId, String user) {
        String cartKey = getCartKey(roomId);
        String pid = String.valueOf(productId);

        CartItem item = (CartItem) redisTemplate.opsForHash().get(cartKey, pid);

        if (item != null) {
            item.decrease(user);
            if (item.getQuantity() <= 0) {
                redisTemplate.opsForHash().delete(cartKey, pid);
            } else {
                redisTemplate.opsForHash().put(cartKey, pid, item);
            }
        }
        return getCart(roomId);
    }

    public List<CartItem> removeItem(String roomId, Long productId) {
        redisTemplate.opsForHash().delete(getCartKey(roomId), String.valueOf(productId));
        return getCart(roomId);
    }

    public void clearCart(String roomId) {
        redisTemplate.delete(getCartKey(roomId));
    }

    public double calculateTotal(String roomId) {
        return getCart(roomId).stream()
                .mapToDouble(item -> item.getProduct().getPrice() * item.getQuantity())
                .sum();
    }
}