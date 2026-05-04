package com.home.platform.auth;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Locale;

@Service
public class AppUserService {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final MessageSource messageSource;

    public AppUserService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            MessageSource messageSource
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.messageSource = messageSource;
    }

    @Transactional
    public void register(RegisterRequest request) {
        Locale locale = LocaleContextHolder.getLocale();
        String username = normalize(request.getUsername());
        String displayName = normalize(request.getDisplayName());
        String password = request.getPassword() == null ? "" : request.getPassword().trim();
        String confirmPassword = request.getConfirmPassword() == null ? "" : request.getConfirmPassword().trim();

        if (!StringUtils.hasText(username)) {
            throw new IllegalArgumentException(msg("auth.error.username.required", locale));
        }
        if (!username.matches("[a-zA-Z0-9._-]{4,20}")) {
            throw new IllegalArgumentException(msg("auth.error.username.pattern", locale));
        }
        if (!StringUtils.hasText(displayName)) {
            throw new IllegalArgumentException(msg("auth.error.displayName.required", locale));
        }
        if (displayName.length() < 2 || displayName.length() > 20) {
            throw new IllegalArgumentException(msg("auth.error.displayName.length", locale));
        }
        if (password.length() < 8) {
            throw new IllegalArgumentException(msg("auth.error.password.length", locale));
        }
        if (!password.equals(confirmPassword)) {
            throw new IllegalArgumentException(msg("auth.error.password.confirm", locale));
        }
        Integer existing = jdbcTemplate.queryForObject(
                "select count(*) from APP_USER where USERNAME = ?",
                Integer.class,
                username
        );
        if (existing != null && existing > 0) {
            throw new IllegalArgumentException(msg("auth.error.username.duplicate", locale));
        }

        jdbcTemplate.update(
                """
                INSERT INTO APP_USER (
                    ID, USERNAME, PASSWORD_HASH, DISPLAY_NAME, ROLE, CREATED_AT
                ) VALUES (
                    APP_USER_SEQ.NEXTVAL, ?, ?, ?, 'ROLE_USER', SYSTIMESTAMP
                )
                """,
                username,
                passwordEncoder.encode(password),
                displayName
        );
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String msg(String code, Locale locale) {
        return messageSource.getMessage(code, null, locale);
    }
}
