package com.home.platform.auth;

import com.home.platform.finance.FinanceCategoryService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AuthDataInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final FinanceCategoryService financeCategoryService;

    public AuthDataInitializer(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            FinanceCategoryService financeCategoryService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.financeCategoryService = financeCategoryService;
    }

    @Override
    public void run(String... args) {
        Integer count = jdbcTemplate.queryForObject("select count(*) from APP_USER", Integer.class);
        if (count != null && count == 0) {
            jdbcTemplate.update(
                    """
                    INSERT INTO APP_USER (
                        ID, USERNAME, PASSWORD_HASH, DISPLAY_NAME, ROLE, CREATED_AT
                    ) VALUES (
                        APP_USER_SEQ.NEXTVAL, ?, ?, ?, 'ROLE_USER', SYSTIMESTAMP
                    )
                    """,
                    "homehub",
                    passwordEncoder.encode("homehub123!"),
                    "HomeHub Admin"
            );
        }

        financeCategoryService.initDefaultCategories("homehub");
    }
}
