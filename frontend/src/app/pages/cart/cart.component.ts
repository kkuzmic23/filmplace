import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { imageUrl as responsiveImageUrl } from '../../services/image-url';
import { CartItem } from '../../services/models';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  public cart = inject(CartService);
  public updatingProductId = signal('');
  public checkoutLoading = signal(false);
  public error = signal('');
  public checkoutComplete = signal(false);

  changeQuantity(item: CartItem, amount: number): void {
    const quantity = item.quantity + amount;

    if (quantity < 1 || quantity > item.availableQuantity) {
      return;
    }

    this.updatingProductId.set(item.productId);
    this.error.set('');
    this.cart.updateItem(item.productId, quantity).subscribe({
      next: () => this.updatingProductId.set(''),
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  removeItem(item: CartItem): void {
    this.updatingProductId.set(item.productId);
    this.error.set('');
    this.cart.removeItem(item.productId).subscribe({
      next: () => this.updatingProductId.set(''),
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  checkout(): void {
    this.checkoutLoading.set(true);
    this.error.set('');
    this.checkoutComplete.set(false);

    this.cart.checkout().subscribe({
      next: () => {
        this.checkoutLoading.set(false);
        this.checkoutComplete.set(true);
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  imagePath(item: CartItem): string {
    if (item.imageUrl === null) {
      return 'https://placehold.co/240x180?text=filmplace';
    }

    return responsiveImageUrl(item.imageUrl, 480);
  }

  itemTotal(item: CartItem): number {
    return item.priceCents * item.quantity / 100;
  }

  total(): number {
    return this.cart.totalCents() / 100;
  }

  private handleError(error: HttpErrorResponse): void {
    this.updatingProductId.set('');
    this.checkoutLoading.set(false);
    this.error.set(error.error?.message ?? 'The cart could not be updated.');
  }
}
