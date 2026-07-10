/** Shared admin list types (kept out of UI components to avoid store circular imports). */

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  details?: string;
  price: number;
  actualPrice: number | null;
  unit: string;
  stock: number;
  stockBaseline: number;
  status: string;
  imageUrl: string | null;
  discount: number;
  isFeatured: boolean;
  isVisible: boolean;
  hasVariants: boolean;
  healthStarRating?: number | null;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  _count?: { variants: number };
}
