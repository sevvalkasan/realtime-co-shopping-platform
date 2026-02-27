package com.sef.coshop.backend.controller;

import com.sef.coshop.backend.model.SharedListAddRequest;
import com.sef.coshop.backend.model.SharedListEvent;
import com.sef.coshop.backend.service.SharedListEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/extension/shared-list")
@RequiredArgsConstructor
public class SharedListExtensionController {

    private final SharedListEventService sharedListEventService;
    @Value("${app.extension.api-key:}")
    private String extensionApiKey;

    @PostMapping("/add")
    public SharedListEvent add(
            @RequestHeader(value = "X-Extension-Key", required = false) String apiKey,
            @RequestBody SharedListAddRequest request
    ) {
        validateApiKey(apiKey);
        return sharedListEventService.addEvent(request);
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
}
