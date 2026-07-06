'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categorySchema, type CategoryFormData } from '@/lib/validations';
import { resolvePublicImageUrl } from '@/utils/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import ProductImageUpload from './ProductImageUpload';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

const emptyCategory: CategoryFormData = {
  name: '',
  slug: '',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

export default function CategoryManager({
  categories,
  canEdit,
}: {
  categories: AdminCategory[];
  canEdit: boolean;
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
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyCategory,
  });

  const imageUrl = watch('imageUrl') || '';
  const categoryName = watch('name') || '';

  function openCreate() {
    setEditingId(null);
    reset(emptyCategory);
    setShowForm(true);
    setError('');
  }

  function openEdit(cat: AdminCategory) {
    setEditingId(cat.id);
    reset({
      name: cat.name,
      slug: cat.slug,
      imageUrl: cat.imageUrl || '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    reset(emptyCategory);
    setError('');
  }

  async function onSubmit(data: CategoryFormData) {
    if (!canEdit) return;
    setError('');
    const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === 'string' ? err.error : 'Failed to save category');
      return;
    }

    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!canEdit) return;
    if (!confirm('Delete this category? Products must be moved first.')) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to delete');
      return;
    }
    router.refresh();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">{categories.length} categories · map products via category dropdown</p>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={!canEdit}>
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{editingId ? 'Edit Category' : 'New Category'}</h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input {...register('name')} placeholder="e.g. Vegetables" className="mt-1" disabled={!canEdit} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Slug (optional)</Label>
              <Input {...register('slug')} placeholder="auto-generated from name" className="mt-1" disabled={!canEdit} />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input {...register('sortOrder')} type="number" className="mt-1" disabled={!canEdit} />
            </div>
            <div className="md:col-span-2">
              <ProductImageUpload
                value={imageUrl}
                onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
                label="Category Image"
                disabled={!canEdit}
                uploadType="category"
                showWebSuggestions={false}
                searchName={categoryName}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" id="isActive" {...register('isActive')} className="accent-blinkit-green" disabled={!canEdit} />
              <label htmlFor="isActive" className="text-sm font-medium">Active (visible on store)</label>
            </div>
            {error && <p className="text-red-500 text-sm md:col-span-2">{error}</p>}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={isSubmitting || !canEdit}>
                {isSubmitting ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
            {cat.imageUrl ? (
              <div className="w-full h-28 rounded-lg overflow-hidden bg-gray-50 mb-3 border border-gray-100">
                <img
                  src={resolvePublicImageUrl(cat.imageUrl)}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-28 rounded-lg bg-gradient-to-br from-yellow-50 to-green-50 mb-3 border border-gray-100 flex items-center justify-center text-3xl">
                🏪
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{cat.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{cat._count.products} products</p>
              <p className="text-xs text-gray-400 mt-0.5">/{cat.slug}</p>
              <span className={`text-xs font-semibold mt-2 inline-block px-2 py-0.5 rounded ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {cat.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
              <Button variant="secondary" size="sm" onClick={() => openEdit(cat)} className="flex-1 gap-1" disabled={!canEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(cat.id)}
                disabled={deletingId === cat.id || cat._count.products > 0 || !canEdit}
                title={cat._count.products > 0 ? 'Move products before deleting' : 'Delete'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
