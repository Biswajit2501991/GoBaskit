'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { DeliverySlab } from '@/constants';
import type { DiscountConfig } from '@/services/SettingsService';
import type { HealthStarDisplay } from '@/constants/healthStarDisplay';
import { DEFAULT_HEALTH_STAR_DISPLAY } from '@/constants/healthStarDisplay';
import DiscountManager from '@/components/Admin/DiscountManager';
import ProductImageUpload from '@/components/Admin/ProductImageUpload';

const SETTINGS_SECTIONS = [
  { id: 'min-order', label: 'Min Order', group: 'Delivery' },
  { id: 'pins', label: 'PIN Codes', group: 'Delivery' },
  { id: 'cities', label: 'Cities', group: 'Delivery' },
  { id: 'delivery-slabs', label: 'Delivery Fees', group: 'Delivery' },
  { id: 'whatsapp', label: 'WhatsApp Number', group: 'Orders' },
  { id: 'checkout', label: 'Checkout Mode', group: 'Orders' },
  { id: 'notifications', label: 'Notifications', group: 'Orders' },
  { id: 'session', label: 'Staff Session', group: 'Orders' },
  { id: 'store-status', label: 'Store Status', group: 'Orders' },
  { id: 'payments', label: 'Payments', group: 'Orders' },
  { id: 'wa-templates', label: 'WA Templates', group: 'Orders' },
  { id: 'cancellation', label: 'Cancellation Policy', group: 'Orders' },
  { id: 'featured', label: 'Discovery Rails', group: 'Homepage' },
  { id: 'health-star', label: 'Health Star', group: 'Homepage' },
  { id: 'branding', label: 'Branding', group: 'Homepage' },
  { id: 'promo', label: 'Promo Cards', group: 'Homepage' },
  { id: 'homepage', label: 'Homepage Layout', group: 'Homepage' },
  { id: 'discounts', label: 'Discounts & Coupons', group: 'Offers' },
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

const SETTINGS_SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((s) => s.id));

const SETTINGS_GROUPS = SETTINGS_SECTIONS.reduce<
  Array<{ name: string; items: Array<(typeof SETTINGS_SECTIONS)[number]> }>
>((acc, section) => {
  const existing = acc.find((g) => g.name === section.group);
  if (existing) existing.items.push(section);
  else acc.push({ name: section.group, items: [section] });
  return acc;
}, []);

