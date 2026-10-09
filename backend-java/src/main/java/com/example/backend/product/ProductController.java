package com.example.backend.product;

import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.CatalogProductResponse;
import com.example.backend.api.ApiModels.CatalogStatistics;
import com.example.backend.api.ApiModels.ProductImageResponse;
import com.example.backend.api.ApiModels.ProductResponse;
import com.example.backend.api.ApiModels.TopSellingProduct;
import com.example.backend.security.CurrentUser;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
public class ProductController {
    private static final Set<String> TYPES = Set.of("CAMERA", "FILM", "ACCESSORY");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "SOLD", "DRAFT", "ARCHIVED");

    private static final String CATALOG_FIELDS = """
            id, product_type, brand, name, format, film_type, camera_type,
            accessory_type, compatible_formats, active
            """;

    private static final RowMapper<CatalogProductResponse> CATALOG_MAPPER = (rs, rowNum) -> new CatalogProductResponse(
            rs.getObject("id", UUID.class), rs.getString("product_type"), rs.getString("brand"),
            rs.getString("name"), rs.getString("format"), rs.getString("film_type"),
            rs.getString("camera_type"), rs.getString("accessory_type"),
            rs.getString("compatible_formats"), rs.getBoolean("active")
    );

    private final JdbcTemplate jdbc;
    private final ProductRepository products;
    private final ImageStorageService images;

    public ProductController(JdbcTemplate jdbc, ProductRepository products, ImageStorageService images) {
        this.jdbc = jdbc;
        this.products = products;
        this.images = images;
    }

    @GetMapping("/api/products")
    public List<ProductResponse> list(
            @AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) UUID storefront,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String cameraModel,
            @RequestParam(required = false) String cameraFormat,
            @RequestParam(required = false) String filmFormat,
            @RequestParam(required = false) String filmType,
            @RequestParam(required = false) Integer minPrice,
            @RequestParam(required = false) Integer maxPrice
    ) {
        List<String> clauses = new ArrayList<>();
        List<Object> arguments = new ArrayList<>();
        boolean ownerView = false;

        if (storefront != null) {
            clauses.add("p.storefront_id = ?");
            arguments.add(storefront);

            if (user != null) {
                Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM storefronts WHERE id = ? AND owner_id = ?",
                        Integer.class, storefront, user.id());

                ownerView = count != null && count > 0;
            }
        }

        if (!ownerView) clauses.add("p.status = 'ACTIVE'");
        addEquals(clauses, arguments, "pc.product_type", type != null && TYPES.contains(type) ? type : null);
        addEquals(clauses, arguments, "pc.brand", cleanQuery(brand));
        addEquals(clauses, arguments, "pc.name", cleanQuery(cameraModel));
        addEquals(clauses, arguments, "pc.format", cleanQuery(cameraFormat));
        addEquals(clauses, arguments, "pc.format", cleanQuery(filmFormat));
        addEquals(clauses, arguments, "pc.film_type", cleanQuery(filmType));

        if (minPrice != null) {
            clauses.add("p.price_cents >= ?");
            arguments.add(minPrice);
        }
        if (maxPrice != null) {
            clauses.add("p.price_cents <= ?");
            arguments.add(maxPrice);
        }
        if (q != null && !q.trim().isEmpty()) {
            String pattern = "%" + q.trim() + "%";
            clauses.add("(COALESCE(p.title_override, pc.name) ILIKE ? OR p.description ILIKE ? " + "OR pc.brand ILIKE ? OR pc.name ILIKE ? OR s.name ILIKE ?)");
            for (int i = 0; i < 5; i++) arguments.add(pattern);
        }
        String where = clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
        return products.query(where + " ORDER BY p.created_at DESC", arguments.toArray());
    }

    @GetMapping("/api/products/catalog")
    public List<CatalogProductResponse> catalog(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String brand
    ) {
        List<String> clauses = new ArrayList<>(List.of("active = true"));
        List<Object> arguments = new ArrayList<>();

        if (type != null && TYPES.contains(type)) addEquals(clauses, arguments, "product_type", type);

        addEquals(clauses, arguments, "brand", cleanQuery(brand));

        return jdbc.query(
                "SELECT " + CATALOG_FIELDS + " FROM product_catalog WHERE " + String.join(" AND ", clauses)
                        + " ORDER BY product_type, brand, name, format, film_type",
                CATALOG_MAPPER,
                arguments.toArray()
        );
    }

    @PostMapping("/api/products/catalog")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogProductResponse createCatalog(
            @AuthenticationPrincipal CurrentUser user,
            @RequestBody Map<String, Object> body
    ) {
        requireAdmin(user);
        String productType = string(body.get("productType"));
        String brand = nullableString(body.get("brand"));
        String name = nullableString(body.get("name"));

        if (productType == null || !TYPES.contains(productType) || brand == null || name == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A valid product type, brand, and name are required");
        }

        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO product_catalog
                    (id, product_type, brand, name, format, film_type, camera_type, accessory_type, compatible_formats)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, productType, brand, name, nullableString(body.get("format")),
                    nullableString(body.get("filmType")), nullableString(body.get("cameraType")),
                    nullableString(body.get("accessoryType")), nullableString(body.get("compatibleFormats")));
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "This catalog product already exists");
        }
        return jdbc.query("SELECT " + CATALOG_FIELDS + " FROM product_catalog WHERE id = ?", CATALOG_MAPPER, id).getFirst();
    }

    @GetMapping("/api/products/catalog/statistics")
    public CatalogStatistics statistics(@AuthenticationPrincipal CurrentUser user) {
        requireAdmin(user);

        Map<String, Object> totals = jdbc.queryForMap("""
                WITH active_catalog AS (SELECT id FROM product_catalog WHERE active = true),
                recent_sales AS (
                    SELECT DISTINCT p.catalog_product_id FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
                    WHERE o.status = 'COMPLETED' AND o.created_at >= now() - interval '30 days'
                ), sale_totals AS (
                    SELECT COUNT(DISTINCT o.id)::int AS completed_orders,
                           COALESCE(SUM(oi.quantity), 0)::int AS units_sold
                    FROM orders o JOIN order_items oi ON oi.order_id = o.id
                    WHERE o.status = 'COMPLETED' AND o.created_at >= now() - interval '30 days'
                )
                SELECT (SELECT COUNT(*)::int FROM active_catalog) AS catalog_models,
                       (SELECT COUNT(*)::int FROM recent_sales rs JOIN active_catalog ac ON ac.id = rs.catalog_product_id) AS models_sold,
                       CASE WHEN (SELECT COUNT(*) FROM active_catalog) = 0 THEN 0 ELSE ROUND(
                           (SELECT COUNT(*)::numeric FROM recent_sales rs JOIN active_catalog ac ON ac.id = rs.catalog_product_id)
                           / (SELECT COUNT(*) FROM active_catalog) * 100)::int END AS sell_through,
                       completed_orders, units_sold FROM sale_totals
                """);

        List<TopSellingProduct> top = jdbc.query("""
                SELECT COALESCE(pc.name, oi.title) AS name, pc.brand, oi.product_type,
                       SUM(oi.quantity)::int AS units_sold
                FROM order_items oi JOIN orders o ON o.id = oi.order_id
                LEFT JOIN products p ON p.id = oi.product_id
                LEFT JOIN product_catalog pc ON pc.id = p.catalog_product_id
                WHERE o.status = 'COMPLETED' AND o.created_at >= now() - interval '30 days'
                GROUP BY COALESCE(pc.name, oi.title), pc.brand, oi.product_type
                ORDER BY units_sold DESC, name LIMIT 10
                """, (rs, rowNum) -> new TopSellingProduct(
                rs.getString("name"), rs.getString("brand"), rs.getString("product_type"), rs.getInt("units_sold")));

        return new CatalogStatistics(
                number(totals, "catalog_models"), number(totals, "models_sold"), number(totals, "sell_through"),
                number(totals, "completed_orders"), number(totals, "units_sold"), top);
    }

    @GetMapping("/api/products/mine")
    public List<ProductResponse> mine(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);
        return products.query(" WHERE s.owner_id = ? ORDER BY p.created_at DESC", user.id());
    }

    @GetMapping("/api/products/storefronts/{storefrontSlug}/products/{productSlug}/similar")
    public List<ProductResponse> similar(@PathVariable String storefrontSlug, @PathVariable String productSlug) {
        List<UUID> ids = jdbc.query("""
                WITH target AS (
                    SELECT p.id, pc.product_type, pc.brand, pc.format, pc.film_type,
                           pc.camera_type, pc.accessory_type
                    FROM products p JOIN storefronts s ON s.id = p.storefront_id
                    JOIN product_catalog pc ON pc.id = p.catalog_product_id
                    WHERE s.slug = ? AND p.slug = ? AND p.status = 'ACTIVE'
                )
                SELECT p.id,
                       (CASE WHEN pc.format IS NOT DISTINCT FROM target.format AND pc.format IS NOT NULL THEN 100 ELSE 0 END
                        + CASE WHEN pc.brand = target.brand THEN 30 ELSE 0 END
                        + CASE WHEN pc.film_type IS NOT DISTINCT FROM target.film_type AND pc.film_type IS NOT NULL THEN 20 ELSE 0 END
                        + CASE WHEN pc.camera_type IS NOT DISTINCT FROM target.camera_type AND pc.camera_type IS NOT NULL THEN 20 ELSE 0 END
                        + CASE WHEN pc.accessory_type IS NOT DISTINCT FROM target.accessory_type AND pc.accessory_type IS NOT NULL THEN 20 ELSE 0 END) AS relevance
                FROM target JOIN products p ON p.id <> target.id
                JOIN product_catalog pc ON pc.id = p.catalog_product_id
                WHERE p.status = 'ACTIVE' AND p.available_quantity > 0 AND pc.product_type = target.product_type
                ORDER BY relevance DESC, p.created_at DESC LIMIT 4
                """, (rs, rowNum) -> rs.getObject("id", UUID.class), storefrontSlug, productSlug);
        return ids.stream().map(id -> products.findById(id).orElse(null)).filter(java.util.Objects::nonNull).toList();
    }

    @GetMapping("/api/products/storefronts/{storefrontSlug}/products/{productSlug}")
    public ProductResponse publicProduct(@PathVariable String storefrontSlug, @PathVariable String productSlug) {
        return products.query(
                        " WHERE s.slug = ? AND p.slug = ? AND p.status = 'ACTIVE'", storefrontSlug, productSlug)
                .stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    @GetMapping("/api/products/{id}")
    public ProductResponse managementProduct(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        requireOwner(user, id, "Product not found");
        return findProduct(id);
    }

    @PostMapping("/api/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(
            @AuthenticationPrincipal CurrentUser user,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);
        Listing listing = parseListing(body, null);

        String catalogName = jdbc.query(
                "SELECT name FROM product_catalog WHERE id = ? AND active = true",
                (rs, rowNum) -> rs.getString("name"), listing.catalogProductId()).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "catalogProductId is invalid"));

        Integer owns = jdbc.queryForObject(
                "SELECT COUNT(*) FROM storefronts WHERE id = ? AND owner_id = ?",
                Integer.class, listing.storefrontId(), user.id());

        if (owns == null || owns == 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You do not own this storefront");
        }

        UUID id = UUID.randomUUID();

        String slug = nextSlug(listing.storefrontId(), listing.titleOverride() == null ? catalogName : listing.titleOverride());
        insertOrUpdate(id, slug, listing, true);
        return findProduct(id);
    }

    @PatchMapping("/api/products/{id}")
    public ProductResponse update(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body
    ) {
        requireOwner(user, id, "Product not found or not owned by you");
        ProductResponse existing = findProduct(id);
        Listing listing = parseListing(body, existing);

        Integer catalog = jdbc.queryForObject(
                "SELECT COUNT(*) FROM product_catalog WHERE id = ? AND active = true",
                Integer.class, listing.catalogProductId());

        if (catalog == null || catalog == 0) throw new ApiException(HttpStatus.BAD_REQUEST, "catalogProductId is invalid");

        if (!listing.storefrontId().equals(existing.storefrontId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A product cannot be moved between storefronts");
        }

        insertOrUpdate(id, existing.productSlug(), listing, false);
        return findProduct(id);
    }

    @DeleteMapping("/api/products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        requireOwner(user, id, "Product not found or not owned by you");

        List<String> imageUrls = jdbc.query(
                "SELECT image_url FROM product_images WHERE product_id = ?",
                (rs, rowNum) -> rs.getString("image_url"), id);

        jdbc.update("DELETE FROM products WHERE id = ?", id);
        imageUrls.forEach(images::delete);
    }

    @PostMapping(value = "/api/products/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<ProductImageResponse> upload(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @RequestPart("images") List<MultipartFile> files
    ) {
        requireOwner(user, id, "You do not own this product");
        if (files.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "At least one image is required");
        if (files.size() > 8) throw new ApiException(HttpStatus.BAD_REQUEST, "A maximum of eight images is allowed");

        Integer maximum = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), -1) FROM product_images WHERE product_id = ?", Integer.class, id);

        int start = (maximum == null ? -1 : maximum) + 1;
        List<ProductImageResponse> created = new ArrayList<>();
        List<String> storedUrls = new ArrayList<>();

        try {
            for (int index = 0; index < files.size(); index++) {
                String imageUrl = images.store(files.get(index));
                storedUrls.add(imageUrl);
                UUID imageId = UUID.randomUUID();

                jdbc.update("INSERT INTO product_images (id, product_id, image_url, sort_order) VALUES (?, ?, ?, ?)",
                        imageId, id, imageUrl, start + index);

                created.add(new ProductImageResponse(imageId, imageUrl, start + index));
            }
            return created;
        } catch (RuntimeException exception) {
            storedUrls.forEach(images::delete);
            throw exception;
        }
    }

    @DeleteMapping("/api/products/{id}/images/{imageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable UUID imageId
    ) {
        requireOwner(user, id, "Product not found or not owned by you");

        List<String> urls = jdbc.query("DELETE FROM product_images WHERE id = ? AND product_id = ? RETURNING image_url",
                (rs, rowNum) -> rs.getString("image_url"), imageId, id);

        if (urls.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Image not found");

        images.delete(urls.getFirst());
    }

    @GetMapping("/images/{filename:.+}")
    public ResponseEntity<Resource> image(
            @PathVariable String filename,
            @RequestParam(name = "w", required = false) Integer width
    ) throws Exception {
        Path path = images.resolve(filename, width);

        if (!Files.exists(path)) throw new ApiException(HttpStatus.NOT_FOUND, "Image not found");

        String contentType = Files.probeContentType(path);

        if (contentType == null && path.toString().endsWith(".webp")) contentType = "image/webp";

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .header(HttpHeaders.CONTENT_TYPE, contentType == null ? "application/octet-stream" : contentType)
                .body(new FileSystemResource(path));
    }

    private void insertOrUpdate(UUID id, String slug, Listing value, boolean insert) {
        Object[] arguments = {
                value.storefrontId(), value.catalogProductId(), value.titleOverride(), value.description(),
                value.priceCents(), value.availableQuantity(), value.status(), value.workingCondition(),
                value.hasMods(), value.expiryDate(), value.storageCondition()
        };
        if (insert) {
            jdbc.update("""
                    INSERT INTO products
                    (id, slug, storefront_id, catalog_product_id, title_override, description, price_cents,
                     available_quantity, status, working_condition, has_mods, expiry_date, storage_condition)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, slug, arguments[0], arguments[1], arguments[2], arguments[3], arguments[4],
                    arguments[5], arguments[6], arguments[7], arguments[8], arguments[9], arguments[10]);
        } else {
            jdbc.update("""
                    UPDATE products SET storefront_id = ?, catalog_product_id = ?, title_override = ?,
                    description = ?, price_cents = ?, available_quantity = ?, status = ?, working_condition = ?,
                    has_mods = ?, expiry_date = ?, storage_condition = ?, updated_at = now() WHERE id = ?
                    """, arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5],
                    arguments[6], arguments[7], arguments[8], arguments[9], arguments[10], id);
        }
    }

    private Listing parseListing(Map<String, Object> body, ProductResponse existing) {
        UUID storefrontId = uuidValue(body, "storefrontId", existing == null ? null : existing.storefrontId());
        UUID catalogId = uuidValue(body, "catalogProductId", existing == null ? null : existing.catalogProductId());
        Integer price = integerValue(body, "priceCents", existing == null ? null : existing.priceCents());
        Integer quantity = integerValue(body, "availableQuantity", existing == null ? 1 : existing.availableQuantity());
        String status = body.containsKey("status") ? string(body.get("status")) : existing == null ? "ACTIVE" : existing.status();

        if (storefrontId == null || catalogId == null || price == null || price < 0 || quantity == null || quantity < 0
                || status == null || !STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "catalogProductId, non-negative integer priceCents, availableQuantity, and a valid status are required");
        }

        String title = nullableFromBody(body, "titleOverride", existing == null ? null : existing.titleOverride());
        String description = nullableFromBody(body, "description", existing == null ? null : existing.description());
        String condition = nullableFromBody(body, "workingCondition", existing == null ? null : existing.workingCondition());
        String storage = nullableFromBody(body, "storageCondition", existing == null ? null : existing.storageCondition());
        Boolean hasMods = body.containsKey("hasMods") ? booleanOrNull(body.get("hasMods")) : existing == null ? null : existing.hasMods();
        LocalDate expiry = body.containsKey("expiryDate") ? dateOrNull(body.get("expiryDate")) : existing == null ? null : existing.expiryDate();

        return new Listing(storefrontId, catalogId, title, description, price, quantity, status, condition, hasMods, expiry, storage);
    }

    private String nextSlug(UUID storefrontId, String title) {
        String base = Normalizer.normalize(title, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "").toLowerCase().replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");

        if (base.isEmpty()) base = "listing";
        if (base.length() > 240) base = base.substring(0, 240).replaceAll("-+$", "");

        List<String> existing = jdbc.query("SELECT slug FROM products WHERE storefront_id = ? AND slug LIKE ?",
                (rs, rowNum) -> rs.getString("slug"), storefrontId, base + "%");

        if (!existing.contains(base)) return base;
        int suffix = 2;
        while (existing.contains(base + "-" + suffix)) suffix++;
        return base + "-" + suffix;
    }

    private ProductResponse findProduct(UUID id) {
        return products.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    private void requireOwner(CurrentUser user, UUID productId, String message) {
        requireUser(user);
        if (!products.isOwner(productId, user.id())) throw new ApiException(HttpStatus.NOT_FOUND, message);
    }

    private void requireAdmin(CurrentUser user) {
        requireUser(user);
        if (!"ADMIN".equals(user.role())) throw new ApiException(HttpStatus.FORBIDDEN, "Administrator access is required");
    }

    private void requireUser(CurrentUser user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }

    private void addEquals(List<String> clauses, List<Object> arguments, String column, Object value) {
        if (value == null) return;
        clauses.add(column + " = ?");
        arguments.add(value);
    }

    private String cleanQuery(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private String nullableFromBody(Map<String, Object> body, String key, String fallback) {
        if (!body.containsKey(key)) return fallback;
        return nullableString(body.get(key));
    }

    private String nullableString(Object value) {
        if (value == null) return null;
        if (!(value instanceof String text)) throw new ApiException(HttpStatus.BAD_REQUEST, "Text fields must be strings or null");

        String cleaned = text.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private String string(Object value) {
        return value instanceof String text ? text : null;
    }

    private UUID uuidValue(Map<String, Object> body, String key, UUID fallback) {
        if (!body.containsKey(key)) return fallback;
        try {
            return UUID.fromString(string(body.get(key)));
        } catch (Exception exception) {
            return null;
        }
    }

    private Integer integerValue(Map<String, Object> body, String key, Integer fallback) {
        if (!body.containsKey(key)) return fallback;
        Object value = body.get(key);
        return value instanceof Number number && number.doubleValue() == number.intValue() ? number.intValue() : null;
    }

    private Boolean booleanOrNull(Object value) {
        if (value == null || value instanceof Boolean) return (Boolean) value;
        throw new ApiException(HttpStatus.BAD_REQUEST, "hasMods must be a boolean or null");
    }

    private LocalDate dateOrNull(Object value) {
        if (value == null || value instanceof String text && text.isBlank()) return null;
        try {
            return LocalDate.parse((String) value);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "expiryDate must be a valid date or null");
        }
    }

    private int number(Map<String, Object> values, String key) {
        return ((Number) values.get(key)).intValue();
    }

    private record Listing(
            UUID storefrontId, UUID catalogProductId, String titleOverride, String description,
            int priceCents, int availableQuantity, String status, String workingCondition,
            Boolean hasMods, LocalDate expiryDate, String storageCondition
    ) {}
}
