package com.example.backend.api;

import com.example.backend.api.ApiModels.SitemapProduct;
import com.example.backend.api.ApiModels.SitemapResponse;
import com.example.backend.api.ApiModels.SitemapStorefront;
import com.example.backend.api.ApiModels.SitemapUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class SystemController {
    private final JdbcTemplate jdbc;

    public SystemController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/seo/sitemap")
    public SitemapResponse sitemap() {
        List<SitemapUser> users = jdbc.query(
                "SELECT id, updated_at FROM users ORDER BY id",
                (rs, rowNum) -> new SitemapUser(
                        rs.getObject("id", UUID.class), rs.getTimestamp("updated_at").toLocalDateTime()));
        List<SitemapStorefront> storefronts = jdbc.query(
                "SELECT slug, updated_at FROM storefronts ORDER BY slug",
                (rs, rowNum) -> new SitemapStorefront(
                        rs.getString("slug"), rs.getTimestamp("updated_at").toLocalDateTime()));
        List<SitemapProduct> products = jdbc.query("""
                SELECT s.slug AS storefront_slug, p.slug AS product_slug, p.updated_at
                FROM products p JOIN storefronts s ON s.id = p.storefront_id
                WHERE p.status = 'ACTIVE' ORDER BY s.slug, p.slug
                """, (rs, rowNum) -> new SitemapProduct(
                rs.getString("storefront_slug"), rs.getString("product_slug"),
                rs.getTimestamp("updated_at").toLocalDateTime()));
        return new SitemapResponse(users, storefronts, products);
    }
}
