package com.home.platform.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.locationtech.proj4j.CRSFactory;
import org.locationtech.proj4j.CoordinateReferenceSystem;
import org.locationtech.proj4j.CoordinateTransform;
import org.locationtech.proj4j.CoordinateTransformFactory;
import org.locationtech.proj4j.ProjCoordinate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

@Service
public class SgisService {

    public record GeoPoint(double lat, double lng) {}

    @Value("${sgis.consumer-key}")
    private String consumerKey;

    @Value("${sgis.consumer-secret}")
    private String consumerSecret;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String cachedToken = null;
    private Instant tokenExpiry = Instant.MIN;
    private String cachedBoundary = null;
    private String cachedCityBoundary = null;

    private static final CoordinateTransform UTMK_TO_WGS84;
    static {
        CRSFactory factory = new CRSFactory();
        CoordinateReferenceSystem utmk = factory.createFromParameters("EPSG:5179",
                "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs");
        CoordinateReferenceSystem wgs84 = factory.createFromParameters("WGS84",
                "+proj=longlat +datum=WGS84 +no_defs");
        UTMK_TO_WGS84 = new CoordinateTransformFactory().createTransform(utmk, wgs84);
    }

    private String convertCoordinates(JsonNode coords, String geoType) {
        if ("Polygon".equals(geoType)) {
            return convertRings(coords);
        } else if ("MultiPolygon".equals(geoType)) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < coords.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(convertRings(coords.get(i)));
            }
            return sb.append("]").toString();
        }
        return coords.toString();
    }

    private String convertRings(JsonNode rings) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < rings.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("[");
            JsonNode ring = rings.get(i);
            for (int j = 0; j < ring.size(); j++) {
                if (j > 0) sb.append(",");
                double x = ring.get(j).get(0).asDouble();
                double y = ring.get(j).get(1).asDouble();
                double[] wgs = toWgs84(x, y);
                sb.append(String.format("[%.6f,%.6f]", wgs[0], wgs[1]));
            }
            sb.append("]");
        }
        return sb.append("]").toString();
    }

    private double[] toWgs84(double x, double y) {
        ProjCoordinate src = new ProjCoordinate(x, y);
        ProjCoordinate dst = new ProjCoordinate();
        UTMK_TO_WGS84.transform(src, dst);
        return new double[]{dst.x, dst.y}; // [lng, lat]
    }

    private String getAccessToken() throws Exception {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry)) {
            return cachedToken;
        }
        String url = "https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json"
                + "?consumer_key=" + consumerKey
                + "&consumer_secret=" + consumerSecret;

        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url))
                .timeout(Duration.ofSeconds(10)).GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

        JsonNode root = objectMapper.readTree(res.body());
        if (root.path("errCd").asInt() != 0) {
            throw new RuntimeException("SGIS 인증 실패: " + root.path("errMsg").asText());
        }
        cachedToken = root.path("result").path("accessToken").asText();
        tokenExpiry = Instant.now().plusSeconds(3500);
        return cachedToken;
    }

    public GeoPoint geocodeAddressWgs84(String address) throws Exception {
        if (address == null || address.isBlank()) {
            return null;
        }

        String token = getAccessToken();
        String url = "https://sgisapi.mods.go.kr/OpenAPI3/addr/geocodewgs84.json"
                + "?accessToken=" + token
                + "&address=" + java.net.URLEncoder.encode(address, java.nio.charset.StandardCharsets.UTF_8)
                + "&pagenum=0&resultcount=1";

        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url))
                .timeout(Duration.ofSeconds(15)).GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

        JsonNode root = objectMapper.readTree(res.body());
        if (root.path("errCd").asInt() != 0) {
            return null;
        }

        JsonNode resultData = root.path("result").path("resultdata");
        if (!resultData.isArray() || resultData.isEmpty()) {
            return null;
        }

        JsonNode first = resultData.get(0);
        String y = first.path("y").asText("").trim();
        String x = first.path("x").asText("").trim();
        if (x.isEmpty() || y.isEmpty()) {
            return null;
        }

        return new GeoPoint(Double.parseDouble(y), Double.parseDouble(x));
    }

    public String getProvinceBoundariesAsGeoJson() throws Exception {
        if (cachedBoundary != null) return cachedBoundary;

        String token = getAccessToken();
        String url = "https://sgisapi.mods.go.kr/OpenAPI3/boundary/hadmarea.geojson"
                + "?accessToken=" + token
                + "&year=2024&adm_cd=0&low_search=1";

        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url))
                .timeout(Duration.ofSeconds(15)).GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

        // UTM-K 좌표 → WGS84 변환 후 GeoJSON FeatureCollection 반환
        JsonNode root = objectMapper.readTree(res.body());
        JsonNode features = root.path("features");

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"FeatureCollection\",\"features\":[");
        for (int i = 0; i < features.size(); i++) {
            JsonNode f = features.get(i);
            String admNm = f.path("properties").path("adm_nm").asText();
            JsonNode geometry = f.path("geometry");
            String geoType = geometry.path("type").asText();
            JsonNode coordinates = geometry.path("coordinates");

            if (i > 0) sb.append(",");
            sb.append("{\"type\":\"Feature\",\"properties\":{\"name\":\"").append(admNm).append("\"},");
            sb.append("\"geometry\":{\"type\":\"").append(geoType).append("\",\"coordinates\":");
            sb.append(convertCoordinates(coordinates, geoType));
            sb.append("}}");
        }
        sb.append("]}");

        cachedBoundary = sb.toString();
        return cachedBoundary;
    }

    public String getCityBoundariesAsGeoJson() throws Exception {
        if (cachedCityBoundary != null) return cachedCityBoundary;

        String token = getAccessToken();

        // 1단계: 시/도 목록을 가져와 각 시/도의 실제 adm_cd 코드를 수집
        String provUrl = "https://sgisapi.mods.go.kr/OpenAPI3/boundary/hadmarea.geojson"
                + "?accessToken=" + token + "&year=2024&adm_cd=0&low_search=1";
        HttpRequest provReq = HttpRequest.newBuilder().uri(URI.create(provUrl))
                .timeout(Duration.ofSeconds(15)).GET().build();
        HttpResponse<String> provRes = httpClient.send(provReq, HttpResponse.BodyHandlers.ofString());

        JsonNode provRoot = objectMapper.readTree(provRes.body());
        List<String> provinceCodes = new ArrayList<>();
        for (JsonNode f : provRoot.path("features")) {
            String admCd = f.path("properties").path("adm_cd").asText();
            if (admCd != null && !admCd.isBlank()) {
                provinceCodes.add(admCd);
            }
        }

        // 2단계: 각 시/도 코드로 하위 시/군/구 경계를 수집
        List<String> featureList = new ArrayList<>();
        for (String code : provinceCodes) {
            String url = "https://sgisapi.mods.go.kr/OpenAPI3/boundary/hadmarea.geojson"
                    + "?accessToken=" + token
                    + "&year=2024&adm_cd=" + code + "&low_search=1";
            try {
                HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url))
                        .timeout(Duration.ofSeconds(15)).GET().build();
                HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

                JsonNode root = objectMapper.readTree(res.body());
                JsonNode features = root.path("features");

                for (int i = 0; i < features.size(); i++) {
                    JsonNode f = features.get(i);
                    String admNm = f.path("properties").path("adm_nm").asText()
                                    .replace("\\", "\\\\").replace("\"", "\\\"");
                    JsonNode geometry = f.path("geometry");
                    String geoType = geometry.path("type").asText();
                    JsonNode coordinates = geometry.path("coordinates");

                    featureList.add(
                        "{\"type\":\"Feature\",\"properties\":{\"name\":\"" + admNm + "\"}," +
                        "\"geometry\":{\"type\":\"" + geoType + "\",\"coordinates\":" +
                        convertCoordinates(coordinates, geoType) + "}}"
                    );
                }
            } catch (Exception ignored) {
                // 일부 지역 실패 시 나머지는 계속 진행
            }
        }

        cachedCityBoundary = "{\"type\":\"FeatureCollection\",\"features\":["
                + String.join(",", featureList) + "]}";
        return cachedCityBoundary;
    }
}
