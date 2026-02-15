package com.sef.coshop.backend.model;

public class Product {
    private Long id;
    private String title;
    private String image;
    private Double price;
    private String category;

    public Product() {}

    public Product(Long id, String title, String image, Double price, String category) {
        this.id = id;
        this.title = title;
        this.image = image;
        this.price = price;
        this.category = category;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
}
