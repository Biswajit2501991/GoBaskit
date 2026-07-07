export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  variantLabel?: string | null;
  sku?: string | null;
  price: number;
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
  attributes?: unknown;
}

export interface ProductWithCategory {
  id: string;
  name: string;
  description: string;
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
