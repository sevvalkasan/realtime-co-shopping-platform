package com.sef.coshop.backend.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SharedListAddRequest {
    private String roomId;
    private String addedBy;
    private String title;
    private String url;
    private String image;
    private String price;
}
