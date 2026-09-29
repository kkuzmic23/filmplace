import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, RESPONSE_INIT, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product, ProductImage, Storefront } from '../../services/models';
import { AuthService } from '../../auth/auth.service';
import { CatalogService, ProductRequest } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { imageSrcset, imageUrl as responsiveImageUrl } from '../../services/image-url';
import { SeoService } from '../../seo/seo.service';

interface ProductTag {
  label: string;
  className: string;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private catalogService = inject(CatalogService);
  private cart = inject(CartService);
  private seo = inject(SeoService);
  private responseInit = inject(RESPONSE_INIT, { optional: true });

  public product = signal<Product | null>(null);
  public similarProducts = signal<Product[]>([]);
  public storefront = signal<Storefront | null>(null);
  public tags = signal<ProductTag[]>([]);
  public loading = signal<boolean>(true);
  public error = signal<string>('');
  public activeImageIndex = signal<number | null>(null);
  public updating = signal(false);
  public deleting = signal(false);
  public actionFailed = signal(false);
  public addingToCart = signal(false);
  public cartMessage = signal('');

  ngOnInit(): void {
    const storefrontSlug = this.route.snapshot.paramMap.get('storefrontSlug');
    const productSlug = this.route.snapshot.paramMap.get('productSlug');

    if (storefrontSlug == null || productSlug == null) {
      this.loading.set(false);
      this.error.set('Product not found.');
      return;
    }

    this.loadProduct(storefrontSlug, productSlug);
  }

  loadProduct(storefrontSlug: string, productSlug: string): void {
    this.catalogService.getProductBySlug(storefrontSlug, productSlug).subscribe({
      next: (product) => {
        this.product.set(product);
        this.tags.set(this.buildTags(product));

        this.seo.setPageMetaData({
          title: `${product.title} | ${product.storefrontName} | Filmplace`,
          description:
            product.description ??
            `Buy ${product.title} from ${product.storefrontName} on Filmplace.`,
          path: `/storefronts/${product.storefrontSlug}/products/${product.productSlug}`,
          type: 'product',
          image: product.images.length > 0 ? this.getMainImageURL(product) : undefined,
        });

        this.seo.setBreadcrumbs([
          { name: 'Filmplace', path: '/' },
          { name: product.storefrontName, path: `/storefronts/${product.storefrontSlug}` },
          { name: product.title },
        ]);

        this.seo.setProductOfferJSONLD({
          name: product.title,
          description:
            product.description ??
            `Buy ${product.title} from ${product.storefrontName} on Filmplace.`,
          path: `/storefronts/${product.storefrontSlug}/products/${product.productSlug}`,
          brand: product.catalogBrand,
          sellerName: product.storefrontName,
          priceCents: product.priceCents,
          availableQuantity: product.availableQuantity,
          images: product.images.map((image) => this.imagePath(image.imageUrl)),
        });

        this.loading.set(false);
        this.loadStorefront(product.storefrontSlug);
        this.loadSimilarProducts(product.storefrontSlug, product.productSlug);
      },

      error: (err: HttpErrorResponse) => {
        console.error('Failed to load product:', err);
        this.loading.set(false);

        if (err.status === 404) {
          if (this.responseInit) {
            this.responseInit.status = 404;
          }

          this.seo.setPageMetaData({
            title: 'Product not found | Filmplace',
            description: 'This product is no longer available on Filmplace.',
            path: `/storefronts/${storefrontSlug}/products/${productSlug}`,
            noindex: true,
          });
          this.error.set('Product not found.');
          return;
        }

        this.error.set('Product could not be loaded. Please try again later.');
      },
    });
  }

  loadStorefront(slug: string): void {
    this.catalogService.getStorefront(slug).subscribe({
      next: (newStorefront) => {
        this.storefront.set(newStorefront);
        const product = this.product();

        if (product) {
          this.seo.setBreadcrumbs([
            { name: 'Filmplace', path: '/' },
            { name: newStorefront.ownerDisplayName, path: `/u/${newStorefront.ownerId}` },
            { name: newStorefront.name, path: `/storefronts/${newStorefront.slug}` },
            { name: product.title },
          ]);
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load storefront:', err);
      },
    });
  }

  loadSimilarProducts(storefrontSlug: string, productSlug: string): void {
    this.catalogService.getSimilarProducts(storefrontSlug, productSlug).subscribe({
      next: (products) => this.similarProducts.set(products),
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load similar products:', error);
      },
    });
  }