function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.has(value);
}

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
  staffIdleTimeoutEnabled: boolean;
  staffIdleTimeoutMinutes: number;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    showHealthStarRating: boolean;
    healthStarDisplay: HealthStarDisplay;
    announcementBarText: string;
    deliveryTimeText: string;
    deliveryDisclaimer: string;
    themeColor: string;
    cancellationPolicy: string;
    showPoweredByBanner: boolean;
    poweredByText: string;
    showLoginLogo: boolean;
    loginLogoUrl: string;
    showTopDiscounted?: boolean;
    topDiscountedTitle?: string;
    topDiscountedLimit?: number;
    showMostLoved?: boolean;
    mostLovedTitle?: string;
    mostLovedLimit?: number;
    showCategoryRails?: boolean;
    categoryRailLimit?: number;
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
  discountConfig: DiscountConfig;
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
  const [homepageConfig, setHomepageConfig] = useState(() => {
    const hc = initialConfig.homepageConfig ?? ({} as StoreConfig['homepageConfig']);
    return {
      showHeroBanner: hc.showHeroBanner ?? true,
      showCategories: hc.showCategories ?? true,
      showBestSellers: hc.showBestSellers ?? true,
      showOffers: hc.showOffers ?? true,
      showHealthStarRating: hc.showHealthStarRating !== false,
      announcementBarText: hc.announcementBarText ?? '',
      deliveryTimeText: hc.deliveryTimeText ?? '',
      deliveryDisclaimer: hc.deliveryDisclaimer ?? '',
      themeColor: hc.themeColor ?? '#0B7A3E',
      cancellationPolicy: hc.cancellationPolicy ?? '',
      showPoweredByBanner: hc.showPoweredByBanner !== false,
      poweredByText:
        hc.poweredByText ?? 'Powered by Action Plus Gym · Healthy Life · Wealthy Life',
      showLoginLogo: hc.showLoginLogo !== false,
      loginLogoUrl: hc.loginLogoUrl || '/branding/gobaskit-seal.png',
      showTopDiscounted: hc.showTopDiscounted !== false,
      topDiscountedTitle: hc.topDiscountedTitle ?? 'Top Discounted Items',
      topDiscountedLimit: hc.topDiscountedLimit ?? 12,
      showMostLoved:
        hc.showMostLoved !== undefined ? hc.showMostLoved !== false : hc.showBestSellers !== false,
      mostLovedTitle: hc.mostLovedTitle ?? 'Most Loved',
      mostLovedLimit: hc.mostLovedLimit ?? 8,
      showCategoryRails: hc.showCategoryRails !== false,
      categoryRailLimit: hc.categoryRailLimit ?? 8,
      promoSections: hc.promoSections ?? [],
      healthStarDisplay: {
        ...DEFAULT_HEALTH_STAR_DISPLAY,
        ...(hc.healthStarDisplay ?? {}),
        badges:
          hc.healthStarDisplay?.badges?.length
            ? hc.healthStarDisplay.badges
            : DEFAULT_HEALTH_STAR_DISPLAY.badges,
      },
    };
  });
  const [checkoutMode, setCheckoutMode] = useState<StoreConfig['checkoutMode']>(initialConfig.checkoutMode ?? 'both');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(
    initialConfig.notificationSoundEnabled ?? true,
  );
  const [staffIdleTimeoutEnabled, setStaffIdleTimeoutEnabled] = useState(
    initialConfig.staffIdleTimeoutEnabled ?? true,
  );
  const [staffIdleTimeoutMinutes, setStaffIdleTimeoutMinutes] = useState(
    initialConfig.staffIdleTimeoutMinutes ?? 15,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [newBadgeLabel, setNewBadgeLabel] = useState('');
  const [newBadgeUrl, setNewBadgeUrl] = useState('');
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('min-order');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && isSettingsSectionId(hash)) {
      setActiveSection(hash);
    }
  }, []);

  function openSection(id: SettingsSectionId) {
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  const healthStarDisplay = homepageConfig.healthStarDisplay ?? DEFAULT_HEALTH_STAR_DISPLAY;
  const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0];
  const showMainSave = activeSection !== 'discounts';

  function updateHealthStarDisplay(patch: Partial<HealthStarDisplay>) {
    setHomepageConfig((prev) => ({
      ...prev,
      healthStarDisplay: {
        ...DEFAULT_HEALTH_STAR_DISPLAY,
        ...(prev.healthStarDisplay ?? {}),
        ...patch,
      },
    }));
  }

  function addHealthStarBadge() {
    const url = newBadgeUrl.trim();
    if (!url) {
      setMessage({ type: 'err', text: 'Upload a health star badge image first.' });
      return;
    }
    const id = `badge-${Date.now()}`;
    const label = newBadgeLabel.trim() || `Badge ${healthStarDisplay.badges.length + 1}`;
    const badges = [...(healthStarDisplay.badges ?? []), { id, label, url }];
    updateHealthStarDisplay({
      badges,
      badgeUrl: healthStarDisplay.badgeUrl || url,
    });
    setNewBadgeLabel('');
    setNewBadgeUrl('');
    setMessage(null);
  }

  function removeHealthStarBadge(id: string) {
    const badges = (healthStarDisplay.badges ?? []).filter((b) => b.id !== id);
    const badgeUrl =
      healthStarDisplay.badgeUrl && badges.some((b) => b.url === healthStarDisplay.badgeUrl)
        ? healthStarDisplay.badgeUrl
        : badges[0]?.url || DEFAULT_HEALTH_STAR_DISPLAY.badgeUrl;
    updateHealthStarDisplay({ badges, badgeUrl });
  }

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
          staffIdleTimeoutEnabled,
          staffIdleTimeoutMinutes: Number(staffIdleTimeoutMinutes),
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
      setStaffIdleTimeoutEnabled(updated.staffIdleTimeoutEnabled ?? true);
      setStaffIdleTimeoutMinutes(updated.staffIdleTimeoutMinutes ?? 15);
      setHomepageConfig({
        ...updated.homepageConfig,
        showTopDiscounted: updated.homepageConfig.showTopDiscounted !== false,
        topDiscountedTitle:
          updated.homepageConfig.topDiscountedTitle ?? 'Top Discounted Items',
        topDiscountedLimit: updated.homepageConfig.topDiscountedLimit ?? 12,
        showMostLoved:
          updated.homepageConfig.showMostLoved !== undefined
            ? updated.homepageConfig.showMostLoved !== false
            : updated.homepageConfig.showBestSellers !== false,
        mostLovedTitle: updated.homepageConfig.mostLovedTitle ?? 'Most Loved',
        mostLovedLimit: updated.homepageConfig.mostLovedLimit ?? 8,
        showCategoryRails: updated.homepageConfig.showCategoryRails !== false,
        categoryRailLimit: updated.homepageConfig.categoryRailLimit ?? 8,
        healthStarDisplay: {
          ...DEFAULT_HEALTH_STAR_DISPLAY,
          ...(updated.homepageConfig.healthStarDisplay ?? {}),
          badges:
            updated.homepageConfig.healthStarDisplay?.badges?.length
              ? updated.homepageConfig.healthStarDisplay.badges
              : DEFAULT_HEALTH_STAR_DISPLAY.badges,
        },
      });
      setMessage({ type: 'ok', text: 'Settings saved.' });
      router.refresh();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Store Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Open one section at a time. Save still applies to the whole store config — nothing else changes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="block lg:hidden">
            <span className="sr-only">Jump to settings section</span>
            <select
              value={activeSection}
              onChange={(e) => {
                const next = e.target.value;
                if (isSettingsSectionId(next)) openSection(next);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800"
            >
              {SETTINGS_GROUPS.map((group) => (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <nav
            aria-label="Settings sections"
            className="hidden lg:block lg:sticky lg:top-16 self-start rounded-xl border border-gray-200 bg-white p-3 space-y-4"
          >
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.name}>
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {group.name}
                </p>
                <div className="space-y-1">
                  {group.items.map((section) => {
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => openSection(section.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blinkit-green-light text-blinkit-green'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {activeMeta.group}
              </p>
              <h2 className="text-lg font-bold text-gray-900">{activeMeta.label}</h2>
            </div>
            {showMainSave &&
              (canEdit ? (
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              ) : (
                <span className="text-sm text-gray-500">Read-only</span>
              ))}
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

          {activeSection === 'min-order' && (
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
          )}

          {activeSection === 'pins' && (
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
          )}

          {activeSection === 'cities' && (
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
          )}

          {activeSection === 'whatsapp' && (
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
          )}

          {activeSection === 'checkout' && (
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
          )}

          {activeSection === 'notifications' && (
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
          )}

          {activeSection === 'session' && (
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-sm">Staff session timeout</h2>
          <p className="text-xs text-gray-400 mt-1">
            While staff use Admin, a live heartbeat keeps the login active. If idle timeout is on
            and nobody interacts for the chosen time, they are logged out automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={staffIdleTimeoutEnabled}
            onChange={(e) => setStaffIdleTimeoutEnabled(e.target.checked)}
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Auto log out idle staff
        </label>
        <div className="max-w-xs space-y-1">
          <Label htmlFor="staff-idle-minutes">Idle timeout (minutes)</Label>
          <Input
            id="staff-idle-minutes"
            type="number"
            min={5}
            max={240}
            step={1}
            value={staffIdleTimeoutMinutes}
            onChange={(e) => setStaffIdleTimeoutMinutes(Number(e.target.value) || 15)}
            disabled={!canEdit || !staffIdleTimeoutEnabled}
          />
          <p className="text-[11px] text-gray-400">Allowed range: 5–240 minutes. Default: 15.</p>
        </div>
      </section>
          )}

          {activeSection === 'delivery-slabs' && (
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
          )}

          {activeSection === 'store-status' && (
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
          )}

          {activeSection === 'payments' && (
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
          )}

          {activeSection === 'wa-templates' && (
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
          )}

          {activeSection === 'featured' && (
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-sm">Home discovery rails</h2>
        <p className="text-xs text-gray-400">
          Control Top Discounted, Most Loved, and per-category rails on the customer homepage.
          Most Loved uses products marked Best Seller in Admin → Products.
        </p>

        <div className="space-y-3 border-b border-gray-50 pb-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={homepageConfig.showTopDiscounted !== false}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, showTopDiscounted: e.target.checked }))
              }
              disabled={!canEdit}
              className="accent-blinkit-green"
            />
            Show Top Discounted Items
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-gray-500">Section title</Label>
              <Input
                value={homepageConfig.topDiscountedTitle ?? 'Top Discounted Items'}
                onChange={(e) =>
                  setHomepageConfig((prev) => ({ ...prev, topDiscountedTitle: e.target.value }))
                }
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Max items (1–48)</Label>
              <Input
                type="number"
                min={1}
                max={48}
                value={homepageConfig.topDiscountedLimit ?? 12}
                onChange={(e) =>
                  setHomepageConfig((prev) => ({
                    ...prev,
                    topDiscountedLimit: Number(e.target.value) || 12,
                  }))
                }
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-b border-gray-50 pb-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={homepageConfig.showMostLoved !== false}
              onChange={(e) =>
                setHomepageConfig((prev) => ({
                  ...prev,
                  showMostLoved: e.target.checked,
                  showBestSellers: e.target.checked,
                }))
              }
              disabled={!canEdit}
              className="accent-blinkit-green"
            />
            Show Most Loved
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-gray-500">Section title</Label>
              <Input
                value={homepageConfig.mostLovedTitle ?? 'Most Loved'}
                onChange={(e) =>
                  setHomepageConfig((prev) => ({ ...prev, mostLovedTitle: e.target.value }))
                }
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Max items (1–48)</Label>
              <Input
                type="number"
                min={1}
                max={48}
                value={homepageConfig.mostLovedLimit ?? 8}
                onChange={(e) =>
                  setHomepageConfig((prev) => ({
                    ...prev,
                    mostLovedLimit: Number(e.target.value) || 8,
                  }))
                }
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={homepageConfig.showCategoryRails !== false}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, showCategoryRails: e.target.checked }))
              }
              disabled={!canEdit}
              className="accent-blinkit-green"
            />
            Show a product rail for every category
          </label>
          <div>
            <Label className="text-xs text-gray-500">Items per category rail (1–48)</Label>
            <Input
              type="number"
              min={1}
              max={48}
              value={homepageConfig.categoryRailLimit ?? 8}
              onChange={(e) =>
                setHomepageConfig((prev) => ({
                  ...prev,
                  categoryRailLimit: Number(e.target.value) || 8,
                }))
              }
              disabled={!canEdit}
              className="mt-1 max-w-xs"
            />
          </div>
        </div>
      </section>
          )}

          {activeSection === 'health-star' && (
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-sm">Health Star Rating</h2>
          <p className="text-xs text-gray-400 mt-1">
            Control how 5★ (or other rated) products show the Health Star logo and yellow stars on the storefront.
          </p>
        </div>
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

        {homepageConfig.showHealthStarRating !== false && (
          <div className="space-y-4 border-t border-gray-50 pt-3">
            <div>
              <Label className="text-xs text-gray-500">Display style</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: 'stars', label: 'Stars only', hint: 'Yellow stars under the name' },
                    { value: 'badge', label: 'Logo on image', hint: 'Badge on product photo' },
                    { value: 'both', label: 'Logo + stars', hint: 'Badge and yellow stars' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`rounded-lg border p-3 cursor-pointer text-sm ${
                      healthStarDisplay.mode === opt.value
                        ? 'border-blinkit-green bg-green-50'
                        : 'border-gray-200'
                    } ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <input
                      type="radio"
                      name="hsr-mode"
                      className="sr-only"
                      checked={healthStarDisplay.mode === opt.value}
                      disabled={!canEdit}
                      onChange={() => updateHealthStarDisplay({ mode: opt.value })}
                    />
                    <span className="font-semibold block">{opt.label}</span>
                    <span className="text-[11px] text-gray-500">{opt.hint}</span>
                  </label>
                ))}
              </div>
            </div>

            {(healthStarDisplay.mode === 'badge' || healthStarDisplay.mode === 'both') && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-gray-500">Logo position on product image</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={healthStarDisplay.badgePosition}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateHealthStarDisplay({
                          badgePosition: e.target.value as HealthStarDisplay['badgePosition'],
                        })
                      }
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-right">Bottom right</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Show logo when rating is at least</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={healthStarDisplay.badgeMinRating}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateHealthStarDisplay({ badgeMinRating: Number(e.target.value) })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Default 5 — only 5★ products get the logo overlay.
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Active logo</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(healthStarDisplay.badges ?? []).map((badge) => (
                      <button
                        key={badge.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => updateHealthStarDisplay({ badgeUrl: badge.url })}
                        className={`relative rounded-xl border p-2 w-28 text-left ${
                          healthStarDisplay.badgeUrl === badge.url
                            ? 'border-blinkit-green ring-2 ring-blinkit-green/30'
                            : 'border-gray-200'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={badge.url} alt={badge.label} className="w-16 h-16 object-contain mx-auto" />
                        <p className="text-[10px] font-medium text-center mt-1 truncate">{badge.label}</p>
                        {canEdit && badge.id !== 'default-5' && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeHealthStarBadge(badge.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                removeHealthStarBadge(badge.id);
                              }
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-white border rounded-full p-0.5 text-red-500"
                            aria-label="Remove badge"
                          >
                            <Trash2 className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {canEdit && (
                  <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-3 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-700">Upload another health star logo</p>
                    <div>
                      <Label className="text-xs text-gray-500">Label</Label>
                      <Input
                        value={newBadgeLabel}
                        onChange={(e) => setNewBadgeLabel(e.target.value)}
                        placeholder="e.g. Green 5★"
                        className="mt-1"
                      />
                    </div>
                    <ProductImageUpload
                      value={newBadgeUrl}
                      onChange={setNewBadgeUrl}
                      label="Badge image"
                      uploadType="badge"
                      showWebSuggestions={false}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addHealthStarBadge} disabled={!newBadgeUrl}>
                      <Plus size={14} /> Add to library
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
          )}

          {activeSection === 'branding' && (
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
        <div>
          <h2 className="font-bold text-sm">Branding</h2>
          <p className="text-xs text-gray-400 mt-1">
            Header “Powered by” banner and the customer login logo seal.
          </p>
        </div>

        <div className="space-y-3 border-b border-gray-50 pb-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={homepageConfig.showPoweredByBanner !== false}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, showPoweredByBanner: e.target.checked }))
              }
              disabled={!canEdit}
              className="accent-blinkit-green"
            />
            Show Powered by banner next to GoBaskit
          </label>
          <div>
            <Label className="text-xs text-gray-500">Banner text</Label>
            <Input
              value={homepageConfig.poweredByText}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, poweredByText: e.target.value }))
              }
              placeholder="Powered by Action Plus Gym · Healthy Life · Wealthy Life"
              className="mt-1"
              disabled={!canEdit || homepageConfig.showPoweredByBanner === false}
              maxLength={160}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Animated shimmer text in the yellow header (looks like a live GIF ticker).
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={homepageConfig.showLoginLogo !== false}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, showLoginLogo: e.target.checked }))
              }
              disabled={!canEdit}
              className="accent-blinkit-green"
            />
            Show brand seal on customer login
          </label>
          {homepageConfig.showLoginLogo !== false && (
            <div className="space-y-3">
              <ProductImageUpload
                value={homepageConfig.loginLogoUrl}
                onChange={(url) =>
                  setHomepageConfig((prev) => ({
                    ...prev,
                    loginLogoUrl: url || '/branding/gobaskit-seal.png',
                  }))
                }
                label="Login logo"
                uploadType="badge"
                showWebSuggestions={false}
                disabled={!canEdit}
              />
              {homepageConfig.loginLogoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-full border border-[#f7c948]/70 overflow-hidden bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={homepageConfig.loginLogoUrl}
                      alt="Login logo preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Preview of the circular seal shown on My Account login.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
          )}

          {activeSection === 'promo' && (
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
          )}

          {activeSection === 'homepage' && (
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
          <div className="md:col-span-2">
            <Label>Delivery disclaimer (shown when customer taps delivery time)</Label>
            <textarea
              value={homepageConfig.deliveryDisclaimer}
              onChange={(e) =>
                setHomepageConfig((prev) => ({ ...prev, deliveryDisclaimer: e.target.value }))
              }
              disabled={!canEdit}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Delivery times are estimates…"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Clarifies that the ETA is not a guaranteed delivery commitment.
            </p>
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
          )}

          {activeSection === 'cancellation' && (
      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-sm">Cancellation Policy</h2>
        <p className="text-xs text-gray-400">
          Shown on the cart side panel and checkout page (mobile + web). Leave blank to use the default policy text.
        </p>
        <div>
          <Label>Policy text</Label>
          <textarea
            value={homepageConfig.cancellationPolicy}
            onChange={(e) =>
              setHomepageConfig((prev) => ({ ...prev, cancellationPolicy: e.target.value }))
            }
            disabled={!canEdit}
            rows={5}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Orders cannot be cancelled once packed for delivery..."
          />
        </div>
      </section>
          )}

          {showMainSave && (
      <div className="flex justify-end">
        {canEdit ? (
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        ) : (
          <span className="text-sm text-gray-500">Read-only access</span>
        )}
      </div>
          )}

          {activeSection === 'discounts' && (
      <div className="border-t border-gray-200 pt-2">
        <DiscountManager
          initialConfig={
            initialConfig.discountConfig ?? {
              couponsEnabled: false,
              membershipEnabled: false,
              membership: {
                enabled: true,
                discountPercent: 10,
                maxDiscount: null,
                usageLimitPerMember: 10,
                minimumOrder: 0,
                message: 'Action Plus Membership Discount Applied',
              },
            }
          }
          canEdit={canEdit}
        />
      </div>
          )}
        </div>
      </div>
    </div>
  );
}
