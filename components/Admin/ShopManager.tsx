'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ShopProductCatalog from '@/components/Admin/ShopProductCatalog';

type Shop = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  active: boolean;
};

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  city: '',
  active: true,
};

export default function ShopManager({
  canEdit,
  canTagProducts,
}: {
  canEdit: boolean;
  canTagProducts: boolean;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogShop, setCatalogShop] = useState<Shop | null>(null);

  async function load() {
    const res = await fetch('/api/admin/shops', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setShops(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(shop: Shop) {
    setError('');
    setEditingId(shop.id);
    setForm({
      name: shop.name,
      phone: shop.phone.replace(/\D/g, '').slice(-10),
      address: shop.address ?? '',
      city: shop.city ?? '',
      active: shop.active !== false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/shops/${editingId}` : '/api/admin/shops', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          active: form.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save');
        return;
      }
      const saved = data as Shop;
      cancelEdit();
      await load();
      setCatalogShop((current) => (current && saved.id === current.id ? { ...current, ...saved } : current));
    } finally {
      setSaving(false);
    }
  }

  const canSave = form.name.trim().length >= 2 && form.phone.replace(/\D/g, '').length === 10;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Shops</h1>
        <p className="text-sm text-gray-500">
          Onboard shops, then open Products on a shop to tick the catalogue (by category, or all).
          Max shops per item is under Settings → Shop sourcing. Shopkeepers log in at /shop.
        </p>
      </div>
      {canEdit && (
        <div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-2 gap-3">
          <p className="sm:col-span-2 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit shop' : 'Add shop'}
          </p>
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(-10) })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>City</Label>
            <Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          {editingId && (
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          )}
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="button" onClick={() => void save()} disabled={!canSave || saving}>
              {saving ? 'Saving…' : editingId ? 'Save shop' : 'Add shop'}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      <ul className="space-y-2">
        {shops.map((shop) => (
          <li key={shop.id} className="bg-white border rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{shop.name}</p>
              <p className="text-sm text-gray-600">+91 {shop.phone} · {shop.city}</p>
              {!shop.active && <p className="text-xs text-red-500">Inactive</p>}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(shop)}>
                  Edit
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setCatalogShop(shop)}>
                Products
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {catalogShop && (
        <ShopProductCatalog
          shopId={catalogShop.id}
          shopName={catalogShop.name}
          canEdit={canTagProducts}
          onClose={() => setCatalogShop(null)}
        />
      )}
    </div>
  );
}
