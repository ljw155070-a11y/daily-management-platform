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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

@Service
public class SgisService {

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
}
