package com.sef.coshop.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SharedListEvent {
    private long id;
    private String roomId;
    private String addedBy;
    private String title;
    private String url;
    private String image;
    private String price;
    private Instant createdAt;
}
