package com.home.platform.travel;

import com.home.platform.config.GeoIpService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.file.Path;
import java.util.Map;
import java.util.List;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class TravelPlaceController {

    private final TravelPlaceService service;
    private final GeoIpService geoIpService;
    private final SgisService sgisService;
    private final PublicTravelAttractionService publicTravelAttractionService;
    private final TravelPlaceImageStorageService imageStorageService;

    @Value("${kakao.maps.api-key:}")
    private String kakaoApiKey;

    public TravelPlaceController(TravelPlaceService service, GeoIpService geoIpService, SgisService sgisService,
                                 PublicTravelAttractionService publicTravelAttractionService,
                                 TravelPlaceImageStorageService imageStorageService) {
        this.service = service;
        this.geoIpService = geoIpService;
        this.sgisService = sgisService;
        this.publicTravelAttractionService = publicTravelAttractionService;
        this.imageStorageService = imageStorageService;
    }

    @GetMapping("/travel")
    public String travel(Authentication authentication, Model model, HttpServletRequest request) {
        String userId = authentication.getName();
        List<TravelPlaceDto> places = service.getPlacesByUser(userId);

        String ip = resolveClientIp(request);
        GeoIpService.GeoLocation geo = geoIpService.lookup(ip);

        model.addAttribute("activeTab", "travel");
        model.addAttribute("places", places);
        model.addAttribute("kakaoApiKey", kakaoApiKey);
        model.addAttribute("tourApiEnabled", publicTravelAttractionService.isAvailable());
        model.addAttribute("mapLat", geo.lat());
        model.addAttribute("mapLng", geo.lng());
        model.addAttribute("mapLevel", geo.mapLevel());
        return "travel/index";
    }

    @PostMapping("/travel/places")
    @ResponseBody
    public ResponseEntity<TravelPlaceDto> save(Authentication authentication, @ModelAttribute TravelPlaceFormRequest req) {
        return ResponseEntity.ok(service.save(req, authentication.getName()));
    }

    @PatchMapping("/travel/places/{id}")
    @ResponseBody
    public ResponseEntity<TravelPlaceDto> update(Authentication authentication, @PathVariable Long id,
                                                 @ModelAttribute TravelPlaceFormRequest req) {
        return ResponseEntity.ok(service.update(id, req, authentication.getName()));
    }

    @DeleteMapping("/travel/places/{id}")
    @ResponseBody
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        service.delete(id, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/provinces")
    @ResponseBody
    public ResponseEntity<String> getProvinces() {
        try {
            String geoJson = sgisService.getProvinceBoundariesAsGeoJson();
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(geoJson);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/api/cities")
    @ResponseBody
    public ResponseEntity<String> getCities() {
        try {
            String geoJson = sgisService.getCityBoundariesAsGeoJson();
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(geoJson);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/api/tourism/attractions")
    @ResponseBody
    public ResponseEntity<?> getAttractions() {
        try {
            return ResponseEntity.ok(publicTravelAttractionService.getAllAttractions());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/api/tourism/attractions/region")
    @ResponseBody
    public ResponseEntity<?> getAttractionsByRegion(@RequestParam(required = false) String province,
                                                    @RequestParam(required = false) String region) {
        try {
            String requestedRegion = (region != null && !region.isBlank()) ? region : province;
            return ResponseEntity.ok(publicTravelAttractionService.getAttractionsByRegion(requestedRegion));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/tourism/attractions/sync")
    @ResponseBody
    public ResponseEntity<?> syncAttractions() {
        try {
            int syncedCount = publicTravelAttractionService.syncAllAttractions();
            return ResponseEntity.ok(Map.of(
                    "syncedCount", syncedCount,
                    "activeCount", publicTravelAttractionService.countActiveAttractions()
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/api/tourism/attractions/{contentId}/coordinates")
    @ResponseBody
    public ResponseEntity<?> updateAttractionCoordinates(@PathVariable String contentId,
                                                         @RequestBody Map<String, Object> body) {
        try {
            Double latitude = body.get("latitude") instanceof Number number ? number.doubleValue() : null;
            Double longitude = body.get("longitude") instanceof Number number ? number.doubleValue() : null;
            String reason = body.get("reason") instanceof String text ? text : null;
            return ResponseEntity.ok(publicTravelAttractionService.updateCoordinates(contentId, latitude, longitude, reason));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/travel/place-images/{fileName:.+}")
    @ResponseBody
    public ResponseEntity<Resource> getPlaceImage(@PathVariable String fileName) {
        try {
            Path path = imageStorageService.resolve(fileName);
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            MediaType mediaType = MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
            return ResponseEntity.ok().contentType(mediaType).body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = request.getHeader("X-Real-IP");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        if (ip != null && ip.contains(",")) ip = ip.split(",")[0].trim();
        return ip;
    }
}
