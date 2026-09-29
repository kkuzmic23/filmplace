import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { User } from '../auth/auth.models';
import { API_URL } from '../app.config';

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  bio: string | null;
  password?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  getById(id: string) {
    return this.http.get<User>(`${this.apiUrl}/users/${encodeURIComponent(id)}`);
  }

  getProfile() {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  updateProfile(data: UpdateUserRequest) {
    return this.http.patch<User>(`${this.apiUrl}/users/me`, data);
  }
}
