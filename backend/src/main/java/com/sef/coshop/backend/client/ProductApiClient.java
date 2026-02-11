package com.sef.coshop.backend.client;

import com.sef.coshop.backend.model.ProductDto;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@Component
public class ProductApiClient {

    private final RestTemplate restTemplate = new RestTemplate();

    public List<ProductDto> fetchProducts() {
        String url = "https://fakestoreapi.com/products";
        ProductDto[] products = restTemplate.getForObject(url, ProductDto[].class);
        return Arrays.asList(products);
    }
}
