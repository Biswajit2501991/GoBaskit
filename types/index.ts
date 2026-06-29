export interface CartItem {
  productId: string;
  name: string;
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

export interface ProductWithCategory {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  status: string;
  imageUrl: string | null;
  discount: number;
  isFeatured: boolean;
  isVisible: boolean;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
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
