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
  cityAliases: Record<string, string[]>;
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  storeTiming: string;
  storeStatus: 'OPEN' | 'CLOSED' | 'HOLIDAY';
  holidayMode: boolean;
  paymentMethods: string[];
  whatsappTemplates: Record<string, string>;
  whatsappNumber: string;
  checkoutMode: 'website' | 'whatsapp' | 'both';
  notificationSoundEnabled: boolean;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    showHealthStarRating: boolean;
    announcementBarText: string;
    deliveryTimeText: string;
    themeColor: string;
    promoSections: Array<{
      id: string;
      title: string;
      subtitle: string;
      link: string;
      theme: 'green' | 'blue' | 'orange' | 'purple';
      emoji: string;
      enabled: boolean;
    }>;
  };
}

const PAYMENT_OPTIONS = ['COD', 'QR_ON_DELIVERY', 'UPI', 'CARD'];

type SettingsErrorResponse = {
  error?: unknown;
  fieldErrors?: Record<string, string[] | undefined>;
};

function formatSettingsError(data: SettingsErrorResponse): string {
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (data.fieldErrors && typeof data.fieldErrors === 'object') {
    const details = Object.entries(data.fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .filter((line) => line.split(': ')[1]);
    if (details.length > 0) {
      return `Validation failed - ${details.join(' | ')}`;
    }
  }
  return 'Failed to save settings';
}

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
  const [whatsappNumber, setWhatsappNumber] = useState(initialConfig.whatsappNumber ?? '');
  const [homepageConfig, setHomepageConfig] = useState(initialConfig.homepageConfig);
  const [checkoutMode, setCheckoutMode] = useState<StoreConfig['checkoutMode']>(initialConfig.checkoutMode ?? 'both');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(
    initialConfig.notificationSoundEnabled ?? true,
  );
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

  function addPromoSection() {
    setHomepageConfig((prev) => ({
      ...prev,
      promoSections: [
        ...(prev.promoSections ?? []),
        {
          id: `promo-${Date.now()}`,
          title: '',
          subtitle: '',
          link: '',
          theme: 'green',
          emoji: '✨',
          enabled: true,
        },
      ],
    }));
  }

  function updatePromoSection(
    index: number,
    field: 'title' | 'subtitle' | 'link' | 'theme' | 'emoji' | 'enabled',
    value: string | boolean,
  ) {
    setHomepageConfig((prev) => ({
      ...prev,
      promoSections: (prev.promoSections ?? []).map((section, i) =>
        i === index ? { ...section, [field]: value } : section,
      ),
    }));
  }

  function removePromoSection(index: number) {
    setHomepageConfig((prev) => ({
      ...prev,
      promoSections: (prev.promoSections ?? []).filter((_, i) => i !== index),
    }));
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
          whatsappNumber,
          checkoutMode,
          notificationSoundEnabled,
          homepageConfig,
        }),
      });
      if (!res.ok) {
        const data: SettingsErrorResponse = await res.json().catch(() => ({}));
        throw new Error(formatSettingsError(data));
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
      setWhatsappNumber(updated.whatsappNumber ?? '');
      setCheckoutMode(updated.checkoutMode ?? 'both');
      setNotificationSoundEnabled(updated.notificationSoundEnabled ?? true);
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
        <p className="text-xs text-gray-400">Delivery is available when city OR pincode matches (either one is enough).</p>
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

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Business WhatsApp Number</h2>
        <p className="text-xs text-gray-400">
          Used for customer verification messages and order WhatsApp links. Include country code without + (e.g. 919046370119 or 61412345678).
        </p>
        <Input
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="919046370119"
          disabled={!canEdit}
          className="max-w-sm"
        />
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Checkout Mode</h2>
        <p className="text-xs text-gray-400">Control which order placement buttons customers see. Changes apply immediately.</p>
        <select
          value={checkoutMode}
          onChange={(e) => setCheckoutMode(e.target.value as StoreConfig['checkoutMode'])}
          disabled={!canEdit}
          className="border rounded-lg px-3 py-2 text-sm max-w-xs"
        >
          <option value="both">Both — Website + WhatsApp</option>
          <option value="website">Website Orders Only</option>
          <option value="whatsapp">WhatsApp Orders Only</option>
        </select>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Notification Sound</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notificationSoundEnabled}
            onChange={(e) => setNotificationSoundEnabled(e.target.checked)}
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Play sound when a new order arrives
        </label>
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
        <h2 className="font-bold text-sm">Featured Section</h2>
        <p className="text-xs text-gray-400">
          Controls the customer homepage Best Sellers (featured products) section visibility.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={homepageConfig.showBestSellers}
            onChange={(e) =>
              setHomepageConfig((prev) => ({ ...prev, showBestSellers: e.target.checked }))
            }
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Show Featured Products (Best Sellers)
        </label>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Health Star Rating</h2>
        <p className="text-xs text-gray-400">
          When off, Health Star Ratings are hidden everywhere — even if products have a rating set.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={homepageConfig.showHealthStarRating !== false}
            onChange={(e) =>
              setHomepageConfig((prev) => ({ ...prev, showHealthStarRating: e.target.checked }))
            }
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Show Health Star Rating on storefront
        </label>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm">Homepage Promo Sections</h2>
            <p className="text-xs text-gray-400 mt-1">
              Add cards like Pharmacy/Pet Care/Paan Corner, set destination link, and toggle live visibility.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addPromoSection} disabled={!canEdit}>
            <Plus size={16} /> Add Section
          </Button>
        </div>
        <div className="space-y-3">
          {(homepageConfig.promoSections ?? []).length === 0 && (
            <p className="text-sm text-gray-400">No promo sections configured.</p>
          )}
          {(homepageConfig.promoSections ?? []).map((section, index) => (
            <div key={section.id || `${section.title}-${index}`} className="rounded-lg border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">Section #{index + 1}</p>
                <button
                  type="button"
                  onClick={() => removePromoSection(index)}
                  className="text-gray-400 hover:text-red-500"
                  disabled={!canEdit}
                  aria-label={`Remove promo section ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updatePromoSection(index, 'title', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Subtitle</Label>
                  <Input
                    value={section.subtitle}
                    onChange={(e) => updatePromoSection(index, 'subtitle', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Navigate To (Link)</Label>
                  <Input
                    placeholder="/category/pet-care"
                    value={section.link}
                    onChange={(e) => updatePromoSection(index, 'link', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Theme</Label>
                    <select
                      value={section.theme}
                      onChange={(e) => updatePromoSection(index, 'theme', e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                      disabled={!canEdit}
                    >
                      <option value="green">Green</option>
                      <option value="blue">Blue</option>
                      <option value="orange">Orange</option>
                      <option value="purple">Purple</option>
                    </select>
                  </div>
                  <div>
                    <Label>Emoji</Label>
                    <Input
                      value={section.emoji}
                      onChange={(e) => updatePromoSection(index, 'emoji', e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(e) => updatePromoSection(index, 'enabled', e.target.checked)}
                  disabled={!canEdit}
                  className="accent-blinkit-green"
                />
                Toggle live (show on homepage)
              </label>
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
