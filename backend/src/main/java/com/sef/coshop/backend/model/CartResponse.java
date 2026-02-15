package com.sef.coshop.backend.model;

import com.sef.coshop.backend.model.CartItem;
import java.util.List;

public class CartResponse {

    private List<CartItem> items;
    private double total;

    public CartResponse(List<CartItem> items, double total) {
        this.items = items;
        this.total = total;
    }

    public List<CartItem> getItems() { return items; }
    public double getTotal() { return total; }
}
