package com.sef.coshop.backend.service;

import com.sef.coshop.backend.client.ProductApiClient;
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

    public List<ProductDto> getTextileProducts() {
        return productApiClient.fetchProducts().stream()
                .filter(p -> p.getCategory() != null && p.getCategory().toLowerCase().contains("clothing"))
                .collect(Collectors.toList());
    }
}
