package com.example.backend.auth;

import com.example.backend.auth.dto.AuthResponse;
import com.example.backend.auth.dto.LoginRequest;
import com.example.backend.auth.dto.RegisterRequest;
import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.UserResponse;
import com.example.backend.security.CurrentUser;
import com.example.backend.security.JwtService;
import com.example.backend.user.UserQueries;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        UUID id = UUID.randomUUID();

        try {
            jdbc.update(
                    "INSERT INTO users (id, first_name, last_name, display_name, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
                    id,
                    request.firstName().trim(),
                    request.lastName().trim(),
                    request.displayName().trim(),
                    email,
                    passwordEncoder.encode(request.password())
            );
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "Email is already registered");
        }
        return toAuthResponse(UserQueries.findById(jdbc, id)
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "User could not be created")));
    }

    public AuthResponse login(LoginRequest request) {
        UserResponse user = UserQueries.findByEmail(jdbc, request.email().trim().toLowerCase()).orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        String passwordHash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, user.id());

        if (!passwordEncoder.matches(request.password(), passwordHash)) {
            throw new BadCredentialsException("Invalid email or password");
        }

        return toAuthResponse(user);
    }

    private AuthResponse toAuthResponse(UserResponse user) {
        CurrentUser principal = new CurrentUser(user.id(), user.email(), "", user.role());
        String token = jwtService.generateToken(principal);
        return new AuthResponse("Bearer", token, jwtService.getExpirationSeconds(), user);
    }
}
