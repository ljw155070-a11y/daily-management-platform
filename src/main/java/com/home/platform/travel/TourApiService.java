package com.home.platform.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class TourApiService {

    private static final List<String> AREA_CODES = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8",
            "31", "32", "33", "34", "35", "36", "37", "38", "39"
    );
    private static final Duration CACHE_TTL = Duration.ofHours(6);

    @Value("${tourapi.service-key:}")
    private String serviceKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private Instant cacheExpiry = Instant.MIN;
    private List<TourApiAttractionDto> cachedAttractions = List.of();

    public boolean isEnabled() {
        return serviceKey != null && !serviceKey.isBlank();
    }

    public synchronized List<TourApiAttractionDto> getNationwideAttractions() throws Exception {
        if (!isEnabled()) {
            throw new IllegalStateException("TourAPI service key is not configured.");
        }

        if (Instant.now().isBefore(cacheExpiry) && !cachedAttractions.isEmpty()) {
            return cachedAttractions;
        }

        List<TourApiAttractionDto> attractions = new ArrayList<>();
        for (String areaCode : AREA_CODES) {
            attractions.addAll(fetchAreaAttractions(areaCode));
        }

        cachedAttractions = attractions;
        cacheExpiry = Instant.now().plus(CACHE_TTL);
        return cachedAttractions;
    }

    private List<TourApiAttractionDto> fetchAreaAttractions(String areaCode) throws Exception {
        String url = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
                + "?serviceKey=" + serviceKey
                + "&numOfRows=12"
                + "&pageNo=1"
                + "&MobileOS=ETC"
                + "&MobileApp=DailyHub"
                + "&_type=json"
                + "&arrange=A"
                + "&contentTypeId=12"
                + "&areaCode=" + encode(areaCode);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("TourAPI request failed: HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode itemsNode = root.path("response").path("body").path("items").path("item");
        List<TourApiAttractionDto> result = new ArrayList<>();

        if (itemsNode.isMissingNode() || itemsNode.isNull()) {
            return result;
        }

        if (itemsNode.isArray()) {
            for (JsonNode item : itemsNode) {
                TourApiAttractionDto dto = toDto(item);
                if (dto != null) {
                    result.add(dto);
                }
            }
            return result;
        }

        TourApiAttractionDto dto = toDto(itemsNode);
        if (dto != null) {
            result.add(dto);
        }
        return result;
    }

    private TourApiAttractionDto toDto(JsonNode item) {
        String contentId = text(item, "contentid");
        String title = text(item, "title");
        String address = firstNonBlank(text(item, "addr1"), text(item, "addr2"));
        Double latitude = number(item, "mapy");
        Double longitude = number(item, "mapx");

        if (contentId == null || title == null || latitude == null || longitude == null) {
            return null;
        }

        return new TourApiAttractionDto(
                contentId,
                title,
                address == null ? "" : address,
                firstNonBlank(text(item, "firstimage"), text(item, "firstimage2")),
                latitude,
                longitude,
                text(item, "areacode")
        );
    }

    private String text(JsonNode node, String field) {
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    private Double number(JsonNode node, String field) {
        String raw = node.path(field).asText("").trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return null;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
