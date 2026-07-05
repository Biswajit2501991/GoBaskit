'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { DeliverySlab } from '@/constants';

interface StoreConfig {
  serviceablePins: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
}

export default function SettingsManager({ initialConfig }: { initialConfig: StoreConfig }) {
  const [minOrderValue, setMinOrderValue] = useState<number>(initialConfig.minOrderValue);
  const [pins, setPins] = useState<string[]>(initialConfig.serviceablePins);
  const [newPin, setNewPin] = useState('');
  const [slabs, setSlabs] = useState<DeliverySlab[]>(initialConfig.deliverySlabs);
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
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceablePins: pins,
          deliverySlabs: slabs.map((s) => ({ min: Number(s.min), max: Number(s.max), charge: Number(s.charge) })),
          minOrderValue: Number(minOrderValue),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save settings');
      }
      const updated: StoreConfig = await res.json();
      setPins(updated.serviceablePins);
      setSlabs(updated.deliverySlabs);
      setMinOrderValue(updated.minOrderValue);
      setMessage({ type: 'ok', text: 'Settings saved.' });
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
              <button type="button" onClick={() => removePin(pin)} aria-label={`Remove ${pin}`} className="hover:text-red-500">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPin();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={addPin}>
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
              <Input type="number" min={0} value={slab.min} onChange={(e) => updateSlab(i, 'min', Number(e.target.value))} />
              <Input type="number" min={0} value={slab.max} onChange={(e) => updateSlab(i, 'max', Number(e.target.value))} />
              <Input type="number" min={0} value={slab.charge} onChange={(e) => updateSlab(i, 'charge', Number(e.target.value))} />
              <button type="button" onClick={() => removeSlab(i)} aria-label="Remove slab" className="text-gray-400 hover:text-red-500 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={addSlab}>
          <Plus size={16} /> Add slab
        </Button>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
