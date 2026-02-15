package com.sef.coshop.backend.model;

import java.util.HashMap;
import java.util.Map;

public class CartItem {

    private Product product;
    private int quantity;
    private Map<String, Integer> userQuantities = new HashMap<>();
    private String lastAddedBy;

    public CartItem(Product product, String firstUser) {
        firstUser = normalize(firstUser);

        this.product = product;
        this.quantity = 1;
        this.userQuantities.put(firstUser, 1);
        this.lastAddedBy = firstUser;
    }

    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }
    public Map<String, Integer> getUserQuantities() { return userQuantities; }
    public String getLastAddedBy() { return lastAddedBy; }

    public void increase(String user) {
        user = normalize(user);

        quantity++;
        userQuantities.put(user,
                userQuantities.getOrDefault(user, 0) + 1);
        lastAddedBy = user;
    }

    public void decrease(String user) {
        user = normalize(user);

        if (!userQuantities.containsKey(user)) return;

        quantity--;

        int newQty = userQuantities.get(user) - 1;

        if (newQty <= 0) {
            userQuantities.remove(user);
        } else {
            userQuantities.put(user, newQty);
        }
    }

    private String normalize(String user) {
        return user == null ? "" : user.trim().toLowerCase();
    }
}
