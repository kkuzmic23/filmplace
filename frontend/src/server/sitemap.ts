import type { RequestHandler } from 'express';

const siteUrl = 'http://localhost:4200';
const sitemapApiUrl = process.env['SITEMAP_API_URL'] ?? 'http://localhost:8080/api/seo/sitemap';

interface SitemapRecord {
  updatedAt: string;
}

interface SitemapData {
  users: Array<SitemapRecord & { id: string }>;
  storefronts: Array<SitemapRecord & { slug: string }>;
  products: Array<SitemapRecord & { storefrontSlug: string; productSlug: string }>;
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildUrlEntry = (path: string, updatedAt?: string) => {
  const lastmod = updatedAt
    ? `<lastmod>${new Date(updatedAt).toISOString().slice(0, 10)}</lastmod>`
    : '';

  return `  <url><loc>${escapeXml(new URL(path, siteUrl).toString())}</loc>${lastmod}</url>`;
};

export const sitemapHandler: RequestHandler = async (_req, res, next) => {
  try {
    const response = await fetch(sitemapApiUrl);

    if (!response.ok) {
      throw new Error(`Sitemap data request failed with ${response.status}`);
    }

    const data = (await response.json()) as SitemapData;
    const urls = [
      //sitemap entry for
      //home
      buildUrlEntry('/'),
      //explore
      buildUrlEntry('/explore'),
      //all users
      ...data.users.map((user) =>
        buildUrlEntry(`/u/${encodeURIComponent(user.id)}`, user.updatedAt),
      ),
      //all storefronts
      ...data.storefronts.map((storefront) =>
        buildUrlEntry(`/storefronts/${encodeURIComponent(storefront.slug)}`, storefront.updatedAt),
      ),
      //all active products
      ...data.products.map((product) =>
        buildUrlEntry(
          `/storefronts/${encodeURIComponent(product.storefrontSlug)}/products/${encodeURIComponent(product.productSlug)}`,
          product.updatedAt,
        ),
      ),
    ];

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
      );
  } catch (error) {
    next(error);
  }
};
