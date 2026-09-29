import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../../services/models';
import { OrdersService } from '../../services/orders.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);

  public incoming = signal<Order[]>([]);
  public outgoing = signal<Order[]>([]);
  public activeTab = signal<'incoming' | 'outgoing'>('incoming');
  public statusFilter = signal<'ALL' | Order['status']>('ALL');
  public loading = signal(true);
  public updatingId = signal('');
  public error = signal('');

  ngOnInit(): void {
    this.loadOrders();
  }

  visibleOrders(): Order[] {
    const orders = this.activeTab() === 'incoming' ? this.incoming() : this.outgoing();
    const status = this.statusFilter();

    return status === 'ALL' ? orders : orders.filter((order) => order.status === status);
  }

  setTab(tab: 'incoming' | 'outgoing'): void {
    this.activeTab.set(tab);
  }

  setStatusFilter(event: Event): void {
    const status = (event.target as HTMLSelectElement).value;

    if (
      status === 'ALL' ||
      status === 'PENDING' ||
      status === 'ACCEPTED' ||
      status === 'SHIPPED' ||
      status === 'COMPLETED' ||
      status === 'CANCELLED'
    ) {
      this.statusFilter.set(status);
    }
  }

  updateIncomingOrder(order: Order, status: 'ACCEPTED' | 'SHIPPED' | 'COMPLETED'): void {
    if ((order.status === 'PENDING' && status !== 'ACCEPTED')
      || (order.status === 'ACCEPTED' && status !== 'SHIPPED')
      || (order.status === 'SHIPPED' && status !== 'COMPLETED')) {
      return;
    }

    this.updatingId.set(order.id);
    this.error.set('');
    this.ordersService.updateStatus(order.id, status).subscribe({
      next: (updatedOrder) => {
        this.incoming.update((orders) => this.replaceOrder(orders, updatedOrder));
        this.updatingId.set('');
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  cancelOrder(order: Order): void {
    if (order.status !== 'PENDING') {
      return;
    }

    this.updatingId.set(order.id);
    this.error.set('');
    this.ordersService.cancelOrder(order.id).subscribe({
      next: (updatedOrder) => {
        this.outgoing.update((orders) => this.replaceOrder(orders, updatedOrder));
        this.updatingId.set('');
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  total(order: Order): number {
    return order.totalCents / 100;
  }

  private loadOrders(): void {
    this.ordersService.getIncomingOrders().subscribe({
      next: (orders) => {
        this.incoming.set(orders);
        this.finishLoading();
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });

    this.ordersService.getOutgoingOrders().subscribe({
      next: (orders) => {
        this.outgoing.set(orders);
        this.finishLoading();
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  private finishLoading(): void {
    this.loading.set(false);
  }

  private replaceOrder(orders: Order[], updatedOrder: Order): Order[] {
    return orders.map((order) => {
      if (order.id === updatedOrder.id) {
        return updatedOrder;
      }

      return order;
    });
  }

  private handleError(error: HttpErrorResponse): void {
    console.error('Failed to load or update orders:', error);
    this.updatingId.set('');
    this.loading.set(false);
    this.error.set(error.error?.message ?? 'Orders could not be loaded.');
  }
}
