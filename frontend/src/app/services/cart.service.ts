import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../app.config';
import { AuthService } from '../auth/auth.service';
import { CartItem } from './models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);
  private auth = inject(AuthService);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));

  public items = signal<CartItem[]>([]);
  public loading = signal(false);
  public itemCount = computed(() => this.items().reduce((total, item) => total + item.quantity, 0));
  public totalCents = computed(() => this.items().reduce((total, item) => total + item.priceCents * item.quantity, 0));

  constructor() {
    effect(() => {
      if (!this.browser) {
        return;
      }

      if (this.auth.isAuthenticated()) {
        this.load();
        return;
      }

      this.clear();
    });
  }

  load(): void {
    if (!this.auth.isAuthenticated()) {
      this.clear();
      return;
    }

    this.loading.set(true);
    this.http.get<CartItem[]>(`${this.apiUrl}/cart`).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  addItem(productId: string, quantity: number) {
    return this.http
      .post<CartItem[]>(`${this.apiUrl}/cart/items`, { productId, quantity })
      .pipe(tap((items) => this.items.set(items)));
  }

  updateItem(productId: string, quantity: number) {
    return this.http
      .patch<CartItem[]>(`${this.apiUrl}/cart/items/${encodeURIComponent(productId)}`, { quantity })
      .pipe(tap((items) => this.items.set(items)));
  }

  removeItem(productId: string) {
    return this.http.delete<void>(`${this.apiUrl}/cart/items/${encodeURIComponent(productId)}`).pipe(
      tap(() => this.items.update((items) => items.filter((item) => item.productId !== productId))),
    );
  }

  checkout() {
    return this.http.post<unknown>(`${this.apiUrl}/orders/checkout`, {}).pipe(tap(() => this.clear()));
  }

  clear(): void {
    this.items.set([]);
  }
}
