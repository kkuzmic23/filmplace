package com.example.backend.api;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class ApiModels {
    private ApiModels() {}

    public record UserResponse(
            UUID id,
            String firstName,
            String lastName,
            String displayName,
            String email,
            String bio,
            int reputationScore,
            String role,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record StorefrontResponse(
            UUID id,
            UUID ownerId,
            String name,
            String slug,
            String description,
            String theme,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String ownerDisplayName
    ) {}

    public record CatalogProductResponse(
            UUID id,
            String productType,
            String brand,
            String name,
            String format,
            String filmType,
            String cameraType,
            String accessoryType,
            String compatibleFormats,
            boolean active
    ) {}

    public record ProductImageResponse(UUID id, String imageUrl, int sortOrder) {}

    public record ProductResponse(
            UUID id,
            UUID storefrontId,
            UUID catalogProductId,
            String productSlug,
            String productType,
            String catalogBrand,
            String catalogName,
            String catalogFormat,
            String catalogFilmType,
            String catalogCameraType,
            String catalogAccessoryType,
            String title,
            String titleOverride,
            String description,
            int priceCents,
            int availableQuantity,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String cameraModel,
            String cameraFormat,
            String workingCondition,
            Boolean hasMods,
            String filmFormat,
            String filmType,
            LocalDate expiryDate,
            String storageCondition,
            String accessoryType,
            String compatibleFormats,
            String storefrontName,
            String storefrontSlug,
            List<ProductImageResponse> images
    ) {}

    public record CartItemResponse(
            UUID productId,
            String title,
            String productType,
            int priceCents,
            int availableQuantity,
            String status,
            UUID storefrontId,
            String storefrontName,
            String storefrontSlug,
            String productSlug,
            int quantity,
            String imageUrl
    ) {}

    public record OrderItemResponse(
            UUID id,
            UUID productId,
            String title,
            String productType,
            int unitPriceCents,
            int quantity
    ) {}

    public record OrderResponse(
            UUID id,
            UUID buyerId,
            UUID storefrontId,
            String status,
            int totalCents,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String storefrontName,
            String storefrontSlug,
            UUID storefrontOwnerId,
            String buyerDisplayName,
            String buyerEmail,
            List<OrderItemResponse> items
    ) {}

    public record TopSellingProduct(String name, String brand, String productType, int unitsSold) {}

    public record CatalogStatistics(
            int catalogModels,
            int modelsSold,
            int modelSellThroughPercent,
            int completedOrders,
            int unitsSold,
            List<TopSellingProduct> topProducts
    ) {}

    public record SitemapUser(UUID id, LocalDateTime updatedAt) {}
    public record SitemapStorefront(String slug, LocalDateTime updatedAt) {}
    public record SitemapProduct(String storefrontSlug, String productSlug, LocalDateTime updatedAt) {}
    public record SitemapResponse(
            List<SitemapUser> users,
            List<SitemapStorefront> storefronts,
            List<SitemapProduct> products
    ) {}
}
