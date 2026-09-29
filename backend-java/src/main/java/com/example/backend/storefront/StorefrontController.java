package com.example.backend.storefront;

import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.StorefrontResponse;
import com.example.backend.security.CurrentUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/storefronts")
public class StorefrontController {
    private static final Set<String> THEMES = Set.of("theme-1", "theme-2", "theme-3", "theme-4", "theme-5");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final String SELECT = """
            SELECT s.id, s.owner_id, s.name, s.slug, s.description, s.theme,
                   s.created_at, s.updated_at, u.display_name AS owner_display_name
            FROM storefronts s JOIN users u ON u.id = s.owner_id
            """;
    private static final RowMapper<StorefrontResponse> MAPPER = (rs, rowNum) -> new StorefrontResponse(
            rs.getObject("id", UUID.class),
            rs.getObject("owner_id", UUID.class),
            rs.getString("name"),
            rs.getString("slug"),
            rs.getString("description"),
            rs.getString("theme"),
            rs.getTimestamp("created_at").toLocalDateTime(),
            rs.getTimestamp("updated_at").toLocalDateTime(),
            rs.getString("owner_display_name")
    );

    private final JdbcTemplate jdbc;

    public StorefrontController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<StorefrontResponse> list(@RequestParam(defaultValue = "") String q) {
        String query = q.trim();
        if (query.isEmpty()) {
            return jdbc.query(SELECT + " ORDER BY s.created_at DESC", MAPPER);
        }
        String pattern = "%" + query + "%";
        return jdbc.query(
                SELECT + " WHERE s.name ILIKE ? OR s.description ILIKE ? OR s.slug ILIKE ? ORDER BY s.created_at DESC",
                MAPPER,
                pattern, pattern, pattern
        );
    }

    @GetMapping("/mine")
    public List<StorefrontResponse> mine(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);
        return jdbc.query(SELECT + " WHERE s.owner_id = ? ORDER BY s.created_at DESC", MAPPER, user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StorefrontResponse create(
            @AuthenticationPrincipal CurrentUser user,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);
        String name = requiredText(body.get("name"), "Name is required", 150);
        String slug = body.get("slug") instanceof String value ? value : "";
        String theme = body.get("theme") instanceof String value ? value : "theme-1";
        String description = nullableText(body.get("description"), "Description must be a string or null", 1000);

        if (!SLUG.matcher(slug).matches() || slug.length() > 150 || theme == null || !THEMES.contains(theme)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Name, a lowercase URL slug, and a valid theme are required");
        }

        UUID id = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO storefronts (id, owner_id, name, slug, description, theme) VALUES (?, ?, ?, ?, ?, ?)",
                    id, user.id(), name, slug, description, theme
            );
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "Slug is already in use");
        }
        return findById(id);
    }

    @GetMapping("/{slug}")
    public StorefrontResponse get(@PathVariable String slug) {
        return jdbc.query(SELECT + " WHERE s.slug = ?", MAPPER, slug).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Storefront not found"));
    }

    @PatchMapping("/{id}")
    public StorefrontResponse update(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);
        List<String> assignments = new ArrayList<>();
        List<Object> arguments = new ArrayList<>();

        if (body.containsKey("name")) {
            assignments.add("name = ?");
            arguments.add(requiredText(body.get("name"), "Name must be a non-empty string", 150));
        }
        if (body.containsKey("slug")) {
            String slug = body.get("slug") instanceof String value ? value : "";
            if (!SLUG.matcher(slug).matches() || slug.length() > 150) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Slug must use lowercase letters, numbers, and hyphens");
            }
            assignments.add("slug = ?");
            arguments.add(slug);
        }
        if (body.containsKey("description")) {
            assignments.add("description = ?");
            arguments.add(nullableText(body.get("description"), "Description must be a string or null", 1000));
        }
        if (body.containsKey("theme")) {
            String theme = body.get("theme") instanceof String value ? value : "";
            if (theme == null || !THEMES.contains(theme)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "A valid theme is required");
            }
            assignments.add("theme = ?");
            arguments.add(theme);
        }
        if (assignments.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No storefront fields supplied");
        }

        arguments.add(id);
        arguments.add(user.id());
        try {
            int changed = jdbc.update(
                    "UPDATE storefronts SET " + String.join(", ", assignments)
                            + ", updated_at = now() WHERE id = ? AND owner_id = ?",
                    arguments.toArray()
            );
            if (changed == 0) {
                throw new ApiException(HttpStatus.NOT_FOUND, "Storefront not found or not owned by you");
            }
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "Slug is already in use");
        }
        return findById(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        requireUser(user);
        Integer owned = jdbc.queryForObject(
                "SELECT COUNT(*) FROM storefronts WHERE id = ? AND owner_id = ?", Integer.class, id, user.id());
        if (owned == null || owned == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Storefront not found or not owned by you");
        }
        Integer products = jdbc.queryForObject(
                "SELECT COUNT(*) FROM products WHERE storefront_id = ?", Integer.class, id);
        if (products != null && products > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Storefronts with products cannot be deleted");
        }
        jdbc.update("DELETE FROM storefronts WHERE id = ?", id);
    }

    private StorefrontResponse findById(UUID id) {
        return jdbc.query(SELECT + " WHERE s.id = ?", MAPPER, id).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Storefront not found"));
    }

    private String requiredText(Object raw, String message, int maximum) {
        String value = raw instanceof String text ? text.trim() : "";
        if (value.isEmpty() || value.length() > maximum) throw new ApiException(HttpStatus.BAD_REQUEST, message);
        return value;
    }

    private String nullableText(Object raw, String message, int maximum) {
        if (raw == null) return null;
        if (!(raw instanceof String text)) throw new ApiException(HttpStatus.BAD_REQUEST, message);
        String value = text.trim();
        if (value.length() > maximum) throw new ApiException(HttpStatus.BAD_REQUEST, message);
        return value.isEmpty() ? null : value;
    }

    private void requireUser(CurrentUser user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
}
