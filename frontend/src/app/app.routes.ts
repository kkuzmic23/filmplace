import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';
import { HomeComponent } from './pages/home/home.component';
import { UserComponent } from './pages/user/user.component';
import { ProductComponent } from './pages/product/product.component';
import { StorefrontComponent } from './pages/storefront/storefront.component';
import { ExploreComponent } from './pages/explore/explore.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Filmplace - Instant photography marketplace' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/auth.component').then((module) => module.AuthComponent),
    data: { mode: 'login', noindex: true },
    title: 'Filmplace - Log in',
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/auth.component').then((module) => module.AuthComponent),
    data: { mode: 'register', noindex: true },
    title: 'Filmplace - Create account',
  },
  {
    path: 'my-account',
    loadComponent: () => import('./pages/account/account.component').then((module) => module.AccountComponent),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'User account',
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then((module) => module.AdminComponent),
    canActivate: [authGuard, adminGuard],
    data: { noindex: true },
    title: 'Filmplace - Admin',
  },
  {
    path: 'admin/catalog/new',
    loadComponent: () =>
      import('./pages/catalog-product-form/catalog-product-form.component').then(
        (module) => module.CatalogProductFormComponent,
      ),
    canActivate: [authGuard, adminGuard],
    data: { noindex: true },
    title: 'Filmplace - Add catalog product',
  },
  {
    path: 'my-storefronts',
    loadComponent: () =>
      import('./pages/my-storefronts/my-storefronts.component').then(
        (module) => module.MyStorefrontsComponent,
      ),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'My storefronts',
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders.component').then((module) => module.OrdersComponent),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'Filmplace - Orders',
  },
  {
    path: 'orders/:orderId',
    loadComponent: () => import('./pages/order/order.component').then((module) => module.OrderComponent),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'Filmplace - Order',
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then((module) => module.CartComponent),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'Filmplace - Cart',
  },
  {
    path: 'explore',
    component: ExploreComponent,
    title: 'Filmplace - Explore',
  },
  { path: 'u/:userId', component: UserComponent },
  {
    path: 'storefronts/:storefrontSlug/products/new',
    loadComponent: () =>
      import('./pages/product-form/product-form.component').then(
        (module) => module.ProductFormComponent,
      ),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'Filmplace - Add product',
  },
  {
    path: 'storefronts/:storefrontSlug/products/:productId/edit',
    loadComponent: () =>
      import('./pages/product-form/product-form.component').then(
        (module) => module.ProductFormComponent,
      ),
    canActivate: [authGuard],
    data: { noindex: true },
    title: 'Filmplace - Edit product',
  },
  {
    path: 'storefronts/:storefrontSlug/products/:productSlug',
    component: ProductComponent,
    title: 'Filmplace - Product',
  },
  {
    path: 'storefronts/:storefrontSlug',
    component: StorefrontComponent,
    title: 'Filmplace - Storefront',
  },
  {
    path: '**',
    component: NotFoundComponent,
    data: { noindex: true },
    title: 'Page not found | Filmplace',
  },
];
