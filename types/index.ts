export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  variantLabel?: string | null;
  sku?: string | null;
  price: number;
  mrp?: number | null;
  unit: string;
  quantity: number;
  imageUrl?: string | null;
  stock: number;
}

export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  mobile: string;
  alternateMobile?: string;
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  deliveryNotes?: string;
  paymentMethod: 'COD' | 'QR_ON_DELIVERY';
}

export interface ProductVariant {
  id: string;
  productId: string;
  brand: string;
  variantName: string;
  details?: string;
  weight: string;
  unit: string;
  price: number;
  mrp?: number | null;
  discount: number;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  healthStarRating?: number | null;
  attributes?: unknown;
}

/**
 * A selectable option in the customer UI. The parent product is always the
 * first option (variantId = null); each active variant is an additional option.
 */
export interface ProductOption {
  key: string;
  variantId: string | null;
  isBase: boolean;
  name: string;
  sizeLabel: string;
  price: number;
  mrp: number | null;
  imageUrl: string | null;
  details: string;
  healthStarRating: number | null;
  stock: number;
  inStock: boolean;
}

export interface ProductWithCategory {
  id: string;
  name: string;
  description: string;
  details?: string;
  price: number;
  actualPrice?: number | null;
  unit: string;
  stock: number;
  status: string;
  imageUrl: string | null;
  discount: number;
  isFeatured: boolean;
  isVisible: boolean;
  hasVariants?: boolean;
  healthStarRating?: number | null;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
  variants?: ProductVariant[];
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}
