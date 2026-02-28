package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.SharedListAddRequest;
import com.sef.coshop.backend.model.SharedListEvent;
import com.sef.coshop.backend.model.Product;
import com.sef.coshop.backend.model.CartItem;
import com.sef.coshop.backend.model.CartResponse;
import com.sef.coshop.backend.service.SharedListEventService;
import com.sef.coshop.backend.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Objects;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/extension/shared-list")
@RequiredArgsConstructor
public class SharedListExtensionController {

    private final SharedListEventService sharedListEventService;
    private final CartService cartService;
    private final SimpMessagingTemplate messagingTemplate;
    @Value("${app.extension.api-key:}")
    private String extensionApiKey;

    @PostMapping("/add")
    public SharedListEvent add(
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestBody SharedListAddRequest request
    ) {
        validateApiKey(apiKey);
        SharedListEvent event = sharedListEventService.addEvent(request);
        syncSharedItemToCart(event);
        return event;
    }

    @GetMapping("/events")
    public List<SharedListEvent> events(
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestParam String roomId,
            @RequestParam(defaultValue = "0") long sinceId
    ) {
        validateApiKey(apiKey);
        return sharedListEventService.getEventsAfter(roomId, sinceId);
    }

    private void validateApiKey(String providedKey) {
        if (extensionApiKey == null || extensionApiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "APP_EXTENSION_API_KEY ayarlanmadigi icin extension endpointleri kapali."
            );
        }
        if (providedKey == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "X-Extension-Key eksik.");
        }

        boolean matches = MessageDigest.isEqual(
                extensionApiKey.getBytes(StandardCharsets.UTF_8),
                providedKey.getBytes(StandardCharsets.UTF_8)
        );
        if (!matches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Gecersiz extension api key.");
        }
    }

    private void syncSharedItemToCart(SharedListEvent event) {
        Product product = Product.builder()
                .id(buildSyntheticProductId(event))
                .title(event.getTitle())
                .image(event.getImage())
                .price(parsePrice(event.getPrice()))
                .category("extension")
                .build();

        List<CartItem> updatedCart = cartService.addToCart(event.getRoomId(), product, event.getAddedBy());
        double total = cartService.calculateTotal(event.getRoomId());
        messagingTemplate.convertAndSend(
                "/topic/room/" + event.getRoomId() + "/cart",
                new CartResponse(updatedCart, total)
        );
    }

    private long buildSyntheticProductId(SharedListEvent event) {
        int hash = Objects.hash(event.getRoomId(), event.getTitle(), event.getUrl(), event.getImage(), event.getPrice());
        return Integer.toUnsignedLong(hash);
    }

    private double parsePrice(String rawPrice) {
        if (rawPrice == null || rawPrice.isBlank()) {
            return 0.0;
        }

        String normalized = rawPrice.replace('\u00A0', ' ').trim();

        String[] patterns = new String[]{
                "(\\d{1,3}(?:[\\.\\s]\\d{3})+,\\d{2})",
                "(\\d+,\\d{2})",
                "(\\d+\\.\\d{2})",
                "(\\d+)"
        };

        for (String patternValue : patterns) {
            Matcher matcher = Pattern.compile(patternValue).matcher(normalized);
            if (matcher.find()) {
                String number = matcher.group(1);
                number = number.replace(" ", "").replace(".", "").replace(",", ".");
                try {
                    return Double.parseDouble(number);
                } catch (NumberFormatException ignored) {
                    // Bir sonraki kalıba dene.
                }
            }
        }

        return 0.0;
    }
}
