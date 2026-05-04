package com.home.platform.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.util.List;
import java.util.Map;

@ControllerAdvice
public class GlobalModelAttributes {

    private final JdbcTemplate jdbcTemplate;

    public GlobalModelAttributes(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @ModelAttribute("authenticated")
    public boolean authenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }

    @ModelAttribute("currentDisplayName")
    public String currentDisplayName(Authentication authentication) {
        if (!authenticated(authentication)) {
            return "";
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "select DISPLAY_NAME from APP_USER where USERNAME = ?",
                authentication.getName()
        );

        if (rows.isEmpty()) {
            return authentication.getName();
        }

        return (String) rows.get(0).get("DISPLAY_NAME");
    }

    @ModelAttribute("currentPath")
    public String currentPath(HttpServletRequest request) {
        return request.getRequestURI();
    }
}
