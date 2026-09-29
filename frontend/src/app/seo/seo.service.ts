import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface PageSeo {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'product' | 'profile';
  image?: string;
  noindex?: boolean;
}

export interface BreadcrumbItem {
  name: string;
  path?: string;
}

export interface ProductOfferSeo {
  name: string;
  description: string;
  path: string;
  brand: string;
  sellerName: string;
  priceCents: number;
  availableQuantity: number;
  images: string[];
}

export interface ProfileSeo {
  name: string;
  description: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  //META DATA + OPEN GRAPH

  setPageMetaData(page: PageSeo): void {
    const description = this.formatDescription(page.description);
    const canonicalUrl = this.convertToAbsoluteUrl(page.path);

    this.title.setTitle(page.title);
    this.upsertMetaName('description', description);
    this.setIndexing(page.noindex === true);

    if (page.noindex) {
      this.removeCanonical();
    } else {
      this.setCanonical(canonicalUrl);
    }

    this.upsertMetaProperty('og:site_name', 'Filmplace');
    this.upsertMetaProperty('og:title', page.title);
    this.upsertMetaProperty('og:description', description);
    this.upsertMetaProperty('og:type', page.type ?? 'website');
    this.upsertMetaProperty('og:url', canonicalUrl);
    this.upsertMetaName('twitter:card', page.image ? 'summary_large_image' : 'summary');
    this.upsertMetaName('twitter:title', page.title);
    this.upsertMetaName('twitter:description', description);

    if (page.image) {
      const image = this.convertToAbsoluteUrl(page.image);
      this.upsertMetaProperty('og:image', image);
      this.upsertMetaName('twitter:image', image);
    } else {
      this.meta.removeTag("property='og:image'");
      this.meta.removeTag("name='twitter:image'");
    }
  }

  setIndexing(noindex: boolean): void {
    this.upsertMetaName('robots', noindex ? 'noindex, nofollow' : 'index, follow');
  }

  setBreadcrumbs(items: BreadcrumbItem[]): void {
    const script = this.breadcrumbScript();

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',

      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        ...(item.path ? { item: this.convertToAbsoluteUrl(item.path) } : {}),
      })),
    };

    script.textContent = JSON.stringify(structuredData).replace(/</g, '\\u003c');
  }

  // - - - - JSON-LD - - - -

  //home page
  setHomeStructuredData(): void {
    const siteUrl = this.convertToAbsoluteUrl('/');

    this.upsertJsonLd('site', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}#website`,
          url: siteUrl,
          name: 'Filmplace',
          description: 'An instant photography marketplace for cameras, film, and accessories.',
        },
        {
          '@type': 'Organization',
          '@id': `${siteUrl}#organization`,
          name: 'Filmplace',
          url: siteUrl,
        },
      ],
    });
  }

  //product page
  setProductOfferJSONLD(product: ProductOfferSeo): void {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: this.formatDescription(product.description),
      url: this.convertToAbsoluteUrl(product.path),
      brand: {
        '@type': 'Brand',
        name: product.brand,
      },
      ...(product.images.length
        ? { image: product.images.map((image) => this.convertToAbsoluteUrl(image)) }
        : {}),
      offers: {
        '@type': 'Offer',
        url: this.convertToAbsoluteUrl(product.path),
        priceCurrency: 'EUR',
        price: (product.priceCents / 100).toFixed(2),
        availability:
          product.availableQuantity > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: product.sellerName,
        },
      },
    };

    this.upsertJsonLd('product-offer', structuredData);
  }

  //profile page
  setProfileJSONLD(profile: ProfileSeo): void {
    this.upsertJsonLd('profile', {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${profile.name} on Filmplace`,
      description: this.formatDescription(profile.description),
      url: this.convertToAbsoluteUrl(profile.path),
      mainEntity: {
        '@type': 'Person',
        name: profile.name,
        description: this.formatDescription(profile.description),
        url: this.convertToAbsoluteUrl(profile.path),
      },
    });
  }

  clearStructuredData(): void {
    this.document.head.querySelectorAll('script[data-seo]').forEach((script) => script.remove());
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }

    link.href = url;
  }

  private removeCanonical(): void {
    this.document.head.querySelector('link[rel="canonical"]')?.remove();
  }

  private breadcrumbScript(): HTMLScriptElement {
    return this.jsonLdScript('breadcrumbs');
  }

  private upsertJsonLd(name: string, structuredData: object): void {
    this.jsonLdScript(name).textContent = JSON.stringify(structuredData).replace(/</g, '\\u003c');
  }

  //create or fetch current json-ld
  private jsonLdScript(name: string): HTMLScriptElement {
    let script = this.document.head.querySelector<HTMLScriptElement>(`script[data-seo="${name}"]`);

    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo', name);
      this.document.head.appendChild(script);
    }

    return script;
  }

  private upsertMetaName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name='${name}'`);
  }

  private upsertMetaProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private convertToAbsoluteUrl(path: string): string {
    return new URL(path, 'http://localhost:4200').toString();
  }

  private formatDescription(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, 160);
  }
}
