package com.sef.coshop.backend.model;

public class DecreaseRequest {

    private Long productId;
    private String user;

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }
}
