'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { DiscountConfig } from '@/services/SettingsService';

interface CouponRow {
  id: string;
  couponCode: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscount: number | null;
  minimumOrder: number;
  startDate: string | null;
  expiryDate: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  usageLimitPerMobile: number;
  totalUsageLimit: number | null;
  description: string;
  _count?: { usages: number };
}

type CouponForm = {
  couponCode: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  maxDiscount: string;
  minimumOrder: string;
  startDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  usageLimitPerMobile: string;
  totalUsageLimit: string;
  description: string;
};

const emptyForm = (): CouponForm => ({
  couponCode: '',
  discountType: 'PERCENTAGE',
  discountValue: '10',
  maxDiscount: '',
  minimumOrder: '0',
  startDate: '',
  expiryDate: '',
  status: 'ACTIVE',
  usageLimitPerMobile: '3',
  totalUsageLimit: '',
  description: '',
});

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export default function DiscountManager({
  initialConfig,
  canEdit,
}: {
  initialConfig: DiscountConfig;
  canEdit: boolean;
}) {
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>(initialConfig);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (!res.ok) throw new Error('Failed to load coupons');
      const data = await res.json();
      setCoupons(data.coupons ?? []);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load coupons' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCoupons();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCoupons]);

  async function saveDiscountConfig() {
    if (!canEdit) return;
    setSavingConfig(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountConfig }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save');
      }
      const updated = await res.json();
      if (updated.discountConfig) setDiscountConfig(updated.discountConfig);
      setMessage({ type: 'ok', text: 'Discount settings saved.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSavingConfig(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function startEdit(c: CouponRow) {
    setEditingId(c.id);
    setForm({
      couponCode: c.couponCode,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      minimumOrder: String(c.minimumOrder),
      startDate: toDateInput(c.startDate),
      expiryDate: toDateInput(c.expiryDate),
      status: c.status,
      usageLimitPerMobile: String(c.usageLimitPerMobile),
      totalUsageLimit: c.totalUsageLimit != null ? String(c.totalUsageLimit) : '',
      description: c.description ?? '',
    });
    setShowForm(true);
  }

  async function saveCoupon() {
    if (!canEdit) return;
    setSavingCoupon(true);
    setMessage(null);
    const payload = {
      couponCode: form.couponCode,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: form.maxDiscount.trim() ? Number(form.maxDiscount) : null,
      minimumOrder: Number(form.minimumOrder) || 0,
      startDate: fromDateInput(form.startDate),
      expiryDate: fromDateInput(form.expiryDate),
      status: form.status,
      usageLimitPerMobile: Math.max(1, Math.trunc(Number(form.usageLimitPerMobile) || 3)),
      totalUsageLimit: form.totalUsageLimit.trim() ? Math.trunc(Number(form.totalUsageLimit)) : null,
      description: form.description,
    };

    try {
      const res = await fetch(editingId ? `/api/admin/coupons/${editingId}` : '/api/admin/coupons', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save coupon');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      setMessage({ type: 'ok', text: editingId ? 'Coupon updated.' : 'Coupon created.' });
      await loadCoupons();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save coupon' });
    } finally {
      setSavingCoupon(false);
    }
  }

  async function deleteCoupon(id: string, code: string) {
    if (!canEdit) return;
    if (!window.confirm(`Delete coupon ${code}?`)) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete');
      }
      setMessage({ type: 'ok', text: 'Coupon deleted.' });
      await loadCoupons();
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  }

  const mem = discountConfig.membership;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Discount Management</h2>
        <p className="text-xs text-gray-500 mt-1">
          Coupons and Action Plus membership discounts. Only one discount applies per order.
        </p>
      </div>

      {message && (
        <p className={`text-sm font-medium ${message.type === 'ok' ? 'text-blinkit-green' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h3 className="font-bold text-sm">Feature Toggles</h3>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={discountConfig.couponsEnabled}
            onChange={(e) =>
              setDiscountConfig((prev) => ({ ...prev, couponsEnabled: e.target.checked }))
            }
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Enable Coupon System
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={discountConfig.membershipEnabled}
            onChange={(e) =>
              setDiscountConfig((prev) => ({ ...prev, membershipEnabled: e.target.checked }))
            }
            disabled={!canEdit}
            className="accent-blinkit-green"
          />
          Enable Membership Discount
        </label>
        {canEdit && (
          <Button type="button" onClick={saveDiscountConfig} disabled={savingConfig} size="sm">
            {savingConfig ? 'Saving…' : 'Save Toggles & Membership Config'}
          </Button>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h3 className="font-bold text-sm">Membership Discount Config</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Discount %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={mem.discountPercent}
              onChange={(e) =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  membership: { ...prev.membership, discountPercent: Number(e.target.value) || 0 },
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Max Discount (₹, blank = none)</Label>
            <Input
              type="number"
              min={0}
              value={mem.maxDiscount ?? ''}
              onChange={(e) =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  membership: {
                    ...prev.membership,
                    maxDiscount: e.target.value.trim() === '' ? null : Number(e.target.value) || 0,
                  },
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Usage Limit Per Member</Label>
            <Input
              type="number"
              min={1}
              value={mem.usageLimitPerMember}
              onChange={(e) =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  membership: {
                    ...prev.membership,
                    usageLimitPerMember: Math.max(1, Math.trunc(Number(e.target.value) || 10)),
                  },
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>Minimum Order (₹)</Label>
            <Input
              type="number"
              min={0}
              value={mem.minimumOrder}
              onChange={(e) =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  membership: { ...prev.membership, minimumOrder: Number(e.target.value) || 0 },
                }))
              }
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Success Message</Label>
            <Input
              value={mem.message}
              onChange={(e) =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  membership: { ...prev.membership, message: e.target.value },
                }))
              }
              disabled={!canEdit}
            />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Coupons</h3>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={startCreate}>
              <Plus size={14} /> Add Coupon
            </Button>
          )}
        </div>

        {showForm && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500">
              {editingId ? 'Edit Coupon' : 'New Coupon'}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Input
                  value={form.couponCode}
                  onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountType: e.target.value as 'PERCENTAGE' | 'FIXED',
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  disabled={!canEdit}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Max Discount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.maxDiscount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                  disabled={!canEdit}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Min Order (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minimumOrder}
                  onChange={(e) => setForm((f) => ({ ...f, minimumOrder: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  disabled={!canEdit}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Limit Per Mobile</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimitPerMobile}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimitPerMobile: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>Total Usage Limit</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.totalUsageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, totalUsageLimit: e.target.value }))}
                  disabled={!canEdit}
                  placeholder="Optional"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={saveCoupon} disabled={!canEdit || savingCoupon} size="sm">
                {savingCoupon ? 'Saving…' : editingId ? 'Update Coupon' : 'Create Coupon'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading coupons…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-gray-400">No coupons yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Value</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Used</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-2 pr-2 font-semibold">{c.couponCode}</td>
                    <td className="py-2 pr-2">{c.discountType === 'PERCENTAGE' ? '%' : '₹'}</td>
                    <td className="py-2 pr-2">
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          c.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{c._count?.usages ?? 0}</td>
                    <td className="py-2">
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="p-1 text-gray-500 hover:text-blinkit-green"
                            aria-label={`Edit ${c.couponCode}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCoupon(c.id, c.couponCode)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            aria-label={`Delete ${c.couponCode}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
