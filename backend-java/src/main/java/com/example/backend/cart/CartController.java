package com.example.backend.cart;

import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.CartItemResponse;
import com.example.backend.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/cart")
public class CartController {
    private static final String CART_QUERY = """
            SELECT p.id AS product_id, COALESCE(p.title_override, pc.name) AS title,
                   pc.product_type, p.price_cents, p.available_quantity, p.status,
                   s.id AS storefront_id, s.name AS storefront_name, s.slug AS storefront_slug,
                   p.slug AS product_slug, ci.quantity,
                   (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image_url
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            JOIN product_catalog pc ON pc.id = p.catalog_product_id
            JOIN storefronts s ON s.id = p.storefront_id
            WHERE ci.cart_user_id = ? ORDER BY ci.created_at
            """;

    private final JdbcTemplate jdbc;

    public CartController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<CartItemResponse> get(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);
        return cart(user.id());
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<CartItemResponse> add(
            @AuthenticationPrincipal CurrentUser user,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);
        UUID productId = uuid(body.get("productId"));

        int quantity = integer(body.getOrDefault("quantity", 1));

        if (productId == null || quantity < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "productId and a positive integer quantity are required");
        }

        List<ProductAvailability> found = jdbc.query("""
                SELECT p.available_quantity, s.owner_id FROM products p
                JOIN storefronts s ON s.id = p.storefront_id
                WHERE p.id = ? AND p.status = 'ACTIVE' FOR UPDATE OF p
                """, (rs, rowNum) -> new ProductAvailability(
                rs.getInt("available_quantity"), rs.getObject("owner_id", UUID.class)), productId);

        if (found.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Active product not found");

        ProductAvailability product = found.getFirst();

        if (product.ownerId().equals(user.id())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot add a product from your own storefront");
        }

        Integer current = jdbc.query(
                "SELECT quantity FROM cart_items WHERE cart_user_id = ? AND product_id = ?",
                (rs, rowNum) -> rs.getInt("quantity"), user.id(), productId).stream().findFirst().orElse(0);

        if (current + quantity > product.available()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cart quantity exceeds availability");
        }

        jdbc.update("INSERT INTO carts (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING", user.id());

        jdbc.update("""
                INSERT INTO cart_items (cart_user_id, product_id, quantity) VALUES (?, ?, ?)
                ON CONFLICT (cart_user_id, product_id)
                DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
                """, user.id(), productId, quantity);

        return cart(user.id());
    }

    @PatchMapping("/items/{productId}")
    public List<CartItemResponse> update(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID productId,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);
        int quantity = integer(body.get("quantity"));

        if (quantity < 1) throw new ApiException(HttpStatus.BAD_REQUEST, "quantity must be a positive integer");

        int changed = jdbc.update("""
                UPDATE cart_items ci SET quantity = ? FROM products p
                WHERE ci.product_id = p.id AND ci.cart_user_id = ? AND ci.product_id = ?
                  AND p.status = 'ACTIVE' AND p.available_quantity >= ?
                """, quantity, user.id(), productId, quantity);

        if (changed == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cart item not found or requested quantity is unavailable");
        }

        return cart(user.id());
    }

    @DeleteMapping("/items/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID productId) {
        requireUser(user);

        if (jdbc.update("DELETE FROM cart_items WHERE cart_user_id = ? AND product_id = ?", user.id(), productId) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Cart item not found");
        }
    }

    private List<CartItemResponse> cart(UUID userId) {
        return jdbc.query(CART_QUERY, (rs, rowNum) -> new CartItemResponse(
                rs.getObject("product_id", UUID.class), rs.getString("title"), rs.getString("product_type"),
                rs.getInt("price_cents"), rs.getInt("available_quantity"), rs.getString("status"),
                rs.getObject("storefront_id", UUID.class), rs.getString("storefront_name"),
                rs.getString("storefront_slug"), rs.getString("product_slug"), rs.getInt("quantity"),
                rs.getString("image_url")
        ), userId);
    }

    private UUID uuid(Object value) {
        try {
            return UUID.fromString((String) value);
        } catch (Exception exception) {
            return null;
        }
    }

    private int integer(Object value) {
        return value instanceof Number number && number.doubleValue() == number.intValue() ? number.intValue() : -1;
    }

    private void requireUser(CurrentUser user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }

    private record ProductAvailability(int available, UUID ownerId) {}
}
