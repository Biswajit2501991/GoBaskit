'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { DeliverySlab } from '@/constants';

interface StoreConfig {
  serviceablePins: string[];
  serviceableCities: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  storeTiming: string;
  storeStatus: 'OPEN' | 'CLOSED' | 'HOLIDAY';
  holidayMode: boolean;
  paymentMethods: string[];
  whatsappTemplates: Record<string, string>;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    announcementBarText: string;
    deliveryTimeText: string;
    themeColor: string;
  };
}

const PAYMENT_OPTIONS = ['COD', 'QR_ON_DELIVERY', 'UPI', 'CARD'];

export default function SettingsManager({
  initialConfig,
  canEdit,
}: {
  initialConfig: StoreConfig;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [minOrderValue, setMinOrderValue] = useState<number>(initialConfig.minOrderValue);
  const [pins, setPins] = useState<string[]>(initialConfig.serviceablePins);
  const [newPin, setNewPin] = useState('');
  const [cities, setCities] = useState<string[]>(initialConfig.serviceableCities);
  const [newCity, setNewCity] = useState('');
  const [slabs, setSlabs] = useState<DeliverySlab[]>(initialConfig.deliverySlabs);
  const [storeTiming, setStoreTiming] = useState(initialConfig.storeTiming);
  const [storeStatus, setStoreStatus] = useState<StoreConfig['storeStatus']>(initialConfig.storeStatus);
  const [holidayMode, setHolidayMode] = useState(initialConfig.holidayMode);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialConfig.paymentMethods);
  const [whatsappTemplates, setWhatsappTemplates] = useState<Record<string, string>>(
    initialConfig.whatsappTemplates,
  );
  const [homepageConfig, setHomepageConfig] = useState(initialConfig.homepageConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function addPin() {
    const p = newPin.trim();
    if (!/^\d{6}$/.test(p)) {
      setMessage({ type: 'err', text: 'PIN must be exactly 6 digits.' });
      return;
    }
    if (pins.includes(p)) {
      setMessage({ type: 'err', text: 'That PIN is already in the list.' });
      return;
    }
    setPins([...pins, p]);
    setNewPin('');
    setMessage(null);
  }

  function removePin(pin: string) {
    setPins(pins.filter((p) => p !== pin));
  }

  function addCity() {
    const c = newCity.trim();
    if (c.length < 2) {
      setMessage({ type: 'err', text: 'City must be at least 2 characters.' });
      return;
    }
    if (cities.some((city) => city.toLowerCase() === c.toLowerCase())) {
      setMessage({ type: 'err', text: 'That city is already in the list.' });
      return;
    }
    setCities([...cities, c]);
    setNewCity('');
    setMessage(null);
  }

  function removeCity(cityToRemove: string) {
    setCities(cities.filter((c) => c !== cityToRemove));
  }

  function updateSlab(index: number, field: keyof DeliverySlab, value: number) {
    setSlabs(slabs.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSlab() {
    const lastMax = slabs.length ? slabs[slabs.length - 1].max : 0;
    setSlabs([...slabs, { min: lastMax + 1, max: lastMax + 100, charge: 0 }]);
  }

  function removeSlab(index: number) {
    setSlabs(slabs.filter((_, i) => i !== index));
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceablePins: pins,
          serviceableCities: cities,
          deliverySlabs: slabs.map((s) => ({ min: Number(s.min), max: Number(s.max), charge: Number(s.charge) })),
          minOrderValue: Number(minOrderValue),
          storeTiming,
          storeStatus,
          holidayMode,
          paymentMethods,
          whatsappTemplates,
          homepageConfig,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save settings');
      }
      const updated: StoreConfig = await res.json();
      setPins(updated.serviceablePins);
      setCities(updated.serviceableCities);
      setSlabs(updated.deliverySlabs);
      setMinOrderValue(updated.minOrderValue);
      setStoreTiming(updated.storeTiming);
      setStoreStatus(updated.storeStatus);
      setHolidayMode(updated.holidayMode);
      setPaymentMethods(updated.paymentMethods);
      setWhatsappTemplates(updated.whatsappTemplates);
      setHomepageConfig(updated.homepageConfig);
      setMessage({ type: 'ok', text: 'Settings saved.' });
      router.refresh();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Store Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Delivery area, delivery charges, and minimum order. Changes apply to new orders immediately.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Minimum order value */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Minimum Order Value</h2>
        <div className="flex items-center gap-2 max-w-xs">
          <span className="text-gray-500">₹</span>
          <Input
            type="number"
            min={0}
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(Number(e.target.value))}
            disabled={!canEdit}
          />
        </div>
        <p className="text-xs text-gray-400">Orders below this subtotal are blocked. Set 0 to disable.</p>
      </section>

      {/* Serviceable PINs */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Serviceable PIN Codes</h2>
        <p className="text-xs text-gray-400">Orders can only be placed for these delivery PIN codes.</p>
        <div className="flex flex-wrap gap-2">
          {pins.length === 0 && <span className="text-sm text-gray-400">No PINs added yet.</span>}
          {pins.map((pin) => (
            <span key={pin} className="inline-flex items-center gap-2 bg-blinkit-green-light text-blinkit-green rounded-full px-3 py-1 text-sm font-medium">
              {pin}
              <button type="button" onClick={() => removePin(pin)} aria-label={`Remove ${pin}`} className="hover:text-red-500" disabled={!canEdit}>
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2 max-w-xs">
          <div className="flex-1">
            <Label>Add PIN</Label>
            <Input
              value={newPin}
              maxLength={6}
              inputMode="numeric"
              placeholder="6-digit PIN"
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              disabled={!canEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPin();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={addPin} disabled={!canEdit}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Serviceable Cities</h2>
        <p className="text-xs text-gray-400">Orders can only be placed for these cities.</p>
        <div className="flex flex-wrap gap-2">
          {cities.length === 0 && <span className="text-sm text-gray-400">No cities added yet.</span>}
          {cities.map((city) => (
            <span key={city} className="inline-flex items-center gap-2 bg-blinkit-green-light text-blinkit-green rounded-full px-3 py-1 text-sm font-medium">
              {city}
              <button type="button" onClick={() => removeCity(city)} aria-label={`Remove ${city}`} className="hover:text-red-500" disabled={!canEdit}>
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2 max-w-xs">
          <div className="flex-1">
            <Label>Add City</Label>
            <Input
              value={newCity}
              placeholder="City name"
              onChange={(e) => setNewCity(e.target.value)}
              disabled={!canEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCity();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={addCity} disabled={!canEdit}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </section>

      {/* Delivery slabs */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Delivery Charge Slabs</h2>
        <p className="text-xs text-gray-400">Delivery fee by order subtotal range (₹). The highest slab applies above its range.</p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-gray-500 px-1">
            <span>Min (₹)</span>
            <span>Max (₹)</span>
            <span>Charge (₹)</span>
            <span></span>
          </div>
          {slabs.map((slab, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <Input type="number" min={0} value={slab.min} onChange={(e) => updateSlab(i, 'min', Number(e.target.value))} disabled={!canEdit} />
              <Input type="number" min={0} value={slab.max} onChange={(e) => updateSlab(i, 'max', Number(e.target.value))} disabled={!canEdit} />
              <Input type="number" min={0} value={slab.charge} onChange={(e) => updateSlab(i, 'charge', Number(e.target.value))} disabled={!canEdit} />
              <button type="button" onClick={() => removeSlab(i)} aria-label="Remove slab" className="text-gray-400 hover:text-red-500 p-2" disabled={!canEdit}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={addSlab} disabled={!canEdit}>
          <Plus size={16} /> Add slab
        </Button>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Store Status & Timing</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Store Timing</Label>
            <Input value={storeTiming} onChange={(e) => setStoreTiming(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={storeStatus}
              onChange={(e) => setStoreStatus(e.target.value as StoreConfig['storeStatus'])}
              className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
              disabled={!canEdit}
            >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={holidayMode} onChange={(e) => setHolidayMode(e.target.checked)} disabled={!canEdit} />
            Holiday mode
          </label>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Payment Methods</h2>
        <div className="flex flex-wrap gap-3">
          {PAYMENT_OPTIONS.map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={paymentMethods.includes(method)}
                onChange={(e) =>
                  setPaymentMethods((prev) =>
                    e.target.checked ? [...new Set([...prev, method])] : prev.filter((m) => m !== method),
                  )
                }
                disabled={!canEdit}
              />
              {method}
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">WhatsApp Templates</h2>
        <p className="text-xs text-gray-400">Used for quick send actions in order management.</p>
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(whatsappTemplates).map(([key, value]) => (
            <div key={key}>
              <Label>{key.replace(/_/g, ' ')}</Label>
              <textarea
                value={value}
                onChange={(e) => setWhatsappTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                className="mt-1 w-full min-h-[78px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Homepage Configuration</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={homepageConfig.showHeroBanner}
              onChange={(e) => setHomepageConfig((prev) => ({ ...prev, showHeroBanner: e.target.checked }))}
              disabled={!canEdit}
            />
            Show Hero Banner
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={homepageConfig.showCategories}
              onChange={(e) => setHomepageConfig((prev) => ({ ...prev, showCategories: e.target.checked }))}
              disabled={!canEdit}
            />
            Show Categories
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={homepageConfig.showBestSellers}
              onChange={(e) => setHomepageConfig((prev) => ({ ...prev, showBestSellers: e.target.checked }))}
              disabled={!canEdit}
            />
            Show Best Sellers
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={homepageConfig.showOffers}
              onChange={(e) => setHomepageConfig((prev) => ({ ...prev, showOffers: e.target.checked }))}
              disabled={!canEdit}
            />
            Show Offers
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Announcement Bar</Label>
            <Input
              value={homepageConfig.announcementBarText}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, announcementBarText: e.target.value }))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Delivery Text</Label>
            <Input
              value={homepageConfig.deliveryTimeText}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, deliveryTimeText: e.target.value }))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Theme Color</Label>
            <Input
              value={homepageConfig.themeColor}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, themeColor: e.target.value }))
              }
              disabled={!canEdit}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        {canEdit ? (
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        ) : (
          <span className="text-sm text-gray-500">Read-only access</span>
        )}
      </div>
    </div>
  );
}
