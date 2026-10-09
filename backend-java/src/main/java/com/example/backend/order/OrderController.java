package com.example.backend.order;

import com.example.backend.api.ApiException;
import com.example.backend.api.ApiModels.OrderItemResponse;
import com.example.backend.api.ApiModels.OrderResponse;
import com.example.backend.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private static final String ORDER_SELECT = """
            SELECT o.id, o.buyer_id, o.storefront_id, o.status, o.total_cents,
                   o.created_at, o.updated_at, s.name AS storefront_name, s.slug AS storefront_slug,
                   s.owner_id AS storefront_owner_id, b.display_name AS buyer_display_name, b.email AS buyer_email
            FROM orders o JOIN storefronts s ON s.id = o.storefront_id
            JOIN users b ON b.id = o.buyer_id
            """;

    private final JdbcTemplate jdbc;

    public OrderController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/mine")
    public List<OrderResponse> mine(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);
        return orders(" WHERE o.buyer_id = ? ORDER BY o.created_at DESC", user.id());
    }

    @GetMapping("/sales")
    public List<OrderResponse> sales(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);
        return orders(" WHERE s.owner_id = ? ORDER BY o.created_at DESC", user.id());
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<OrderResponse> checkout(@AuthenticationPrincipal CurrentUser user) {
        requireUser(user);

        List<CheckoutItem> items = jdbc.query("""
                SELECT ci.product_id, ci.quantity, COALESCE(p.title_override, pc.name) AS title,
                       pc.product_type, p.price_cents, p.available_quantity, p.status,
                       p.storefront_id, s.owner_id
                FROM cart_items ci JOIN products p ON p.id = ci.product_id
                JOIN product_catalog pc ON pc.id = p.catalog_product_id
                JOIN storefronts s ON s.id = p.storefront_id
                WHERE ci.cart_user_id = ? FOR UPDATE OF p
                """, (rs, rowNum) -> new CheckoutItem(
                rs.getObject("product_id", UUID.class), rs.getInt("quantity"), rs.getString("title"),
                rs.getString("product_type"), rs.getInt("price_cents"), rs.getInt("available_quantity"),
                rs.getString("status"), rs.getObject("storefront_id", UUID.class),
                rs.getObject("owner_id", UUID.class)), user.id());

        if (items.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Cart is empty");

        for (CheckoutItem item : items) {
            if (item.ownerId().equals(user.id())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "You cannot purchase from your own storefront");
            }

            if (!"ACTIVE".equals(item.status()) || item.quantity() > item.available()) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Product " + item.title() + " is no longer available in that quantity");
            }
        }

        Map<UUID, List<CheckoutItem>> byStorefront = new LinkedHashMap<>();

        for (CheckoutItem item : items) {
            byStorefront.computeIfAbsent(item.storefrontId(), ignored -> new ArrayList<>()).add(item);
        }

        List<UUID> orderIds = new ArrayList<>();

        for (Map.Entry<UUID, List<CheckoutItem>> entry : byStorefront.entrySet()) {
            int total = entry.getValue().stream().mapToInt(item -> item.priceCents() * item.quantity()).sum();

            UUID orderId = UUID.randomUUID();

            jdbc.update("INSERT INTO orders (id, buyer_id, storefront_id, total_cents) VALUES (?, ?, ?, ?)",
                    orderId, user.id(), entry.getKey(), total);

            for (CheckoutItem item : entry.getValue()) {
                jdbc.update("""
                        INSERT INTO order_items
                        (id, order_id, product_id, title, product_type, unit_price_cents, quantity)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, UUID.randomUUID(), orderId, item.productId(), item.title(), item.productType(),
                        item.priceCents(), item.quantity());

                jdbc.update("""
                        UPDATE products SET available_quantity = available_quantity - ?,
                            status = CASE WHEN available_quantity - ? = 0 THEN 'SOLD' ELSE status END,
                            updated_at = now() WHERE id = ?
                        """, item.quantity(), item.quantity(), item.productId());
            }
            orderIds.add(orderId);
        }
        jdbc.update("DELETE FROM cart_items WHERE cart_user_id = ?", user.id());
        return orderIds.stream().map(this::findUnrestricted).toList();
    }

    @GetMapping("/{id}")
    public OrderResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        requireUser(user);

        return orders(" WHERE o.id = ? AND (o.buyer_id = ? OR s.owner_id = ?)", id, user.id(), user.id())
                .stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public OrderResponse updateStatus(
            @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body
    ) {
        requireUser(user);

        String target = body.get("status") instanceof String value ? value : "";

        if (target == null || !Set.of("ACCEPTED", "SHIPPED", "COMPLETED", "CANCELLED").contains(target)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status must be ACCEPTED, SHIPPED, COMPLETED, or CANCELLED");
        }

        CurrentOrder current = jdbc.query("""
                SELECT o.buyer_id, o.status, s.owner_id FROM orders o
                JOIN storefronts s ON s.id = o.storefront_id WHERE o.id = ? FOR UPDATE OF o
                """, (rs, rowNum) -> new CurrentOrder(
                rs.getObject("buyer_id", UUID.class), rs.getString("status"),
                rs.getObject("owner_id", UUID.class)), id).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));

        boolean seller = current.ownerId().equals(user.id());
        boolean buyerCancellation = current.buyerId().equals(user.id()) && "PENDING".equals(current.status()) && "CANCELLED".equals(target);

        Map<String, Set<String>> transitions = Map.of(
                "PENDING", Set.of("ACCEPTED", "CANCELLED"),
                "ACCEPTED", Set.of("SHIPPED", "CANCELLED"),
                "SHIPPED", Set.of("COMPLETED")
        );

        if (!buyerCancellation && (!seller || !transitions.getOrDefault(current.status(), Set.of()).contains(target))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This order status change is not allowed");
        }

        if ("CANCELLED".equals(target)) {
            List<StockItem> stock = jdbc.query("""
                    SELECT oi.product_id, oi.quantity FROM order_items oi
                    JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? FOR UPDATE OF p
                    """, (rs, rowNum) -> new StockItem(
                    rs.getObject("product_id", UUID.class), rs.getInt("quantity")), id);
            for (StockItem item : stock) {
                jdbc.update("""
                        UPDATE products SET available_quantity = available_quantity + ?,
                            status = CASE WHEN status = 'SOLD' THEN 'ACTIVE' ELSE status END,
                            updated_at = now() WHERE id = ?
                        """, item.quantity(), item.productId());
            }
        }
        jdbc.update("UPDATE orders SET status = ?, updated_at = now() WHERE id = ?", target, id);
        return findUnrestricted(id);
    }

    private List<OrderResponse> orders(String suffix, Object... arguments) {
        return jdbc.query(ORDER_SELECT + suffix, (rs, rowNum) -> new OrderResponse(
                rs.getObject("id", UUID.class), rs.getObject("buyer_id", UUID.class),
                rs.getObject("storefront_id", UUID.class), rs.getString("status"), rs.getInt("total_cents"),
                rs.getTimestamp("created_at").toLocalDateTime(), rs.getTimestamp("updated_at").toLocalDateTime(),
                rs.getString("storefront_name"), rs.getString("storefront_slug"),
                rs.getObject("storefront_owner_id", UUID.class), rs.getString("buyer_display_name"),
                rs.getString("buyer_email"), List.of()
        ), arguments).stream().map(this::withItems).toList();
    }

    private OrderResponse withItems(OrderResponse order) {
        List<OrderItemResponse> items = jdbc.query("""
                SELECT id, product_id, title, product_type, unit_price_cents, quantity
                FROM order_items WHERE order_id = ? ORDER BY title
                """, (rs, rowNum) -> new OrderItemResponse(
                rs.getObject("id", UUID.class), rs.getObject("product_id", UUID.class), rs.getString("title"),
                rs.getString("product_type"), rs.getInt("unit_price_cents"), rs.getInt("quantity")), order.id());

        return new OrderResponse(
                order.id(), order.buyerId(), order.storefrontId(), order.status(), order.totalCents(),
                order.createdAt(), order.updatedAt(), order.storefrontName(), order.storefrontSlug(),
                order.storefrontOwnerId(), order.buyerDisplayName(), order.buyerEmail(), items);
    }

    private OrderResponse findUnrestricted(UUID id) {
        return orders(" WHERE o.id = ?", id).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    private void requireUser(CurrentUser user) {
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }

    private record CheckoutItem(
            UUID productId, int quantity, String title, String productType, int priceCents,
            int available, String status, UUID storefrontId, UUID ownerId
    ) {}
    private record CurrentOrder(UUID buyerId, String status, UUID ownerId) {}
    private record StockItem(UUID productId, int quantity) {}
}
