import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { CatalogService, ProductRequest } from '../../services/catalog.service';
import { Product, ProductCatalogItem, Storefront } from '../../services/models';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private catalogService = inject(CatalogService);

  public storefront = signal<Storefront | null>(null);
  public catalog = signal<ProductCatalogItem[]>([]);
  public loading = signal(true);
  public loadFailed = signal(false);
  public saving = signal(false);
  public saveFailed = signal(false);
  public selectedFiles = signal<File[]>([]);
  public editingProduct = signal<Product | null>(null);
  public type = '';
  public brand = '';
  public catalogProductId = '';
  public titleOverride = '';
  public description = '';
  public price = '';
  public availableQuantity = 1;
  public workingCondition = '';
  public hasMods = '';
  public expiryDate = '';
  public storageCondition = '';
  private editingProductId: string | null = null;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('storefrontSlug');

    if (slug === null) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.loadStorefront(slug);
    this.loadCatalog();

    const productId = this.route.snapshot.paramMap.get('productId');
    if (productId !== null) {
      this.editingProductId = productId;
      this.loadProduct(productId, slug);
    }
  }

  isEditingTRue(): boolean {
    return this.editingProduct() !== null;
  }

  getAllTypeOptions(): string[] {
    return this.unique(this.catalog().map((item) => item.productType));
  }

  getAllBrandOptions(): string[] {
    return this.unique(
      this.catalog()
        .filter((item) => item.productType === this.type)
        .map((item) => item.brand),
    );
  }

  getAllProductOptions(): ProductCatalogItem[] {
    return this.catalog().filter(
      (item) => item.productType === this.type && item.brand === this.brand,
    );
  }

  getSelectedCatalogProduct(): ProductCatalogItem | null {
    for (const item of this.catalog()) {
      if (item.id === this.catalogProductId) {
        return item;
      }
    }

    return null;
  }

  typeChanged(): void {
    this.brand = '';
    this.catalogProductId = '';
    this.resetProductDetails();
  }

  brandChanged(): void {
    this.catalogProductId = '';
    this.resetProductDetails();
  }

  productChanged(): void {
    this.resetProductDetails();
  }

  saveUploadedImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files === null) {
      return;
    }

    this.selectedFiles.set(Array.from(files).slice(0, 8));
  }

  removeImage(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }

  save(): void {
    const storefront = this.storefront();
    const catalogProduct = this.getSelectedCatalogProduct();
    const priceCents = Math.round(Number(this.price) * 100);

    if (
      storefront === null ||
      catalogProduct === null ||
      !Number.isInteger(priceCents) ||
      priceCents < 0
    ) {
      this.saveFailed.set(true);
      return;
    }

    this.saving.set(true);
    this.saveFailed.set(false);

    const data: ProductRequest = {
      storefrontId: storefront.id,
      catalogProductId: catalogProduct.id,
      titleOverride: this.emptyToNull(this.titleOverride),
      description: this.emptyToNull(this.description),
      priceCents,
      availableQuantity: Number(this.availableQuantity),
      status: 'ACTIVE',
      workingCondition: this.emptyToNull(this.workingCondition),
      hasMods: this.modsValue(),
      expiryDate: this.emptyToNull(this.expiryDate),
      storageCondition: this.emptyToNull(this.storageCondition),
    };

    const editingProduct = this.editingProduct();
    if (editingProduct === null) {
      this.catalogService.createProduct(data).subscribe({
        next: (product) => this.uploadImages(product.id, storefront.slug, product.productSlug),
        error: (error: HttpErrorResponse) => this.handleSaveError(error),
      });
      return;
    }

    this.catalogService.updateProduct(editingProduct.id, data).subscribe({
      next: (product) => this.uploadImages(product.id, storefront.slug, product.productSlug),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  private loadStorefront(slug: string): void {
    this.catalogService.getStorefront(slug).subscribe({
      next: (storefront) => {
        if (this.auth.user()?.id !== storefront.ownerId) {
          this.router.navigate(['/storefronts', storefront.slug]);
          return;
        }

        this.storefront.set(storefront);
        this.finishLoading();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load storefront:', error);
        this.loadFailed.set(true);
        this.finishLoading();
      },
    });
  }

  private loadCatalog(): void {
    this.catalogService.getProductCatalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.finishLoading();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load product catalog:', error);
        this.loadFailed.set(true);
        this.finishLoading();
      },
    });
  }

  private loadProduct(productId: string, storefrontSlug: string): void {
    this.catalogService.getProductForManagement(productId).subscribe({
      next: (product) => {
        if (product.storefrontSlug !== storefrontSlug) {
          this.router.navigate(['/storefronts', product.storefrontSlug]);
          return;
        }

        this.editingProduct.set(product);
        this.type = product.productType;
        this.brand = product.catalogBrand;
        this.catalogProductId = product.catalogProductId;
        this.titleOverride = product.titleOverride ?? '';
        this.description = product.description ?? '';
        this.price = String(product.priceCents / 100);
        this.availableQuantity = product.availableQuantity;
        this.workingCondition = product.workingCondition ?? '';
        this.expiryDate = product.expiryDate ?? '';
        this.storageCondition = product.storageCondition ?? '';

        if (product.hasMods === true) {
          this.hasMods = 'yes';
        } else if (product.hasMods === false) {
          this.hasMods = 'no';
        }

        this.finishLoading();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load product:', error);
        this.loadFailed.set(true);
        this.finishLoading();
      },
    });
  }

  private uploadImages(productId: string, storefrontSlug: string, productSlug: string): void {
    const files = this.selectedFiles();

    if (files.length === 0) {
      this.router.navigate(['/storefronts', storefrontSlug, 'products', productSlug]);
      return;
    }

    this.catalogService.uploadProductImages(productId, files).subscribe({
      next: () => this.router.navigate(['/storefronts', storefrontSlug, 'products', productSlug]),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  private finishLoading(): void {
    if (this.storefront() === null || this.catalog().length === 0) {
      if (this.loadFailed()) {
        this.loading.set(false);
      }
      return;
    }

    if (this.editingProductId !== null && this.editingProduct() === null) {
      return;
    }

    this.loading.set(false);
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)].sort();
  }

  private resetProductDetails(): void {
    this.workingCondition = '';
    this.hasMods = '';
    this.expiryDate = '';
    this.storageCondition = '';
  }

  private emptyToNull(value: string): string | null {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    return trimmed;
  }

  private modsValue(): boolean | null {
    if (this.hasMods === 'yes') {
      return true;
    }

    if (this.hasMods === 'no') {
      return false;
    }

    return null;
  }

  private handleSaveError(error: HttpErrorResponse): void {
    console.error('Failed to save product:', error);
    this.saving.set(false);
    this.saveFailed.set(true);
  }
}