  buildTags(product: Product): ProductTag[] {
    const tags: ProductTag[] = [];

    tags.push({
      label: product.productType,
      className: `type type-${product.productType.toLowerCase()}`,
    });

    tags.push({
      label: product.catalogBrand,
      className: `brand-${product.catalogBrand.toLowerCase()}`,
    });

    if (product.cameraFormat != null) {
      tags.push({
        label: product.cameraFormat,
        className: '',
      });
    }

    if (product.cameraModel != null) {
      tags.push({
        label: product.cameraModel,
        className: '',
      });
    }

    if (product.filmFormat != null) {
      tags.push({
        label: product.filmFormat,
        className: '',
      });
    }

    if (product.filmType != null) {
      tags.push({
        label: product.filmType,
        className: '',
      });
    }

    if (product.accessoryType != null) {
      tags.push({
        label: product.accessoryType,
        className: '',
      });
    }

    if (product.workingCondition != null) {
      tags.push({
        label: product.workingCondition,
        className: '',
      });
    }

    return tags;
  }

  getMainImageURL(product: Product): string {
    if (product.images.length > 0) {
      return this.imagePath(product.images[0].imageUrl);
    }

    return 'https://placehold.co/300x300?text=filmplace';
  }

  getCardImageURL(product: Product): string {
    return product.images[0]
      ? this.imagePath(product.images[0].imageUrl, 480)
      : 'https://placehold.co/480x360?text=filmplace';
  }

  getCurrentGalleryImage(product: Product): ProductImage | null {
    const index = this.activeImageIndex();
    if (index === null) {
      return null;
    }

    return product.images[index] ?? null;
  }

  getGalleryPosition(): number {
    return (this.activeImageIndex() ?? 0) + 1;
  }

  openGallery(index: number): void {
    this.activeImageIndex.set(index);
  }

  closeGallery(): void {
    this.activeImageIndex.set(null);
  }

  previousImage(product: Product): void {
    const currentIndex = this.activeImageIndex() ?? 0;
    this.activeImageIndex.set((currentIndex - 1 + product.images.length) % product.images.length);
  }

  nextImage(product: Product): void {
    const currentIndex = this.activeImageIndex() ?? 0;
    this.activeImageIndex.set((currentIndex + 1) % product.images.length);
  }

  imagePath(source: string, width = 1200): string {
    return responsiveImageUrl(source, width);
  }

  imageSrcset(source: string): string | null {
    return imageSrcset(source);
  }

  price(product: Product): number {
    return product.priceCents / 100;
  }

  isOwner(storefront: Storefront): boolean {
    return this.auth.user()?.id === storefront.ownerId;
  }

  toggleProductStatus(product: Product): void {
    let status: 'ACTIVE' | 'ARCHIVED';

    if (product.status === 'ACTIVE') {
      status = 'ARCHIVED';
    } else if (product.status === 'ARCHIVED') {
      status = 'ACTIVE';
    } else {
      return;
    }

    this.updating.set(true);
    this.actionFailed.set(false);

    this.catalogService.updateProduct(product.id, this.productRequest(product, status)).subscribe({
      next: (updatedProduct) => {
        this.product.set(updatedProduct);
        this.updating.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error),
    });
  }

  deleteProduct(product: Product): void {
    if (product.status !== 'ARCHIVED') {
      return;
    }

    if (!window.confirm(`Delete ${product.title}? This cannot be undone.`)) {
      return;
    }

    this.deleting.set(true);
    this.actionFailed.set(false);

    this.catalogService.deleteProduct(product.id).subscribe({
      next: () => this.router.navigate(['/storefronts', product.storefrontSlug]),
      error: (error: HttpErrorResponse) => this.handleActionError(error),
    });
  }

  addToCart(product: Product): void {
    if (!this.canAddToCart(product)) {
      return;
    }

    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.addingToCart.set(true);
    this.cartMessage.set('');

    this.cart.addItem(product.id, 1).subscribe({
      next: () => {
        this.addingToCart.set(false);
        this.cartMessage.set('Added to cart.');
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to add product to cart:', error);
        this.addingToCart.set(false);
        this.cartMessage.set(error.error?.message ?? 'The product could not be added to cart.');
      },
    });
  }

  canAddToCart(product: Product): boolean {
    if (product.status !== 'ACTIVE') {
      return false;
    }

    const storefront = this.storefront();
    if (storefront !== null && this.isOwner(storefront)) {
      return false;
    }

    return true;
  }

  private productRequest(product: Product, status: 'ACTIVE' | 'ARCHIVED'): ProductRequest {
    return {
      storefrontId: product.storefrontId,
      catalogProductId: product.catalogProductId,
      titleOverride: product.titleOverride,
      description: product.description,
      priceCents: product.priceCents,
      availableQuantity: product.availableQuantity,
      status,
      workingCondition: product.workingCondition,
      hasMods: product.hasMods,
      expiryDate: product.expiryDate,
      storageCondition: product.storageCondition,
    };
  }

  private handleActionError(error: HttpErrorResponse): void {
    console.error('Failed to update product:', error);
    this.updating.set(false);
    this.deleting.set(false);
    this.actionFailed.set(true);
  }
}
