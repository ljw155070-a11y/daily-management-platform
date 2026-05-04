package com.home.platform.travel;

import com.home.platform.config.GeoIpService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller
public class TravelPlaceController {

    private final TravelPlaceService service;
    private final GeoIpService geoIpService;

    @Value("${kakao.maps.api-key:}")
    private String kakaoApiKey;

    public TravelPlaceController(TravelPlaceService service, GeoIpService geoIpService) {
        this.service = service;
        this.geoIpService = geoIpService;
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
        model.addAttribute("mapLat", geo.lat());
        model.addAttribute("mapLng", geo.lng());
        model.addAttribute("mapLevel", geo.mapLevel());
        return "travel/index";
    }

    @PostMapping("/travel/places")
    @ResponseBody
    public ResponseEntity<TravelPlaceDto> save(Authentication authentication, @RequestBody TravelPlaceSaveRequest req) {
        return ResponseEntity.ok(service.save(req, authentication.getName()));
    }

    @PatchMapping("/travel/places/{id}")
    @ResponseBody
    public ResponseEntity<TravelPlaceDto> update(Authentication authentication, @PathVariable Long id,
                                                  @RequestBody TravelPlaceSaveRequest req) {
        return ResponseEntity.ok(service.update(id, req, authentication.getName()));
    }

    @DeleteMapping("/travel/places/{id}")
    @ResponseBody
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable Long id) {
        service.delete(id, authentication.getName());
        return ResponseEntity.ok().build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = request.getHeader("X-Real-IP");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        if (ip != null && ip.contains(",")) ip = ip.split(",")[0].trim();
        return ip;
    }
}
