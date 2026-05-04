package com.home.platform.travel;

import java.time.format.DateTimeFormatter;

public record TravelPlaceDto(
        Long   id,
        String userId,
        String category,
        String placeName,
        String address,
        String review,
        String imageUrl,
        Double latitude,
        Double longitude,
        String createdAt
) {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public static TravelPlaceDto from(TravelPlace p) {
        return new TravelPlaceDto(
                p.getId(),
                p.getUserId(),
                p.getCategory(),
                p.getPlaceName(),
                p.getAddress(),
                p.getReview(),
                p.getImageUrl(),
                p.getLatitude(),
                p.getLongitude(),
                p.getCreatedAt() != null ? p.getCreatedAt().format(FMT) : ""
        );
    }
}
