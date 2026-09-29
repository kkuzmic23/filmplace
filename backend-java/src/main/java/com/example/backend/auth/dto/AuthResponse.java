package com.example.backend.auth.dto;

import com.example.backend.api.ApiModels.UserResponse;

public record AuthResponse(
        String tokenType,
        String accessToken,
        long expiresIn,
        UserResponse user
) {
}
