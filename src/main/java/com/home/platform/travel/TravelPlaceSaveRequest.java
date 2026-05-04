package com.home.platform.travel;

public record TravelPlaceSaveRequest(
        String category,
        String placeName,
        String address,
        String review,
        Double latitude,
        Double longitude
) {}
