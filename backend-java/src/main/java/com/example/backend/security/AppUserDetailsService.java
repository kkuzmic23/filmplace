package com.example.backend.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AppUserDetailsService implements UserDetailsService {
    private final JdbcTemplate jdbc;

    public AppUserDetailsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return jdbc.query(
                        "SELECT id, email, password_hash, role FROM users WHERE email = ?",
                        (rs, rowNum) -> new CurrentUser(
                                rs.getObject("id", java.util.UUID.class),
                                rs.getString("email"),
                                rs.getString("password_hash"),
                                rs.getString("role")
                        ),
                        email.toLowerCase()
                ).stream()
                .findFirst()
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }
}
