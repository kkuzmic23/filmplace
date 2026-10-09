import { ApplicationConfig, InjectionToken, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';

interface FilmplaceRuntimeConfig {
  apiUrl?: string;
}

const runtimeConfig = (
  globalThis as typeof globalThis & { filmplaceConfig?: FilmplaceRuntimeConfig }
).filmplaceConfig;

export const PUBLIC_API_URL = runtimeConfig?.apiUrl ?? 'http://localhost:8080/api';
export const API_URL = new InjectionToken<string>('API_URL');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: API_URL, useValue: PUBLIC_API_URL },
  ],
};
