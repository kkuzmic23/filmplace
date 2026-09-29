import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../app.config';
import {
  CatalogSalesStatistics,
  Product,
  ProductCatalogItem,
  ProductImage,
  Storefront,
  StorefrontTheme,
} from './models';

export interface ProductSearchParams {
  q?: string;
  type?: string;
  brand?: string;
  cameraModel?: string;
  cameraFormat?: string;
  filmFormat?: string;
  filmType?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface StorefrontRequest {
  name: string;
  slug: string;
  description: string | null;
  theme: StorefrontTheme;
}

export interface ProductRequest {
  storefrontId: string;
  catalogProductId: string;
  titleOverride: string | null;
  description: string | null;
  priceCents: number;
  availableQuantity: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  workingCondition: string | null;
  hasMods: boolean | null;
  expiryDate: string | null;
  storageCondition: string | null;
}

export interface CatalogProductRequest {
  productType: 'CAMERA' | 'FILM' | 'ACCESSORY';
  brand: string;
  name: string;
  format?: string | null;
  filmType?: string | null;
  cameraType?: string | null;
  accessoryType?: string | null;
  compatibleFormats?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  getProductForManagement(id: string) {
    return this.http.get<Product>(`${this.apiUrl}/products/${encodeURIComponent(id)}`);
  }

  //only active products
  getProductBySlug(storefrontSlug: string, productSlug: string) {
    return this.http.get<Product>(
      `${this.apiUrl}/products/storefronts/${encodeURIComponent(storefrontSlug)}/products/${encodeURIComponent(productSlug)}`,
    );
  }

  getSimilarProducts(storefrontSlug: string, productSlug: string) {
    return this.http.get<Product[]>(
      `${this.apiUrl}/products/storefronts/${encodeURIComponent(storefrontSlug)}/products/${encodeURIComponent(productSlug)}/similar`,
    );
  }

  getProducts(params: ProductSearchParams) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value != null && String(value).trim() !== '') {
        searchParams.set(key, String(value).trim());
      }
    }

    const query = searchParams.toString();
    return this.http.get<Product[]>(`${this.apiUrl}/products${query ? `?${query}` : ''}`);
  }

  getProductCatalog() {
    return this.http.get<ProductCatalogItem[]>(`${this.apiUrl}/products/catalog`);
  }

  createCatalogProduct(data: CatalogProductRequest) {
    return this.http.post<ProductCatalogItem>(`${this.apiUrl}/products/catalog`, data);
  }

  getCatalogSalesStatistics() {
    return this.http.get<CatalogSalesStatistics>(`${this.apiUrl}/products/catalog/statistics`);
  }

  createProduct(data: ProductRequest) {
    return this.http.post<Product>(`${this.apiUrl}/products`, data);
  }

  updateProduct(id: string, data: ProductRequest) {
    return this.http.patch<Product>(`${this.apiUrl}/products/${encodeURIComponent(id)}`, data);
  }

  deleteProduct(id: string) {
    return this.http.delete<void>(`${this.apiUrl}/products/${encodeURIComponent(id)}`);
  }

  uploadProductImages(productId: string, files: File[]) {
    const data = new FormData();

    files.forEach((file) => data.append('images', file));

    return this.http.post<ProductImage[]>(
      `${this.apiUrl}/products/${encodeURIComponent(productId)}/images`,
      data,
    );
  }

  getStorefront(slug: string) {
    return this.http.get<Storefront>(`${this.apiUrl}/storefronts/${encodeURIComponent(slug)}`);
  }

  getStorefronts() {
    return this.http.get<Storefront[]>(`${this.apiUrl}/storefronts`);
  }

  getMyStorefronts() {
    return this.http.get<Storefront[]>(`${this.apiUrl}/storefronts/mine`);
  }

  createStorefront(data: StorefrontRequest) {
    return this.http.post<Storefront>(`${this.apiUrl}/storefronts`, data);
  }

  updateStorefront(id: string, data: StorefrontRequest) {
    return this.http.patch<Storefront>(`${this.apiUrl}/storefronts/${encodeURIComponent(id)}`, data);
  }

  deleteStorefront(id: string) {
    return this.http.delete<void>(`${this.apiUrl}/storefronts/${encodeURIComponent(id)}`);
  }

  getStorefrontProducts(storefrontId: string) {
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?storefront=${encodeURIComponent(storefrontId)}`,
    );
  }
}
