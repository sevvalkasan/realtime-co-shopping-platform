package com.sef.coshop.backend.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor // Redis/Jackson için şart
public class CartItem {

    private Product product;
    private int quantity;
    private Map<String, Integer> userQuantities = new HashMap<>();
    private String lastAddedBy;

    // Custom constructor
    public CartItem(Product product, String firstUser) {
        firstUser = normalize(firstUser);
        this.product = product;
        this.quantity = 1;
        this.userQuantities.put(firstUser, 1);
        this.lastAddedBy = firstUser;
    }

    public void increase(String user) {
        user = normalize(user);
        this.quantity++;
        this.userQuantities.put(user, this.userQuantities.getOrDefault(user, 0) + 1);
        this.lastAddedBy = user;
    }

    public void decrease(String user) {
        user = normalize(user);
        if (this.quantity <= 0) return;

        this.quantity--;

        if (userQuantities.containsKey(user)) {
            int newQty = userQuantities.get(user) - 1;
            if (newQty <= 0) {
                userQuantities.remove(user);
            } else {
                userQuantities.put(user, newQty);
            }
            return;
        }

        // Farklı bir kullanıcı da sepetten eksiltebilsin:
        // hedef kullanıcıya ait kayıt yoksa mevcut sahiplerden birinden düş.
        String fallbackOwner = userQuantities.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);

        if (fallbackOwner == null) {
            return;
        }

        int newQty = userQuantities.getOrDefault(fallbackOwner, 0) - 1;
        if (newQty <= 0) {
            userQuantities.remove(fallbackOwner);
        } else {
            userQuantities.put(fallbackOwner, newQty);
        }
    }

    private String normalize(String user) {
        return user == null ? "" : user.trim().toLowerCase();
    }
}
