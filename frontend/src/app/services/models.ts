export type StorefrontTheme = 'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5';

export interface Storefront {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  theme: StorefrontTheme;
  createdAt: string;
  updatedAt: string;
  ownerDisplayName: string;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ProductCatalogItem {
  id: string;
  productType: 'CAMERA' | 'FILM' | 'ACCESSORY';
  brand: string;
  name: string;
  format: string | null;
  filmType: string | null;
  cameraType: string | null;
  accessoryType: string | null;
  compatibleFormats: string | null;
  active: boolean;
}

export interface CatalogSalesStatistics {
  catalogModels: number;
  modelsSold: number;
  modelSellThroughPercent: number;
  completedOrders: number;
  unitsSold: number;
  topProducts: TopSellingCatalogProduct[];
}

export interface TopSellingCatalogProduct {
  name: string;
  brand: string | null;
  productType: 'CAMERA' | 'FILM' | 'ACCESSORY';
  unitsSold: number;
}

export interface Product {
  id: string;
  storefrontId: string;
  catalogProductId: string;
  productSlug: string;
  catalogBrand: string;
  catalogName: string;
  catalogFormat: string | null;
  catalogFilmType: string | null;
  catalogCameraType: string | null;
  catalogAccessoryType: string | null;
  productType: 'CAMERA' | 'FILM' | 'ACCESSORY';
  title: string;
  titleOverride: string | null;
  description: string | null;
  priceCents: number;
  availableQuantity: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  cameraModel: string | null;
  cameraFormat: string | null;
  workingCondition: string | null;
  hasMods: boolean | null;
  filmFormat: string | null;
  filmType: string | null;
  expiryDate: string | null;
  storageCondition: string | null;
  accessoryType: string | null;
  compatibleFormats: string | null;
  storefrontName: string;
  storefrontSlug: string;
  images: ProductImage[];
}

export interface CartItem {
  productId: string;
  title: string;
  productType: string;
  priceCents: number;
  availableQuantity: number;
  status: string;
  storefrontId: string;
  storefrontName: string;
  storefrontSlug: string;
  productSlug: string;
  quantity: number;
  imageUrl: string | null;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  title: string;
  productType: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  buyerId: string;
  storefrontId: string;
  status: 'PENDING' | 'ACCEPTED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  storefrontName: string;
  storefrontSlug: string;
  storefrontOwnerId: string;
  buyerDisplayName: string;
  buyerEmail: string;
  items: OrderItem[];
}
