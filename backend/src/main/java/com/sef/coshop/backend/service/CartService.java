package com.sef.coshop.backend.service;

import com.sef.coshop.backend.model.CartItem;
import com.sef.coshop.backend.model.Product;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String CART_KEY_PREFIX = "cart:";
    private final Map<String, Map<String, CartItem>> inMemoryCarts = new ConcurrentHashMap<>();

    @Value("${app.redis.enabled:false}")
    private boolean redisEnabled;

    // Her oda için benzersiz bir Redis anahtarı oluşturur (örn: cart:room123)
    private String getCartKey(String roomId) {
        return CART_KEY_PREFIX + roomId;
    }

    private boolean useRedis() {
        return redisEnabled && redisTemplate != null;
    }

    private Map<String, CartItem> getInMemoryCart(String roomId) {
        return inMemoryCarts.computeIfAbsent(roomId, ignored -> new ConcurrentHashMap<>());
    }

    public List<CartItem> getCart(String roomId) {
        if (useRedis()) {
            try {
                // Odadaki tüm ürünleri Redis Hash'inden çekiyoruz
                Map<Object, Object> entries = redisTemplate.opsForHash().entries(getCartKey(roomId));
                return entries.values().stream()
                        .map(obj -> (CartItem) obj)
                        .collect(Collectors.toList());
            } catch (RuntimeException ignored) {
                // Redis geçici olarak erişilemezse in-memory fallback kullan.
            }
        }

        return new ArrayList<>(getInMemoryCart(roomId).values());
    }

    public List<CartItem> addToCart(String roomId, Product product, String user) {
        String productId = String.valueOf(product.getId());

        if (useRedis()) {
            try {
                String cartKey = getCartKey(roomId);
                // Ürünü Hash içinden çek (Varsa miktar artacak, yoksa yeni eklenecek)
                CartItem item = (CartItem) redisTemplate.opsForHash().get(cartKey, productId);

                if (item != null) {
                    item.increase(user);
                } else {
                    item = new CartItem(product, user);
                }

                redisTemplate.opsForHash().put(cartKey, productId, item);
                return getCart(roomId);
            } catch (RuntimeException ignored) {
                // Redis geçici olarak erişilemezse in-memory fallback kullan.
            }
        }

        Map<String, CartItem> cart = getInMemoryCart(roomId);
        CartItem item = cart.get(productId);
        if (item != null) {
            item.increase(user);
        } else {
            item = new CartItem(product, user);
        }
        cart.put(productId, item);
        return getCart(roomId);
    }

    public List<CartItem> decreaseItem(String roomId, Long productId, String user) {
        String pid = String.valueOf(productId);

        if (useRedis()) {
            try {
                String cartKey = getCartKey(roomId);
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
            } catch (RuntimeException ignored) {
                // Redis geçici olarak erişilemezse in-memory fallback kullan.
            }
        }

        Map<String, CartItem> cart = getInMemoryCart(roomId);
        CartItem item = cart.get(pid);
        if (item != null) {
            item.decrease(user);
            if (item.getQuantity() <= 0) {
                cart.remove(pid);
            } else {
                cart.put(pid, item);
            }
        }
        return getCart(roomId);
    }

    public List<CartItem> removeItem(String roomId, Long productId) {
        String pid = String.valueOf(productId);
        if (useRedis()) {
            try {
                redisTemplate.opsForHash().delete(getCartKey(roomId), pid);
                return getCart(roomId);
            } catch (RuntimeException ignored) {
                // Redis geçici olarak erişilemezse in-memory fallback kullan.
            }
        }
        getInMemoryCart(roomId).remove(pid);
        return getCart(roomId);
    }

    public void clearCart(String roomId) {
        if (useRedis()) {
            try {
                redisTemplate.delete(getCartKey(roomId));
                return;
            } catch (RuntimeException ignored) {
                // Redis geçici olarak erişilemezse in-memory fallback kullan.
            }
        }
        inMemoryCarts.remove(roomId);
    }

    public double calculateTotal(String roomId) {
        return getCart(roomId).stream()
                .mapToDouble(item -> item.getProduct().getPrice() * item.getQuantity())
                .sum();
    }
}
