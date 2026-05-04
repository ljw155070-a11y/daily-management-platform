package com.home.platform.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GeoIpService {

    private static final String API_URL = "http://ip-api.com/json/%s?fields=status,lat,lon,countryCode";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 간단한 IP → GeoLocation 캐시 (재시작 전까지 유지)
    private final ConcurrentHashMap<String, GeoLocation> cache = new ConcurrentHashMap<>();

    public GeoLocation lookup(String ip) {
        if (isLocalOrPrivate(ip)) {
            return GeoLocation.korea();
        }

        GeoLocation cached = cache.get(ip);
        if (cached != null) {
            return cached;
        }

        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(String.format(API_URL, ip)))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = objectMapper.readValue(res.body(), Map.class);

            if ("success".equals(body.get("status"))) {
                double lat = ((Number) body.get("lat")).doubleValue();
                double lng = ((Number) body.get("lon")).doubleValue();
                String countryCode = (String) body.get("countryCode");
                int level = mapLevelForCountry(countryCode);
                GeoLocation geo = new GeoLocation(lat, lng, countryCode, level);

                if (cache.size() < 2000) {
                    cache.put(ip, geo);
                }
                return geo;
            }
        } catch (Exception ignored) {
        }

        return GeoLocation.korea();
    }

    private boolean isLocalOrPrivate(String ip) {
        if (ip == null || ip.isBlank()) return true;
        return ip.equals("127.0.0.1")
                || ip.equals("::1")
                || ip.equals("0:0:0:0:0:0:0:1")
                || ip.startsWith("192.168.")
                || ip.startsWith("10.")
                || ip.startsWith("172.");
    }

    private int mapLevelForCountry(String countryCode) {
        if (countryCode == null) return 10;
        return switch (countryCode) {
            // 국토가 넓은 나라 → 더 넓게
            case "RU", "CA", "US", "CN", "AU", "BR" -> 8;
            // 한국
            case "KR" -> 12;
            // 소형 국가 (싱가포르, 모나코 등)
            case "SG", "MC", "LI", "SM", "VA" -> 12;
            // 중형 국가 (일본, 영국, 독일, 프랑스 등)
            default -> 10;
        };
    }

    public record GeoLocation(double lat, double lng, String countryCode, int mapLevel) {
        public static GeoLocation korea() {
            return new GeoLocation(36.5, 127.5, "KR", 12);
        }
    }
}
