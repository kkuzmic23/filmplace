import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  let authRequest = request;

  if (token) {
    authRequest = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authRequest);
};
