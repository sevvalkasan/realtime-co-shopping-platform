package com.sef.coshop.backend.model;

public class ProductViewEvent {
    private String user;
    private Long productId;

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }
}

