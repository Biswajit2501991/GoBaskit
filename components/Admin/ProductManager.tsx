'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormData } from '@/lib/validations';
import { calculateDiscountPercent } from '@/utils/pricing';
import { resolvePublicImageUrl } from '@/utils/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import ProductImageUpload from './ProductImageUpload';
import SellingPriceHistoryNote from './SellingPriceHistoryNote';
import ProductPriceDisplay from '@/components/ProductCard/ProductPriceDisplay';
import VariantAdminTable from './VariantAdminTable';
import ListPagination from './ListPagination';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import { isLowStock } from '@/utils/inventory';
import {
  useAdminProductsStore,
  adminProductListKey,
  type AdminProduct,
  type AdminCategory,
} from '@/store/adminProductsStore';

export type { AdminProduct, AdminCategory };

/** Stable empty refs — Zustand selectors must not return a fresh `[]` each call
 *  or useSyncExternalStore loops (React minified error #185). */
const EMPTY_CATEGORIES: AdminCategory[] = [];
const EMPTY_PRODUCTS: AdminProduct[] = [];

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
  fulfillmentSource: 'UNSET',
  costPrice: null,
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'IN_HOUSE' | 'OUTSOURCE' | 'UNSET'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [priceHistory, setPriceHistory] = useState<{
    previousPrice: number | null;
    earlierPrice: number | null;
    previousPriceAt: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCost, setBulkCost] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [resetOptions, setResetOptions] = useState(false);
  const searchDebounced = useRef(search);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    fetch('/api/admin/shops', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];
        setShops(items.map((shop: { id: string; name: string }) => ({ id: shop.id, name: shop.name })));
      })
      .catch(() => setShops([]));
  }, []);

  const listParams = {
    page,
    pageSize: ADMIN_LIST_PAGE_SIZE,
    search: debouncedSearch,
    categoryId: categoryFilter || undefined,
    sort,
    stock: stockFilter,
    source: sourceFilter,
  };
  const cacheKey = adminProductListKey(listParams);
  const cached = useAdminProductsStore((s) => s.lists[cacheKey]);
  const storeCategories = useAdminProductsStore((s) => s.categories);
  const categories =
    storeCategories.length > 0
      ? storeCategories
      : initialCategories?.length
        ? initialCategories
        : EMPTY_CATEGORIES;
  const fetchProducts = useAdminProductsStore((s) => s.fetchProducts);
  const refreshProducts = useAdminProductsStore((s) => s.refreshProducts);
  const setStoreCategories = useAdminProductsStore((s) => s.setCategories);

  const products = cached?.items ?? EMPTY_PRODUCTS;
  const total = cached?.total ?? 0;
  // Only blank the table when we have nothing cached for this filter.
  const loading = !cached;

  useEffect(() => {
    if (initialCategories?.length) {
      setStoreCategories(initialCategories);
    }
  }, [initialCategories, setStoreCategories]);

  // Debounce search so typing doesn't hammer the API / clear cache keys.
  useEffect(() => {
    searchDebounced.current = search;
    if (!search) {
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => {
      if (searchDebounced.current === search) setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void fetchProducts(listParams);
    // listParams fields are primitives — expand for stable deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, categoryFilter, stockFilter, sourceFilter, sort, fetchProducts]);

  async function reloadAfterMutation() {
    // Refresh client cache only — avoid router.refresh(), which remounts the
    // admin RSC tree and can surface ChunkLoadError / error.tsx after deploys.
    await refreshProducts(listParams);
    if (useAdminProductsStore.getState().categories.length === 0) {
      await useAdminProductsStore.getState().fetchCategories();
    }
  }

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
    setShopIds([]);
    setPriceHistory(null);
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
      fulfillmentSource: product.fulfillmentSource ?? 'UNSET',
      costPrice: product.costPrice ?? null,
    });
    setShopIds(product.shopIds ?? []);
    setPriceHistory({
      previousPrice: product.previousPrice ?? null,
      earlierPrice: product.earlierPrice ?? null,
      previousPriceAt: product.previousPriceAt ?? null,
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
    const productId = editingId || saved?.id;
    if (productId) {
      await fetch(`/api/admin/products/${productId}/shops`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopIds }),
      });
    }
    await reloadAfterMutation();

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
    await reloadAfterMutation();
  }

  async function applyBulkSource(fulfillmentSource: 'UNSET' | 'IN_HOUSE' | 'OUTSOURCE') {
    if (!canEdit || selectedIds.length === 0) return;
    const label =
      fulfillmentSource === 'IN_HOUSE'
        ? 'In House'
        : fulfillmentSource === 'OUTSOURCE'
          ? 'Outsource'
          : 'Untagged';
    const filterHint = categoryFilter
      ? categories.find((c) => c.id === categoryFilter)?.name || 'this filter'
      : search.trim()
        ? `"${search.trim()}"`
        : 'the catalogue';
    const costNote =
      bulkCost !== '' && Number.isFinite(Number(bulkCost))
        ? ` Cost will be set to ₹${Number(bulkCost)}.`
        : ' Selling price, stock, and cost will not change.';
    const optionNote = resetOptions
      ? ' Options will be reset to Same as product.'
      : '';
    if (
      !confirm(
        `Mark ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'} matching ${filterHint} as ${label}?${costNote}${optionNote}`,
      )
    ) {
      return;
    }

    const uniqueIds = [...new Set(selectedIds)];
    const costPayload =
      bulkCost !== '' && Number.isFinite(Number(bulkCost)) ? { costPrice: Number(bulkCost) } : {};
    setBulkBusy(true);
    let updated = 0;
    try {
      for (let i = 0; i < uniqueIds.length; i += 200) {
        const chunk = uniqueIds.slice(i, i + 200);
        const res = await fetch('/api/admin/products/bulk-source', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: chunk,
            fulfillmentSource,
            resetOptions,
            ...costPayload,
          }),
        });
        if (!res.ok) {
          alert('Could not tag the selected products');
          return;
        }
        const json = await res.json().catch(() => ({ updated: chunk.length }));
        updated += Number(json.updated) || chunk.length;
      }
    } finally {
      setBulkBusy(false);
    }
    setSelectedIds([]);
    await reloadAfterMutation();
  }

  async function selectThisPage() {
    setSelectedIds(products.map((p) => p.id));
  }

  async function selectAllMatching() {
    if (!canEdit) return;
    const qs = new URLSearchParams({ idsOnly: '1' });
    if (debouncedSearch) qs.set('search', debouncedSearch);
    if (categoryFilter) qs.set('categoryId', categoryFilter);
    if (stockFilter !== 'all') qs.set('stock', stockFilter);
    if (sourceFilter !== 'all') qs.set('source', sourceFilter);
    const res = await fetch(`/api/admin/products?${qs}`, { cache: 'no-store' });
    if (!res.ok) {
      alert('Could not load matching products');
      return;
    }
    const json = await res.json();
    const ids = Array.isArray(json.ids) ? json.ids.filter((id: unknown) => typeof id === 'string') : [];
    setSelectedIds(ids);
  }

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));

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
        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out');
            setPage(1);
          }}
          className={`max-w-[11rem] ${selectClass}`}
          aria-label="Filter by stock"
        >
          <option value="all">All stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value as 'all' | 'IN_HOUSE' | 'OUTSOURCE' | 'UNSET');
            setPage(1);
          }}
          className={`max-w-[11rem] ${selectClass}`}
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="IN_HOUSE">In house</option>
          <option value="OUTSOURCE">Outsource</option>
          <option value="UNSET">Untagged</option>
        </select>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <Button type="button" size="sm" variant="secondary" disabled={bulkBusy || products.length === 0} onClick={() => void selectThisPage()}>
            This page
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={bulkBusy || total === 0} onClick={() => void selectAllMatching()}>
            All matching ({total})
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={bulkBusy || selectedIds.length === 0} onClick={() => setSelectedIds([])}>
            Clear
          </Button>
          <Button type="button" size="sm" disabled={bulkBusy || selectedIds.length === 0} onClick={() => void applyBulkSource('IN_HOUSE')}>
            In House
          </Button>
          <Button type="button" size="sm" disabled={bulkBusy || selectedIds.length === 0} onClick={() => void applyBulkSource('OUTSOURCE')}>
            Outsource
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={bulkBusy || selectedIds.length === 0} onClick={() => void applyBulkSource('UNSET')}>
            Untagged
          </Button>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional cost ₹"
            value={bulkCost}
            onChange={(e) => setBulkCost(e.target.value)}
            className="w-36 h-8"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={resetOptions}
              onChange={(e) => setResetOptions(e.target.checked)}
            />
            Reset options to Same as product
          </label>
        </div>
      )}

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
                {editingId ? (
                  <SellingPriceHistoryNote currentPrice={sellingPrice} history={priceHistory} />
                ) : null}
              </div>

              <div>
                <Label>Fulfillment</Label>
                <select {...register('fulfillmentSource')} className={`mt-1 ${selectClass}`} disabled={!canEdit}>
                  <option value="UNSET">Untagged</option>
                  <option value="IN_HOUSE">In House</option>
                  <option value="OUTSOURCE">Outsource</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Used on Profit Dashboard. Not shown to customers.</p>
              </div>

              <div>
                <Label>Cost (₹)</Label>
                <Input
                  {...register('costPrice')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="GoBaskit unit cost"
                  className="mt-1"
                  disabled={!canEdit}
                />
                {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice.message}</p>}
                <p className="text-[11px] text-gray-400 mt-1">In-house profit uses this cost × quantity. Not MRP.</p>
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
                  disabled={!canEdit}
                />
                {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>}
                {stockNeedsAttention ? (
                  <p className="text-[11px] text-amber-800 font-semibold mt-1">
                    Enter how many units you have in stock. Do not leave this as 0 when adding a new product.
                  </p>
                ) : hasVariants ? (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Stock for the <strong>base option</strong> (first choice on the storefront). Extra brands/sizes have their own stock in Variant Management below.
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
                  When enabled, customers pick a specific option. The fields above (price, stock, image) are the base option; extra brands/sizes are managed below.
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
            {shops.length > 0 && (
              <div className="mt-4">
                <Label>Sold at shops</Label>
                <p className="text-xs text-gray-400 mb-2">Tag at most the limit from Settings → Shop sourcing.</p>
                <div className="flex flex-wrap gap-2">
                  {shops.map((shop) => (
                    <label key={shop.id} className="flex items-center gap-1 text-sm border rounded-lg px-2 py-1">
                      <input
                        type="checkbox"
                        checked={shopIds.includes(shop.id)}
                        onChange={(e) => {
                          setShopIds((prev) =>
                            e.target.checked ? [...prev, shop.id] : prev.filter((id) => id !== shop.id),
                          );
                        }}
                      />
                      {shop.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(products.map((p) => p.id));
                      else setSelectedIds([]);
                    }}
                    disabled={!canEdit}
                  />
                </th>
                <th className="text-left p-3 font-semibold w-14">Image</th>
                <th className="text-left p-3 font-semibold">Name</th>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Price</th>
                <th className="text-left p-3 font-semibold">Source</th>
                <th className="text-left p-3 font-semibold">Unit</th>
                <th className="text-left p-3 font-semibold">Stock</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    {search || categoryFilter || stockFilter !== 'all' || sourceFilter !== 'all' ? 'No products match your filters.' : 'No products yet. Click Add Product to create one.'}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      disabled={!canEdit}
                      onChange={(e) => {
                        setSelectedIds((ids) =>
                          e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                        );
                      }}
                    />
                  </td>
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
                      {p.category?.name ?? '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    <ProductPriceDisplay price={p.price} actualPrice={p.actualPrice} size="sm" />
                  </td>
                  <td className="p-3 text-xs font-semibold text-gray-600">
                    {p.fulfillmentSource === 'IN_HOUSE'
                      ? 'In house'
                      : p.fulfillmentSource === 'OUTSOURCE'
                        ? 'Outsource'
                        : '—'}
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
