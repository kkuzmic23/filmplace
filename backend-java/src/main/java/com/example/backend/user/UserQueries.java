package com.example.backend.user;

import com.example.backend.api.ApiModels.UserResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.Optional;
import java.util.UUID;

public final class UserQueries {
    private UserQueries() {}

    public static final String FIELDS = """
            id, first_name, last_name, display_name, email, bio,
            reputation_score, role, created_at, updated_at
            """;

    public static final RowMapper<UserResponse> MAPPER = (rs, rowNum) -> new UserResponse(
            rs.getObject("id", UUID.class),
            rs.getString("first_name"),
            rs.getString("last_name"),
            rs.getString("display_name"),
            rs.getString("email"),
            rs.getString("bio"),
            rs.getInt("reputation_score"),
            rs.getString("role"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime()
    );

    public static Optional<UserResponse> findById(JdbcTemplate jdbc, UUID id) {
        return jdbc.query("SELECT " + FIELDS + " FROM users WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public static Optional<UserResponse> findByEmail(JdbcTemplate jdbc, String email) {
        return jdbc.query("SELECT " + FIELDS + " FROM users WHERE email = ?", MAPPER, email).stream().findFirst();
    }
}
