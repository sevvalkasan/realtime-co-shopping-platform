package com.sef.coshop.backend.service;

import com.sef.coshop.backend.client.ProductApiClient;
import com.sef.coshop.backend.model.Product;
import com.sef.coshop.backend.model.ProductDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private final ProductApiClient productApiClient;

    public ProductService(ProductApiClient productApiClient) {
        this.productApiClient = productApiClient;
    }

    public List<Product> getTextileProducts() {
        return productApiClient.fetchProducts().stream()
                .filter(p -> p.getCategory() != null && p.getCategory().toLowerCase().contains("clothing"))
                .map(this::toProduct)
                .collect(Collectors.toList());
    }

    private Product toProduct(ProductDto dto) {
        return new Product(
                dto.getId(),
                dto.getTitle(),
                dto.getImage(),
                dto.getPrice(),
                dto.getCategory()
        );
    }
}
