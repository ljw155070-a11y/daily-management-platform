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
import java.util.Map;

@Service
public class TourApiService {

    private static final int TOUR_API_PAGE_SIZE = 100;
    private static final int TOUR_API_MAX_PAGES = 100;
    private static final int MAX_RETRIES_ON_429 = 4;
    private static final long REQUEST_DELAY_MS = 180L;
    private static final long RETRY_BASE_DELAY_MS = 1_200L;

    private static final List<String> AREA_CODES = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8",
            "31", "32", "33", "34", "35", "36", "37", "38", "39"
    );

    private static final Duration CACHE_TTL = Duration.ofHours(6);

    private static final Map<String, String> PROVINCE_TO_AREA_CODE = Map.ofEntries(
            Map.entry("서울특별시", "1"),
            Map.entry("서울", "1"),
            Map.entry("인천광역시", "2"),
            Map.entry("인천", "2"),
            Map.entry("대전광역시", "3"),
            Map.entry("대전", "3"),
            Map.entry("대구광역시", "4"),
            Map.entry("대구", "4"),
            Map.entry("광주광역시", "5"),
            Map.entry("광주", "5"),
            Map.entry("부산광역시", "6"),
            Map.entry("부산", "6"),
            Map.entry("울산광역시", "7"),
            Map.entry("울산", "7"),
            Map.entry("세종특별자치시", "8"),
            Map.entry("세종", "8"),
            Map.entry("경기도", "31"),
            Map.entry("경기", "31"),
            Map.entry("강원특별자치도", "32"),
            Map.entry("강원도", "32"),
            Map.entry("강원", "32"),
            Map.entry("충청북도", "33"),
            Map.entry("충북", "33"),
            Map.entry("충청남도", "34"),
            Map.entry("충남", "34"),
            Map.entry("경상북도", "35"),  // TourAPI 실제 코드: 35=경북
            Map.entry("경북", "35"),
            Map.entry("경상남도", "36"),  // TourAPI 실제 코드: 36=경남
            Map.entry("경남", "36"),
            Map.entry("전북특별자치도", "37"),  // TourAPI 실제 코드: 37=전북
            Map.entry("전라북도", "37"),
            Map.entry("전북", "37"),
            Map.entry("전라남도", "38"),  // TourAPI 실제 코드: 38=전남
            Map.entry("전남", "38"),
            Map.entry("제주특별자치도", "39"),
            Map.entry("제주도", "39"),
            Map.entry("제주", "39")
    );

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

    public List<TourApiAttractionDto> getAttractionsByProvince(String provinceName) throws Exception {
        if (!isEnabled()) {
            throw new IllegalStateException("TourAPI service key is not configured.");
        }
        String areaCode = getAreaCodeForProvince(provinceName);
        if (areaCode == null) {
            return List.of();
        }
        return fetchAreaAttractions(areaCode);
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
            sleepQuietly(REQUEST_DELAY_MS);
        }

        cachedAttractions = attractions;
        cacheExpiry = Instant.now().plus(CACHE_TTL);
        return cachedAttractions;
    }

    public static String getAreaCodeForProvince(String provinceName) {
        return PROVINCE_TO_AREA_CODE.get(normalizeProvinceName(provinceName));
    }

    public static String normalizeProvinceName(String provinceName) {
        String key = provinceName == null ? "" : provinceName.trim();
        if (key.contains(" ")) {
            key = key.substring(0, key.indexOf(' '));
        }
        return key;
    }

    private List<TourApiAttractionDto> fetchAreaAttractions(String areaCode) throws Exception {
        List<TourApiAttractionDto> result = new ArrayList<>();
        int totalCount = Integer.MAX_VALUE;

        for (int pageNo = 1; pageNo <= TOUR_API_MAX_PAGES; pageNo++) {
            JsonNode bodyNode = requestAreaPage(areaCode, pageNo);
            if (totalCount == Integer.MAX_VALUE) {
                totalCount = bodyNode.path("totalCount").asInt(0);
            }

            JsonNode itemsNode = bodyNode.path("items").path("item");
            if (itemsNode.isMissingNode() || itemsNode.isNull()) {
                break;
            }

            int addedOnThisPage = 0;
            if (itemsNode.isArray()) {
                for (JsonNode item : itemsNode) {
                    TourApiAttractionDto dto = toDto(item);
                    if (dto != null) {
                        result.add(dto);
                        addedOnThisPage++;
                    }
                }
            } else {
                TourApiAttractionDto dto = toDto(itemsNode);
                if (dto != null) {
                    result.add(dto);
                    addedOnThisPage++;
                }
            }

            if (addedOnThisPage == 0 || result.size() >= totalCount) {
                break;
            }

            sleepQuietly(REQUEST_DELAY_MS);
        }

        return result;
    }

    private JsonNode requestAreaPage(String areaCode, int pageNo) throws Exception {
        String url = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
                + "?serviceKey=" + serviceKey
                + "&numOfRows=" + TOUR_API_PAGE_SIZE
                + "&pageNo=" + pageNo
                + "&MobileOS=ETC"
                + "&MobileApp=DailyHub"
                + "&_type=json"
                + "&arrange=A"
                + "&contentTypeId=12"
                + "&areaCode=" + encode(areaCode);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .GET()
                .build();

        for (int attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int statusCode = response.statusCode();

            if (statusCode >= 200 && statusCode < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                return root.path("response").path("body");
            }

            if (statusCode == 429 && attempt < MAX_RETRIES_ON_429) {
                sleepQuietly(RETRY_BASE_DELAY_MS * (attempt + 1L));
                continue;
            }

            throw new IllegalStateException("TourAPI request failed: HTTP " + statusCode);
        }

        throw new IllegalStateException("TourAPI request failed: retry exhausted");
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

    private void sleepQuietly(long delayMillis) {
        try {
            Thread.sleep(delayMillis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("TourAPI sync interrupted.", exception);
        }
    }
}
