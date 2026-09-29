import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorefrontFormComponent } from '../storefront-form/storefront-form.component';
import { CatalogService } from '../../services/catalog.service';
import { imageUrl as responsiveImageUrl } from '../../services/image-url';
import { Product, Storefront } from '../../services/models';

@Component({
  selector: 'app-my-storefronts',
  standalone: true,
  imports: [DatePipe, RouterLink, StorefrontFormComponent],
  templateUrl: './my-storefronts.component.html',
  styleUrl: './my-storefronts.component.scss',
})
export class MyStorefrontsComponent implements OnInit {
  private catalogService = inject(CatalogService);

  public storefronts = signal<Storefront[]>([]);
  public productCounts = signal<Partial<Record<string, number>>>({});
  public productPreviews = signal<Partial<Record<string, Product>>>({});
  public loading = signal<boolean>(true);
  public loadFailed = signal<boolean>(false);
  public formOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.loadStorefronts();
  }

  loadStorefronts(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.catalogService.getMyStorefronts().subscribe({
      next: (storefronts) => {
        this.storefronts.set(storefronts);
        this.loading.set(false);

        for (const storefront of storefronts) {
          this.loadProductCount(storefront);
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load storefronts:', error);
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  loadProductCount(storefront: Storefront): void {
    this.catalogService.getStorefrontProducts(storefront.id).subscribe({
      next: (products) => {
        this.productCounts.update((counts) => ({
          ...counts,
          [storefront.id]: products.length,
        }));

        if (products.length > 0) {
          this.productPreviews.update((previews) => ({
            ...previews,
            [storefront.id]: products[0],
          }));
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error(`Failed to load products for ${storefront.name}:`, error);
      },
    });
  }

  buildImagePath(product: Product): string {
    if (product.images.length === 0) {
      return 'https://placehold.co/400x400?text=filmplace';
    }

    const imageUrl = product.images[0].imageUrl;
    return responsiveImageUrl(imageUrl, 480);
  }

  openStorefrontForm(): void {
    this.formOpen.set(true);
  }

  closeStorefrontForm(): void {
    this.formOpen.set(false);
  }

  addStorefront(storefront: Storefront): void {
    this.storefronts.update((storefronts) => [storefront, ...storefronts]);
    this.productCounts.update((counts) => ({ ...counts, [storefront.id]: 0 }));
    this.closeStorefrontForm();
  }
}
