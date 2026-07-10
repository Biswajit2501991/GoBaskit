'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormData } from '@/lib/validations';
import { calculateDiscountPercent } from '@/utils/pricing';
import { resolvePublicImageUrl } from '@/utils/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AdminCategory } from './CategoryManager';
import ProductImageUpload from './ProductImageUpload';
import ProductPriceDisplay from '@/components/ProductCard/ProductPriceDisplay';
import VariantAdminTable from './VariantAdminTable';
import ListPagination from './ListPagination';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import { isLowStock } from '@/utils/inventory';

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

const emptyProduct: ProductFormData = {
  name: '',
  description: '',
  details: '',
  price: 1,
  actualPrice: null,
  unit: '1 pc',
  stock: '' as unknown as number,
  categoryId: '',
  status: 'ACTIVE',
  imageUrl: '',
  isFeatured: false,
  isVisible: true,
  hasVariants: false,
  healthStarRating: null,
};

export default function ProductManager({
  categories: initialCategories,
  canEdit,
  canDelete,
  sort = 'name',
  title = 'Products',
  subtitle = 'assign each to a category',
}: {
  categories?: AdminCategory[];
  canEdit: boolean;
  canDelete: boolean;
  sort?: 'name' | 'stock';
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>(initialCategories ?? []);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialCategories?.length) return;
    // Categories come with the first products response when includeCategories=1.
  }, [initialCategories]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_LIST_PAGE_SIZE),
      sort,
    });
    if (search.trim()) params.set('search', search.trim());
    if (categoryFilter) params.set('categoryId', categoryFilter);
    // Fetch categories in parallel with products on first loads (no separate SSR wait).
    if (!initialCategories?.length && categories.length === 0) {
      params.set('includeCategories', '1');
    }

    try {
      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
      }
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [page, search, categoryFilter, sort, categories.length, initialCategories]);

  useEffect(() => {
    if (!initialLoadDone.current || !search) {
      void load();
      return;
    }
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setFocus,
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
  const hasVariants = watch('hasVariants') ?? false;
  const stockRaw = watch('stock');
  const stockNum = stockRaw === '' || stockRaw === null || stockRaw === undefined ? null : Number(stockRaw);
  const stockNeedsAttention =
    !hasVariants && (stockNum === null || Number.isNaN(stockNum) || stockNum <= 0);
  const currentName = watch('name') || '';
  const currentCategoryId = watch('categoryId') || '';
  const currentCategoryName =
    categories.find((c) => c.id === currentCategoryId)?.name || '';
  const sellingPrice = Number(watch('price')) || 0;
  const actualPriceRaw = watch('actualPrice');
  const actualPrice =
    actualPriceRaw === null || actualPriceRaw === undefined || actualPriceRaw === ''
      ? null
      : Number(actualPriceRaw);
  const calculatedDiscount = calculateDiscountPercent(actualPrice, sellingPrice);

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
    // If options already exist in DB, always show Variant Management even when
    // the checkbox was previously unchecked (storefront still lists those options).
    const hasExistingOptions = (product._count?.variants ?? 0) > 0;
    reset({
      name: product.name,
      description: product.description,
      details: product.details ?? '',
      price: product.price,
      actualPrice: product.actualPrice,
      unit: product.unit,
      stock: product.stock,
      categoryId: product.categoryId,
      status: product.status as ProductFormData['status'],
      imageUrl: product.imageUrl || '',
      isFeatured: product.isFeatured,
      isVisible: product.isVisible,
      hasVariants: product.hasVariants || hasExistingOptions,
      healthStarRating: product.healthStarRating ?? null,
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

    // Block accidental zero-stock creates for simple (non-option) products.
    if (!editingId && !data.hasVariants && Number(data.stock) <= 0) {
      setError('Please enter Stock quantity — do not leave it as 0 for a new product.');
      setFocus('stock');
      return;
    }

    const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        stock: data.hasVariants ? Number(data.stock) || 0 : Number(data.stock),
        actualPrice:
          data.actualPrice == null || data.actualPrice === '' ? null : Number(data.actualPrice),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === 'string' ? err.error : 'Failed to save product');
      return;
    }

    const saved = await res.json().catch(() => null);
    await load();
    router.refresh();

    // When creating a product that has options, keep the form open and switch
    // into edit mode so the option manager (which needs the new product id)
    // appears immediately instead of forcing a reopen.
    if (!editingId && data.hasVariants && saved?.id) {
      setEditingId(saved.id);
      return;
    }

    closeForm();
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
    await load();
    router.refresh();
  }

  const selectClass =
    'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} products · {subtitle}</p>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={categories.length === 0 || !canEdit}>
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className={`max-w-xs ${selectClass}`}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {!loading && categories.length === 0 && (
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

              <div className="md:col-span-2 lg:col-span-3">
                <Label>Product Details</Label>
                <textarea
                  {...register('details')}
                  rows={5}
                  disabled={!canEdit}
                  placeholder={'Shown in an expandable "Product Details" section on the product page.\nTip: use "Label: Value" per line for a clean spec list, e.g.\nBrand: Aashirvaad\nShelf life: 6 months\nStorage: Cool, dry place'}
                  className="mt-1 flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green disabled:bg-gray-50 resize-y"
                />
                {errors.details && <p className="text-red-500 text-xs mt-1">{errors.details.message}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  Optional. Lines written as <code>Label: Value</code> render as a neat spec table; other lines show as paragraphs.
                </p>
              </div>

              <div>
                <Label>Actual Price (₹)</Label>
                <Input
                  {...register('actualPrice')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 45 (optional MRP)"
                  className="mt-1"
                  disabled={!canEdit}
                />
                {errors.actualPrice && <p className="text-red-500 text-xs mt-1">{errors.actualPrice.message}</p>}
              </div>

              <div>
                <Label>Current Price (₹) *</Label>
                <Input {...register('price')} type="number" step="0.01" min="0" className="mt-1" disabled={!canEdit} />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>

              <div>
                <Label>Discount (%)</Label>
                <Input
                  value={calculatedDiscount > 0 ? calculatedDiscount : 0}
                  readOnly
                  className="mt-1 bg-gray-50"
                />
                <p className="text-[11px] text-gray-400 mt-1">Auto-calculated from actual and current price</p>
              </div>

              <div>
                <Label>Unit *</Label>
                <Input {...register('unit')} placeholder="e.g. 500 g, 1 kg" className="mt-1" disabled={!canEdit} />
                {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
              </div>

              <div
                className={`rounded-xl p-3 -mx-1 transition-colors ${
                  stockNeedsAttention
                    ? 'bg-amber-50 border-2 border-amber-400 ring-2 ring-amber-200'
                    : 'border border-transparent'
                }`}
              >
                <Label className={stockNeedsAttention ? 'text-amber-900 font-bold' : undefined}>
                  Stock *{stockNeedsAttention ? ' — required' : ''}
                </Label>
                <Input
                  {...register('stock')}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="e.g. 50"
                  className={`mt-1 ${
                    stockNeedsAttention
                      ? 'border-amber-500 bg-white focus:ring-amber-300 focus:border-amber-500'
                      : ''
                  }`}
                  disabled={!canEdit || hasVariants}
                />
                {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>}
                {stockNeedsAttention ? (
                  <p className="text-[11px] text-amber-800 font-semibold mt-1">
                    Enter how many units you have in stock. Do not leave this as 0 when adding a new product.
                  </p>
                ) : hasVariants ? (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Stock is managed per option below when this product has multiple options.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Reduces automatically when orders are placed. At 0, status becomes Out of Stock. Alert at ≤25% of stocked level.
                  </p>
                )}
              </div>

              <div>
                <Label>Status</Label>
                <select {...register('status')} className={`mt-1 ${selectClass}`} disabled={!canEdit}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Active / Out of Stock sync from stock unless set to Inactive.</p>
              </div>

              <ProductImageUpload
                value={imageUrl}
                onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
                disabled={!canEdit}
                searchName={currentName}
                searchCategory={currentCategoryName}
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
                <div>
                  <Label>Health Star Rating</Label>
                  <select
                    {...register('healthStarRating')}
                    disabled={!canEdit}
                    className="mt-1 flex h-10 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green"
                  >
                    <option value="">None (hidden)</option>
                    <option value="1">★ 1 star</option>
                    <option value="2">★★ 2 stars</option>
                    <option value="3">★★★ 3 stars</option>
                    <option value="4">★★★★ 4 stars</option>
                    <option value="5">★★★★★ 5 stars</option>
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Shown on storefront when Health Star Rating is enabled in Settings.
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-sm mb-1">Product Options</h3>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...register('hasVariants')} className="accent-blinkit-green" disabled={!canEdit} />
                  This product has multiple options (brands / sizes / weights)
                </label>
                <p className="text-[11px] text-gray-400 mt-1">
                  When enabled, customers pick a specific option. Price, stock, and image come from the option they choose.
                </p>
              </div>

              {error && <p className="text-red-500 text-sm md:col-span-2 lg:col-span-3">{error}</p>}

              <div className="flex gap-2 md:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={isSubmitting || !canEdit}>
                  {isSubmitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              </div>
            </form>

            {/* Variant manager lives OUTSIDE the product <form> so its own form
                controls never submit or interfere with the product form. */}
            {hasVariants && (
              editingId ? (
                <div className="mt-4">
                  <VariantAdminTable
                    productId={editingId}
                    productName={currentName}
                    categoryName={currentCategoryName}
                    productImageUrl={imageUrl || null}
                  />
                </div>
              ) : (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  Fill in the product details above and click <strong>Create Product</strong>. The option manager will appear here right after saving so you can add each brand / size.
                </div>
              )
            )}
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {search || categoryFilter ? 'No products match your filters.' : 'No products yet. Click Add Product to create one.'}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    {p.imageUrl ? (
                      <img src={resolvePublicImageUrl(p.imageUrl)} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
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
                    {p.hasVariants && (p._count?.variants ?? 0) > 0 && (
                      <span className="ml-2 text-[10px] bg-blinkit-green-light text-blinkit-green px-1.5 py-0.5 rounded font-bold">
                        {p._count?.variants} OPTIONS
                      </span>
                    )}
                    {!p.isVisible && (
                      <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">HIDDEN</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="bg-blinkit-green-light text-blinkit-green text-xs font-semibold px-2 py-0.5 rounded">
                      {p.category.name}
                    </span>
                  </td>
                  <td className="p-3">
                    <ProductPriceDisplay price={p.price} actualPrice={p.actualPrice} size="sm" />
                  </td>
                  <td className="p-3 text-gray-500">{p.unit}</td>
                  <td className="p-3">
                    <span
                      className={`font-medium ${
                        p.stock <= 0
                          ? 'text-red-600'
                          : isLowStock(p.stock, p.stockBaseline ?? p.stock)
                            ? 'text-amber-600'
                            : ''
                      }`}
                    >
                      {p.stock}
                    </span>
                    {(p.stockBaseline ?? 0) > 0 && (
                      <p className="text-[10px] text-gray-400">of {p.stockBaseline} stocked</p>
                    )}
                  </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ListPagination page={page} total={total} onPageChange={setPage} />
    </div>
  );
}
