package com.home.platform.auth;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final JdbcTemplate jdbcTemplate;

    public CustomUserDetailsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "select USERNAME, PASSWORD_HASH, ROLE from APP_USER where USERNAME = ?",
                username
        );

        if (rows.isEmpty()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        Map<String, Object> user = rows.get(0);

        return new User(
                (String) user.get("USERNAME"),
                (String) user.get("PASSWORD_HASH"),
                List.of(new SimpleGrantedAuthority((String) user.get("ROLE")))
        );
    }
}
