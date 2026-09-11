'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Shop = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  active: boolean;
};

export default function ShopManager({ canEdit }: { canEdit: boolean }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/admin/shops', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setShops(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setError('');
    const res = await fetch('/api/admin/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, city }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not save');
      return;
    }
    setName('');
    setPhone('');
    setAddress('');
    setCity('');
    await load();
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Shops</h1>
        <p className="text-sm text-gray-500">
          Onboard shops, then tag products (max shops per item is set under Settings → Shop sourcing).
          Shopkeepers log in at /shop.
        </p>
      </div>
      {canEdit && (
        <div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(-10))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>City</Label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void save()} disabled={!name || phone.length < 10}>
              Add shop
            </Button>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      <ul className="space-y-2">
        {shops.map((shop) => (
          <li key={shop.id} className="bg-white border rounded-xl p-3">
            <p className="font-semibold">{shop.name}</p>
            <p className="text-sm text-gray-600">+91 {shop.phone} · {shop.city}</p>
            {!shop.active && <p className="text-xs text-red-500">Inactive</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
