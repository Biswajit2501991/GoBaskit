import { z } from 'zod';
import { STAFF_ROLES } from '@/types/staff';

function emptyToUndefined(val: unknown) {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return val;
}

function emptyToNull(val: unknown) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : val;
}

export function formatZodFlattenError(error: {
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
}): string {
  const fieldMsgs = Object.entries(error.fieldErrors).flatMap(([field, msgs]) =>
    (msgs ?? []).map((m) => `${field}: ${m}`)
  );
  const all = [...error.formErrors, ...fieldMsgs];
  return all.join('. ') || 'Invalid data';
}

const staffRoleEnum = z.enum(STAFF_ROLES as [typeof STAFF_ROLES[number], ...typeof STAFF_ROLES[number][]]);

export const checkoutSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Surname must be at least 2 characters'),
    mobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
    alternateMobile: z
      .union([z.literal(''), z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit number')])
      .optional(),
    houseNumber: z.string().min(1, 'House number is required'),
    street: z.string().min(2, 'Street is required'),
    area: z.string().min(2, 'Area is required'),
    landmark: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.union([
      z.literal(''),
      z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
    ]),
    deliveryNotes: z.string().optional(),
    paymentMethod: z.enum(['COD', 'QR_ON_DELIVERY']),
  });

export type CheckoutSchema = z.infer<typeof checkoutSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const staffMobileCheckSchema = z.object({
  mobile: z.string().min(10, 'Enter a valid mobile number').max(15),
});

export const staffLoginSchema = z.object({
  mobile: z.string().min(10, 'Enter a valid mobile number').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export const customerLoginSchema = z.object({
  mobile: z.string().min(8, 'Enter a valid mobile number').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const customerPasswordSchema = z
  .object({
    mobile: z.string().min(8, 'Enter a valid mobile number').max(20),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
    verificationId: z.string().min(1, 'Verification required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(10, 'Enter a valid mobile number').max(15),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email('Enter a valid email or leave blank').optional()
  ),
  role: staffRoleEnum,
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  permissions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  assignedCity: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  assignedAreas: z.array(z.string().max(120)).optional(),
  latitude: z.preprocess(
    emptyToNull,
    z.number().min(-90).max(90).optional().nullable()
  ),
  longitude: z.preprocess(
    emptyToNull,
    z.number().min(-180).max(180).optional().nullable()
  ),
  deliveryRadius: z.preprocess(
    emptyToNull,
    z.number().min(0).max(500).optional().nullable()
  ),
});

export const staffUpdateSchema = staffCreateSchema.partial().extend({
  password: z.string().min(6).optional(),
});

export const productSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    details: z.string().max(5000, 'Details are too long').optional(),
    price: z.coerce.number().positive('Current price must be positive'),
    actualPrice: z.preprocess(
      emptyToNull,
      z.coerce.number().positive('Actual price must be positive').optional().nullable()
    ),
    unit: z.string().min(1, 'Unit is required'),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    categoryId: z.string().min(1, 'Please select a category'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).optional(),
    imageUrl: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    hasVariants: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.actualPrice != null && data.actualPrice < data.price) {
      ctx.addIssue({
        code: 'custom',
        message: 'Actual price must be greater than or equal to current price',
        path: ['actualPrice'],
      });
    }
  });

export type ProductFormData = z.input<typeof productSchema>;

export const variantSchema = z
  .object({
    brand: z.string().max(120).optional(),
    variantName: z.string().max(120).optional(),
    details: z.string().max(5000, 'Details are too long').optional(),
    weight: z.string().max(60).optional(),
    unit: z.string().max(20).optional(),
    price: z.coerce.number().positive('Selling price must be positive'),
    mrp: z.preprocess(
      emptyToNull,
      z.coerce.number().positive('MRP must be positive').optional().nullable(),
    ),
    sku: z.preprocess(emptyToNull, z.string().max(80).optional().nullable()),
    barcode: z.preprocess(emptyToNull, z.string().max(80).optional().nullable()),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    imageUrl: z.preprocess(emptyToNull, z.string().optional().nullable()),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mrp != null && data.mrp < data.price) {
      ctx.addIssue({
        code: 'custom',
        message: 'MRP must be greater than or equal to selling price',
        path: ['mrp'],
      });
    }
    const hasIdentity = [data.brand, data.variantName, data.weight]
      .some((v) => (v ?? '').trim().length > 0);
    if (!hasIdentity) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add a brand, variant name, or weight/size',
        path: ['brand'],
      });
    }
  });

export type VariantFormData = z.input<typeof variantSchema>;

export const variantReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().optional(),
  imageUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CategoryFormData = z.input<typeof categorySchema>;
