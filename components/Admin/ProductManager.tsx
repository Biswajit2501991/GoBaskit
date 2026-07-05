'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormData } from '@/lib/validations';
import { formatCurrency } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AdminCategory } from './CategoryManager';
import ProductImageUpload from './ProductImageUpload';

export interface AdminProduct {
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
  category: { id: string; name: string; slug: string };
}

const emptyProduct: ProductFormData = {
  name: '',
  description: '',
  price: 1,
  unit: '1 pc',
  stock: 0,
  categoryId: '',
  status: 'ACTIVE',
  imageUrl: '',
  discount: 0,
  isFeatured: false,
  isVisible: true,
};

export default function ProductManager({
  products,
  categories,
  canEdit,
  canDelete,
}: {
  products: AdminProduct[];
  categories: AdminCategory[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      ...emptyProduct,
      categoryId: categories[0]?.id || '',
    },
  });

  const imageUrl = watch('imageUrl') || '';

  function openCreate() {
    setEditingId(null);
    reset({
      ...emptyProduct,
      categoryId: categories[0]?.id || '',
      imageUrl: '',
    });
    setShowForm(true);
    setError('');
  }

  function openEdit(product: AdminProduct) {
    setEditingId(product.id);
    reset({
      name: product.name,
      description: product.description,
      price: product.price,
      unit: product.unit,
      stock: product.stock,
      categoryId: product.categoryId,
      status: product.status as ProductFormData['status'],
      imageUrl: product.imageUrl || '',
      discount: product.discount,
      isFeatured: product.isFeatured,
      isVisible: product.isVisible,
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError('');
  }

  async function onSubmit(data: ProductFormData) {
    if (!canEdit) return;
    setError('');
    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === 'string' ? err.error : 'Failed to save product');
      return;
    }

    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!canDelete) return;
    if (!confirm('Delete this product?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (!res.ok) {
      alert('Failed to delete product');
      return;
    }
    router.refresh();
  }

  const selectClass =
    'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} products · assign each to a category</p>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={categories.length === 0 || !canEdit}>
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {categories.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Create at least one category before adding products.
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">{editingId ? 'Edit Product' : 'New Product'}</h2>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>Product Name *</Label>
                <Input {...register('name')} placeholder="e.g. Fresh Tomatoes" className="mt-1" disabled={!canEdit} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label>Category *</Label>
                <select {...register('categoryId')} className={`mt-1 ${selectClass}`} disabled={!canEdit}>
                  <option value="">Select category</option>
                  {categories.filter((c) => c.isActive).map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.categoryId && <p className="text-red-500 text-xs mt-1">{errors.categoryId.message}</p>}
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <Label>Description</Label>
                <Input {...register('description')} placeholder="Short product description" className="mt-1" disabled={!canEdit} />
              </div>

              <div>
                <Label>Price (₹) *</Label>
                <Input {...register('price')} type="number" step="0.01" min="0" className="mt-1" disabled={!canEdit} />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>

              <div>
                <Label>Unit *</Label>
                <Input {...register('unit')} placeholder="e.g. 500 g, 1 kg" className="mt-1" disabled={!canEdit} />
                {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
              </div>

              <div>
                <Label>Stock *</Label>
                <Input {...register('stock')} type="number" min="0" className="mt-1" disabled={!canEdit} />
                {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>}
              </div>

              <div>
                <Label>Discount (%)</Label>
                <Input {...register('discount')} type="number" min="0" max="100" className="mt-1" disabled={!canEdit} />
              </div>

              <div>
                <Label>Status</Label>
                <select {...register('status')} className={`mt-1 ${selectClass}`} disabled={!canEdit}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>

              <ProductImageUpload
                value={imageUrl}
                onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
                disabled={!canEdit}
              />

              <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...register('isFeatured')} className="accent-blinkit-green" disabled={!canEdit} />
                  Featured (Best Seller badge)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...register('isVisible')} className="accent-blinkit-green" disabled={!canEdit} />
                  Visible on store
                </label>
              </div>

              {error && <p className="text-red-500 text-sm md:col-span-2 lg:col-span-3">{error}</p>}

              <div className="flex gap-2 md:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={isSubmitting || !canEdit}>
                  {isSubmitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-semibold w-14">Image</th>
                <th className="text-left p-3 font-semibold">Name</th>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Price</th>
                <th className="text-left p-3 font-semibold">Unit</th>
                <th className="text-left p-3 font-semibold">Stock</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-medium">
                    {p.name}
                    {p.isFeatured && (
                      <span className="ml-2 text-[10px] bg-blinkit-yellow px-1.5 py-0.5 rounded font-bold">FEATURED</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="bg-blinkit-green-light text-blinkit-green text-xs font-semibold px-2 py-0.5 rounded">
                      {p.category.name}
                    </span>
                  </td>
                  <td className="p-3">{formatCurrency(p.price)}</td>
                  <td className="p-3 text-gray-500">{p.unit}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(p)} className="gap-1" disabled={!canEdit}>
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id || !canDelete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">No products yet. Click Add Product to create one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
