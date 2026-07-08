'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { variantSchema, type VariantFormData } from '@/lib/validations';
import { calculateDiscountPercent } from '@/utils/pricing';
import { VARIANT_UNITS } from '@/utils/variant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProductImageUpload from './ProductImageUpload';
import type { ProductVariant } from '@/types';

interface VariantFormProps {
  productId: string;
  productName?: string;
  categoryName?: string;
  variant?: ProductVariant | null;
  onSaved: () => void;
  onClose: () => void;
}

const emptyVariant: VariantFormData = {
  brand: '',
  variantName: '',
  details: '',
  weight: '',
  unit: 'kg',
  price: 1,
  mrp: null,
  sku: '',
  barcode: '',
  stock: 0,
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

const selectClass =
  'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green';

export default function VariantForm({
  productId,
  productName = '',
  categoryName = '',
  variant,
  onSaved,
  onClose,
}: VariantFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: variant
      ? {
          brand: variant.brand,
          variantName: variant.variantName,
          details: variant.details ?? '',
          weight: variant.weight,
          unit: variant.unit || 'kg',
          price: variant.price,
          mrp: variant.mrp ?? null,
          sku: variant.sku ?? '',
          barcode: variant.barcode ?? '',
          stock: variant.stock,
          imageUrl: variant.imageUrl ?? '',
          sortOrder: variant.sortOrder,
          isActive: variant.isActive,
        }
      : emptyVariant,
  });

  const imageUrl = (watch('imageUrl') as string) || '';
  const price = Number(watch('price')) || 0;
  const mrpRaw = watch('mrp');
  const mrp = mrpRaw === null || mrpRaw === undefined || mrpRaw === '' ? null : Number(mrpRaw);
  const discount = calculateDiscountPercent(mrp, price);

  async function onSubmit(data: VariantFormData) {
    const url = variant
      ? `/api/admin/products/${productId}/variants/${variant.id}`
      : `/api/admin/products/${productId}/variants`;
    const method = variant ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        mrp: data.mrp == null || data.mrp === '' ? null : Number(data.mrp),
      }),
    });
    if (!res.ok) {
      alert('Failed to save option. Check the fields and try again.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{variant ? 'Edit Option' : 'Add Option'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Brand Name</Label>
            <Input {...register('brand')} placeholder="e.g. Aashirvaad" className="mt-1" />
            {errors.brand && <p className="text-red-500 text-xs mt-1">{errors.brand.message}</p>}
          </div>
          <div>
            <Label>Variant Name</Label>
            <Input {...register('variantName')} placeholder="e.g. Whole Wheat" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Weight / Size</Label>
              <Input {...register('weight')} placeholder="e.g. 2" className="mt-1" />
            </div>
            <div>
              <Label>Unit</Label>
              <select {...register('unit')} className={`mt-1 ${selectClass}`}>
                {VARIANT_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Selling Price (₹) *</Label>
            <Input {...register('price')} type="number" step="0.01" min="0" className="mt-1" />
            {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
          </div>
          <div>
            <Label>MRP (₹)</Label>
            <Input {...register('mrp')} type="number" step="0.01" min="0" placeholder="optional" className="mt-1" />
            {errors.mrp && <p className="text-red-500 text-xs mt-1">{errors.mrp.message}</p>}
          </div>
          <div>
            <Label>Discount (%)</Label>
            <Input value={discount > 0 ? discount : 0} readOnly className="mt-1 bg-gray-50" />
          </div>

          <div>
            <Label>SKU</Label>
            <Input {...register('sku')} placeholder="optional" className="mt-1" />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input {...register('barcode')} placeholder="optional" className="mt-1" />
          </div>
          <div>
            <Label>Stock Quantity *</Label>
            <Input {...register('stock')} type="number" min="0" className="mt-1" />
            {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>}
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <Label>Product Details (optional)</Label>
            <textarea
              {...register('details')}
              rows={4}
              placeholder={'Shown in the "Product Details" section when this option is selected.\nLeave blank to reuse the product-level details.\nTip: "Label: Value" per line, e.g.\nNet weight: 5 kg\nShelf life: 6 months'}
              className="mt-1 flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green resize-y"
            />
            {errors.details && <p className="text-red-500 text-xs mt-1">{errors.details.message}</p>}
          </div>

          <ProductImageUpload
            value={imageUrl}
            onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
            label="Option Image (optional)"
            searchName={`${productName} ${watch('brand') ?? ''}`.trim()}
            searchCategory={categoryName}
          />

          <div className="flex items-center gap-4 md:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register('isActive')} className="accent-blinkit-green" />
              Active
            </label>
          </div>

          <div className="flex gap-2 md:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : variant ? 'Update Option' : 'Add Option'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
