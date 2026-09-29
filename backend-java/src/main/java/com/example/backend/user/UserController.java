package com.example.backend.user;

import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.UserResponse;
import com.example.backend.security.CurrentUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private static final Pattern EMAIL = Pattern.compile("^\\S+@\\S+\\.\\S+$");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public UserController(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal CurrentUser currentUser) {
        requireUser(currentUser);
        return find(currentUser.id());
    }

    @PatchMapping("/me")
    public UserResponse update(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(currentUser);
        List<String> assignments = new ArrayList<>();
        List<Object> arguments = new ArrayList<>();

        addRequiredText(body, "firstName", "first_name", 30, assignments, arguments);
        addRequiredText(body, "lastName", "last_name", 40, assignments, arguments);
        addRequiredText(body, "displayName", "display_name", 100, assignments, arguments);

        if (body.containsKey("email")) {
            String email = body.get("email") instanceof String value ? value.trim().toLowerCase() : "";
            if (!EMAIL.matcher(email).matches() || email.length() > 255) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "A valid email is required");
            }
            assignments.add("email = ?");
            arguments.add(email);
        }

        if (body.containsKey("bio")) {
            Object raw = body.get("bio");
            if (raw != null && !(raw instanceof String)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Bio must be a string or null");
            }
            String bio = raw == null ? null : ((String) raw).trim();
            if (bio != null && bio.length() > 1000) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Bio must be 1000 characters or fewer");
            }
            assignments.add("bio = ?");
            arguments.add(bio == null || bio.isEmpty() ? null : bio);
        }

        if (body.containsKey("password")) {
            String password = body.get("password") instanceof String value ? value : "";
            if (password.length() < 8 || password.length() > 72) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be between 8 and 72 characters");
            }
            assignments.add("password_hash = ?");
            arguments.add(passwordEncoder.encode(password));
        }

        if (assignments.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No profile fields supplied");
        }

        arguments.add(currentUser.id());
        try {
            jdbc.update(
                    "UPDATE users SET " + String.join(", ", assignments) + ", updated_at = now() WHERE id = ?",
                    arguments.toArray()
            );
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "Email is already registered");
        }
        return find(currentUser.id());
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return find(id);
    }

    private UserResponse find(UUID id) {
        return UserQueries.findById(jdbc, id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void addRequiredText(
            Map<String, Object> body,
            String input,
            String column,
            int maximum,
            List<String> assignments,
            List<Object> arguments
    ) {
        if (!body.containsKey(input)) return;
        String value = body.get(input) instanceof String text ? text.trim() : "";
        if (value.isEmpty() || value.length() > maximum) {
            throw new ApiException(HttpStatus.BAD_REQUEST, input + " must be a non-empty string");
        }
        assignments.add(column + " = ?");
        arguments.add(value);
    }

    private void requireUser(CurrentUser user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
}
