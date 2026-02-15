package com.sef.coshop.backend.model;

public class AddToCartRequest {

    private Product product;
    private String addedBy;

    public AddToCartRequest() {
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public String getAddedBy() {
        return addedBy;
    }

    public void setAddedBy(String addedBy) {
        this.addedBy = addedBy;
    }
}
