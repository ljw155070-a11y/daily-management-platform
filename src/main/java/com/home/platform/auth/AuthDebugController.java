package com.home.platform.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/debug/auth")
public class AuthDebugController {

    private final AppUserService appUserService;
    private final JdbcTemplate jdbcTemplate;

    public AuthDebugController(
            AppUserService appUserService,
            JdbcTemplate jdbcTemplate
    ) {
        this.appUserService = appUserService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> authDebug(
            @RequestParam(name = "action", required = false) String action
    ) {
        Map<String, Object> body = new LinkedHashMap<>();

        if ("registerOnce".equals(action)) {
            try {
                String username = "debuguser" + System.currentTimeMillis();

                RegisterRequest request = new RegisterRequest();
                request.setUsername(username);
                request.setDisplayName("Debug User");
                request.setPassword("testpass123");
                request.setConfirmPassword("testpass123");

                appUserService.register(request);
                body.put("savedUsername", username);
                body.put("registerStatus", "ok");
            } catch (Exception ex) {
                body.put("registerStatus", "error");
                body.put("errorType", ex.getClass().getName());
                body.put("errorMessage", ex.getMessage());
            }
        }

        List<String> usernames = jdbcTemplate.query(
                "select USERNAME from APP_USER order by ID",
                (rs, rowNum) -> rs.getString(1)
        );
        body.put("count", usernames.size());
        body.put("usernames", usernames);
        body.put("jdbcCount", jdbcTemplate.queryForObject("select count(*) from APP_USER", Integer.class));
        return ResponseEntity.ok(body);
    }
}
