import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../app.config';
import { Order } from './models';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  getOutgoingOrders() {
    return this.http.get<Order[]>(`${this.apiUrl}/orders/mine`);
  }

  getIncomingOrders() {
    return this.http.get<Order[]>(`${this.apiUrl}/orders/sales`);
  }

  getOrder(id: string) {
    return this.http.get<Order>(`${this.apiUrl}/orders/${encodeURIComponent(id)}`);
  }

  updateStatus(id: string, status: Order['status']) {
    return this.http.patch<Order>(`${this.apiUrl}/orders/${encodeURIComponent(id)}/status`, {
      status,
    });
  }

  completeOrder(id: string) {
    return this.updateStatus(id, 'COMPLETED');
  }

  cancelOrder(id: string) {
    return this.updateStatus(id, 'CANCELLED');
  }
}
