package com.home.platform.travel;

public record TourApiAttractionDto(
        String contentId,
        String title,
        String address,
        String imageUrl,
        Double latitude,
        Double longitude,
        String areaCode
) {
}
