package com.sef.coshop.backend.model;

import java.util.ArrayList;
import java.util.List;

public class SharedCart {
    private String roomId;
    private List<CartItem> items = new ArrayList<>();

    public SharedCart() {}

    public SharedCart(String roomId) {
        this.roomId = roomId;
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public List<CartItem> getItems() { return items; }
    public void setItems(List<CartItem> items) { this.items = items; }
}

