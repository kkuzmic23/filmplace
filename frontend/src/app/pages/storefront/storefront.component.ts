import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, RESPONSE_INIT, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { StorefrontFormComponent } from '../storefront-form/storefront-form.component';
import { CatalogService } from '../../services/catalog.service';
import { imageSrcset, imageUrl as responsiveImageUrl } from '../../services/image-url';
import { Product, Storefront } from '../../services/models';
import { SeoService } from '../../seo/seo.service';

@Component({
  selector: 'app-storefront',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, StorefrontFormComponent],
  templateUrl: './storefront.component.html',
  styleUrl: './storefront.component.scss',
})
export class StorefrontComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogService = inject(CatalogService);
  private auth = inject(AuthService);
  private seo = inject(SeoService);
  private responseInit = inject(RESPONSE_INIT, { optional: true });

  public storefront = signal<Storefront | null>(null);
  public products = signal<Product[]>([]);
  public pageProducts = signal<Product[]>([]);
  public loading = signal<boolean>(true);
  public loadFailed = signal<boolean>(false);
  public productsLoading = signal<boolean>(false);
  public currentPage = signal<number>(1);
  public pageSize = signal<number>(6);
  public totalPages = signal<number>(1);
  public storefrontFormOpen = signal<boolean>(false);
  public deleting = signal<boolean>(false);
  public deleteFailed = signal<boolean>(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('storefrontSlug');

    if (slug == null) {
      this.loading.set(false);
      this.loadFailed.set(true);
      this.setNotFoundSeo('');
      return;
    }

    this.loadStorefront(slug);
  }

  loadStorefront(slug: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.catalogService.getStorefront(slug).subscribe({
      next: (storefront) => {
        this.storefront.set(storefront);

        this.seo.setPageMetaData({
          title: `${storefront.name} | Filmplace`,
          description:
            storefront.description ??
            `Browse instant photography listings from ${storefront.name}.`,
          path: `/storefronts/${storefront.slug}`,
        });

        this.seo.setBreadcrumbs([
          { name: 'Filmplace', path: '/' },
          { name: storefront.ownerDisplayName, path: `/u/${storefront.ownerId}` },
          { name: storefront.name },
        ]);

        this.loading.set(false);
        this.loadProducts(storefront.id);
      },

      error: (err: HttpErrorResponse) => {
        console.error('Failed to load storefront:', err);
        this.loading.set(false);
        this.loadFailed.set(true);

        if (err.status === 404) {
          this.setNotFoundSeo(slug);
        }
      },
    });
  }

  private setNotFoundSeo(slug: string): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }

    this.seo.setPageMetaData({
      title: 'Storefront not found | Filmplace',
      description: 'This Filmplace storefront is not available.',
      path: `/storefronts/${slug}`,
      noindex: true,
    });
  }

  loadProducts(storefrontId: string): void {
    this.productsLoading.set(true);

    this.catalogService.getStorefrontProducts(storefrontId).subscribe({
      next: (products) => {
        this.products.set(products.filter((product) => product.status !== 'SOLD'));
        this.currentPage.set(1);
        this.setPageProducts();
        this.productsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load storefront products:', err);
        this.products.set([]);
        this.setPageProducts();
        this.productsLoading.set(false);
      },
    });
  }

  setPageProducts(): void {
    let totalPages = Math.ceil(this.products().length / this.pageSize());

    if (totalPages < 1) {
      totalPages = 1;
    }

    if (this.currentPage() > totalPages) {
      this.currentPage.set(totalPages);
    }

    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();

    this.totalPages.set(totalPages);
    this.pageProducts.set(this.products().slice(start, end));
  }

  previousPage(): void {
    if (this.currentPage() <= 1) {
      return;
    }

    this.currentPage.update((page) => page - 1);
    this.setPageProducts();
  }

  nextPage(): void {
    if (this.currentPage() >= this.totalPages()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
    this.setPageProducts();
  }

  buildImagePath(product: Product, width = 480): string {
    if (product.images.length > 0) {
      const imageUrl = product.images[0].imageUrl;

      return responsiveImageUrl(imageUrl, width);
    }

    return 'https://placehold.co/700x520?text=filmplace';
  }

  buildImageSrcset(product: Product): string | null {
    return product.images[0] ? imageSrcset(product.images[0].imageUrl) : null;
  }

  price(product: Product): number {
    return product.priceCents / 100;
  }

  brandClass(product: Product): string {
    if (product.catalogBrand === 'POLAROID') {
      return 'brand-polaroid';
    }

    if (product.catalogBrand === 'INSTAX') {
      return 'brand-instax';
    }

    return '';
  }

  isOwner(storefront: Storefront): boolean {
    return this.auth.user()?.id === storefront.ownerId;
  }

  openStorefrontForm(): void {
    this.storefrontFormOpen.set(true);
  }

  closeStorefrontForm(): void {
    this.storefrontFormOpen.set(false);
  }

  updateStorefront(storefront: Storefront): void {
    this.storefront.set(storefront);
    this.closeStorefrontForm();
  }

  deleteStorefront(storefront: Storefront): void {
    if (this.products().length > 0) {
      return;
    }

    if (!window.confirm(`Delete ${storefront.name}? This cannot be undone.`)) {
      return;
    }

    this.deleting.set(true);
    this.deleteFailed.set(false);

    this.catalogService.deleteStorefront(storefront.id).subscribe({
      next: () => {
        this.router.navigate(['/my-storefronts']);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to delete storefront:', error);
        this.deleting.set(false);
        this.deleteFailed.set(true);
      },
    });
  }
}
