package com.example.backend.product;

import com.example.backend.api.ApiModels.ProductImageResponse;
import com.example.backend.api.ApiModels.ProductResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ProductRepository {
    static final String SELECT = """
            SELECT p.id, p.storefront_id, p.catalog_product_id, p.slug,
                   pc.product_type, pc.brand, pc.name, pc.format, pc.film_type AS catalog_film_type,
                   pc.camera_type, pc.accessory_type AS catalog_accessory_type,
                   COALESCE(p.title_override, pc.name) AS title, p.title_override, p.description,
                   p.price_cents, p.available_quantity, p.status, p.created_at, p.updated_at,
                   p.working_condition, p.has_mods, p.expiry_date, p.storage_condition,
                   pc.compatible_formats, s.name AS storefront_name, s.slug AS storefront_slug
            FROM products p
            JOIN storefronts s ON s.id = p.storefront_id
            JOIN product_catalog pc ON pc.id = p.catalog_product_id
            """;

    private final JdbcTemplate jdbc;

    public ProductRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ProductResponse> query(String suffix, Object... arguments) {
        return jdbc.query(SELECT + suffix, this::mapProduct, arguments).stream()
                .map(this::withImages)
                .toList();
    }

    public Optional<ProductResponse> findById(UUID id) {
        return query(" WHERE p.id = ?", id).stream().findFirst();
    }

    public boolean isOwner(UUID productId, UUID userId) {
        Integer count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM products p
                JOIN storefronts s ON s.id = p.storefront_id
                WHERE p.id = ? AND s.owner_id = ?
                """, Integer.class, productId, userId);
        return count != null && count > 0;
    }

    public List<ProductImageResponse> images(UUID productId) {
        return jdbc.query(
                "SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order",
                (rs, rowNum) -> new ProductImageResponse(
                        rs.getObject("id", UUID.class), rs.getString("image_url"), rs.getInt("sort_order")),
                productId
        );
    }

    private ProductResponse withImages(ProductResponse product) {
        return new ProductResponse(
                product.id(), product.storefrontId(), product.catalogProductId(), product.productSlug(),
                product.productType(), product.catalogBrand(), product.catalogName(), product.catalogFormat(),
                product.catalogFilmType(), product.catalogCameraType(), product.catalogAccessoryType(),
                product.title(), product.titleOverride(), product.description(), product.priceCents(),
                product.availableQuantity(), product.status(), product.createdAt(), product.updatedAt(),
                product.cameraModel(), product.cameraFormat(), product.workingCondition(), product.hasMods(),
                product.filmFormat(), product.filmType(), product.expiryDate(), product.storageCondition(),
                product.accessoryType(), product.compatibleFormats(), product.storefrontName(),
                product.storefrontSlug(), images(product.id())
        );
    }

    private ProductResponse mapProduct(ResultSet rs, int rowNum) throws SQLException {
        String type = rs.getString("product_type");
        String format = rs.getString("format");
        java.sql.Date expiry = rs.getDate("expiry_date");

        return new ProductResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("storefront_id", UUID.class),
                rs.getObject("catalog_product_id", UUID.class),
                rs.getString("slug"), type, rs.getString("brand"), rs.getString("name"), format,
                rs.getString("catalog_film_type"), rs.getString("camera_type"),
                rs.getString("catalog_accessory_type"), rs.getString("title"),
                rs.getString("title_override"), rs.getString("description"), rs.getInt("price_cents"),
                rs.getInt("available_quantity"), rs.getString("status"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getTimestamp("updated_at").toLocalDateTime(),
                "CAMERA".equals(type) ? rs.getString("name") : null,
                "CAMERA".equals(type) ? format : null,
                rs.getString("working_condition"), (Boolean) rs.getObject("has_mods"),
                "FILM".equals(type) ? format : null,
                "FILM".equals(type) ? rs.getString("catalog_film_type") : null,
                expiry == null ? null : expiry.toLocalDate(), rs.getString("storage_condition"),
                "ACCESSORY".equals(type) ? rs.getString("catalog_accessory_type") : null,
                rs.getString("compatible_formats"), rs.getString("storefront_name"),
                rs.getString("storefront_slug"), List.of()
        );
    }
}
