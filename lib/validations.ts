import { z } from 'zod';

export const checkoutSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  mobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  alternateMobile: z.union([z.literal(''), z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit number')]).optional(),
  houseNumber: z.string().min(1, 'House number is required'),
  street: z.string().min(2, 'Street is required'),
  area: z.string().min(2, 'Area is required'),
  landmark: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  deliveryNotes: z.string().optional(),
  paymentMethod: z.enum(['COD', 'QR_ON_DELIVERY']),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  categoryId: z.string().min(1, 'Please select a category'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
  imageUrl: z.string().optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  isFeatured: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

export type ProductFormData = z.input<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().optional(),
  imageUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type CategoryFormData = z.input<typeof categorySchema>;
