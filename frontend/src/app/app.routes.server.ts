import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'explore',
    renderMode: RenderMode.Server,
  },
  {
    path: 'u/:userId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'storefronts/:storefrontSlug/products/:productSlug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'storefronts/:storefrontSlug',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
    status: 404,
  },
];
