package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.Product;
import com.sef.coshop.backend.model.ProductDto;
import com.sef.coshop.backend.service.ProductService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/textile")
    public List<ProductDto> getTextileProducts() {
        return productService.getTextileProducts()
                .stream()
                .map(this::toDto)
                .toList();
    }

    private ProductDto toDto(Product p) {
        ProductDto dto = new ProductDto();
        dto.setId(p.getId());
        dto.setTitle(p.getTitle());
        dto.setImage(p.getImage());
        dto.setPrice(p.getPrice());
        dto.setCategory(p.getCategory());
        return dto;
    }
}
