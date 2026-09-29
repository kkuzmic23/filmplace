import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, User } from './auth.models';

import { API_URL } from '../app.config';
const key = 'filmplace.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  private session = signal<AuthResponse | null>(this.read());

  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  login(value: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, value).pipe(
      tap((odgovor) => {
        this.save(odgovor);
      }),
    );
  }

  register(value: RegisterRequest) {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, value).pipe(
      tap((odgovor) => {
        this.save(odgovor);
      }),
    );
  }

  token(): string | null {
    return this.session()?.accessToken ?? null;
  }

  updateUser(user: User): void {
    const session = this.session();
    if (session === null) {
      return;
    }

    this.save({ ...session, user });
  }

  logout(): void {
    this.session.set(null);

    if (this.browser) {
      localStorage.removeItem(key);
    }
  }

  private save(auth: AuthResponse): void {
    this.session.set(auth);

    if (this.browser) {
      localStorage.setItem(key, JSON.stringify(auth));
    }
  }

  private read(): AuthResponse | null {
    if (!this.browser) return null;
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') as AuthResponse | null;
    } catch {
      return null;
    }
  }
}
