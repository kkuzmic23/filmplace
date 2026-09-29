import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, RESPONSE_INIT, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { imageUrl as responsiveImageUrl } from '../../services/image-url';
import { Product, Storefront } from '../../services/models';
import { UserService } from '../../services/user.service';
import { User } from '../../auth/auth.models';
import { SeoService } from '../../seo/seo.service';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
})
export class UserComponent implements OnInit {
  private userService = inject(UserService);
  private catalogService = inject(CatalogService);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  private responseInit = inject(RESPONSE_INIT, { optional: true });

  public user = signal<User | null>(null);
  public storefronts = signal<Storefront[]>([]);
  public productCounts = signal<Partial<Record<string, number>>>({});
  public productPreviews = signal<Partial<Record<string, Product>>>({});
  public loading = signal<boolean>(true);
  public loadFailed = signal<boolean>(false);
  public storefrontsLoading = signal<boolean>(false);

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('userId');

    if (userId == null) {
      this.loading.set(false);
      this.loadFailed.set(true);
      this.setNotFoundSeo('');
      return;
    }

    this.userService.getById(userId).subscribe({
      next: (user) => {
        this.user.set(user);

        this.seo.setPageMetaData({
          title: `${user.displayName} on Filmplace`,
          description:
            user.bio ?? `${user.displayName} is a Filmplace seller of instant photography gear.`,
          path: `/u/${user.id}`,
          type: 'profile',
        });

        this.seo.setProfileJSONLD({
          name: user.displayName,
          description:
            user.bio ?? `${user.displayName} is a Filmplace seller of instant photography gear.`,
          path: `/u/${user.id}`,
        });

        this.loading.set(false);
        this.loadStorefronts(user.id);
      },

      error: (err: HttpErrorResponse) => {
        console.error('Failed to load user:', err);
        this.loading.set(false);
        this.loadFailed.set(true);

        if (err.status === 404) {
          this.setNotFoundSeo(userId);
        }
      },
    });
  }

  private setNotFoundSeo(userId: string): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }

    this.seo.setPageMetaData({
      title: 'User not found | Filmplace',
      description: 'This Filmplace user profile is not available.',
      path: `/u/${userId}`,
      noindex: true,
    });
  }

  loadStorefronts(userId: string): void {
    this.storefrontsLoading.set(true);

    this.catalogService.getStorefronts().subscribe({
      next: (storefronts) => {
        this.storefronts.set(storefronts.filter((storefront) => storefront.ownerId === userId));
        this.storefrontsLoading.set(false);

        for (const storefront of this.storefronts()) {
          this.loadStorefrontProducts(storefront);
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load storefronts:', err);
        this.storefronts.set([]);
        this.storefrontsLoading.set(false);
      },
    });
  }

  loadStorefrontProducts(storefront: Storefront): void {
    this.catalogService.getStorefrontProducts(storefront.id).subscribe({
      next: (products) => {
        this.productCounts.update((counts) => ({ ...counts, [storefront.id]: products.length }));

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
}
