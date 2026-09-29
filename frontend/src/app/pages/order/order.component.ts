import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Order } from '../../services/models';
import { OrdersService } from '../../services/orders.service';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss',
})
export class OrderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ordersService = inject(OrdersService);
  private auth = inject(AuthService);

  public order = signal<Order | null>(null);
  public loading = signal(true);
  public updating = signal(false);
  public error = signal('');

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');

    if (orderId == null) {
      this.loading.set(false);
      this.error.set('Order not found.');
      return;
    }

    this.ordersService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load order:', error);
        this.error.set(error.error?.message ?? 'Order could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  isSeller(order: Order): boolean {
    return this.auth.user()?.id === order.storefrontOwnerId;
  }

  updateStatus(order: Order, status: Exclude<Order['status'], 'PENDING'>): void {
    this.updating.set(true);
    this.error.set('');
    this.ordersService.updateStatus(order.id, status).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.updating.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to update order:', error);
        this.error.set(error.error?.message ?? 'Order could not be updated.');
        this.updating.set(false);
      },
    });
  }

  total(order: Order): number {
    return order.totalCents / 100;
  }

  nextSellerStatus(order: Order): 'ACCEPTED' | 'SHIPPED' | 'COMPLETED' | null {
    if (!this.isSeller(order)) {
      return null;
    }

    if (order.status === 'PENDING') return 'ACCEPTED';
    if (order.status === 'ACCEPTED') return 'SHIPPED';
    if (order.status === 'SHIPPED') return 'COMPLETED';
    return null;
  }

  sellerActionLabel(order: Order): string {
    const next = this.nextSellerStatus(order);
    return next === 'ACCEPTED' ? 'Accept order' : next === 'SHIPPED' ? 'Mark as shipped' : 'Complete order';
  }

  canCancel(order: Order): boolean {
    return (this.isSeller(order) && (order.status === 'PENDING' || order.status === 'ACCEPTED'))
      || (!this.isSeller(order) && order.status === 'PENDING');
  }
}
