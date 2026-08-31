'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import Header from '@/components/Header/Header';
import OrderProgressTracker from '@/components/Account/OrderProgressTracker';
import OrderContentsEditor, { type EditableLine } from '@/components/Orders/OrderContentsEditor';
import { formatOrderLineLabel } from '@/utils/orderItemName';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const POLL_MS = 60_000;

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  subtotal?: number;
  deliveryCharge?: number;
  discountAmount?: number;
  discountType?: 'NONE' | 'COUPON' | 'MEMBERSHIP';
  couponCode?: string | null;
  createdAt: string;
  deliveryNotes?: string | null;
  cancelNotice?: string | null;
  customerVisibleUntil?: string | null;
  editableUntil?: string | null;
  canEdit?: boolean;
  canCancel?: boolean;
  items: Array<{
    id?: string;
    productId?: string;
    variantId?: string | null;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    totalPrice: number;
  }>;
  customer?: {
    firstName: string;
    lastName: string;
    houseNumber: string;
    street: string;
    area: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
}

function remainingLabel(untilIso: string | null | undefined, now: number): string | null {
  if (!untilIso) return null;
  const left = new Date(untilIso).getTime() - now;
  if (left <= 0) return null;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function OrderTrackDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [address, setAddress] = useState({
    firstName: '',
    lastName: '',
    houseNumber: '',
    street: '',
    area: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    deliveryNotes: '',
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.replace('/account');
        return;
      }
      if (!res.ok) {
        setError('Order not found');
        setOrder(null);
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setError('');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!order || order.status === 'DELIVERED' || order.status === 'CANCELLED') return;
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [order, load]);

  useEffect(() => {
    if (!order?.canEdit) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order?.canEdit]);

  const canMutate = Boolean(order?.canEdit) && Boolean(remainingLabel(order?.editableUntil, now));
  const countdown = remainingLabel(order?.editableUntil, now);

  useEffect(() => {
    if (!canMutate) setEditing(false);
  }, [canMutate]);

  const lockedReason = useMemo(() => {
    if (!order) return '';
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') return '';
    if (order.canEdit && countdown) return '';
    if (order.status === 'PACKED' || order.status === 'OUT_FOR_DELIVERY') {
      return 'This order is being prepared for delivery and can no longer be changed.';
    }
    return 'The 10-minute edit window has ended. This order is locked.';
  }, [order, countdown]);

  function startEdit() {
    if (!order) return;
    setLines(
      order.items.map((item) => ({
        productId: item.productId || '',
        variantId: item.variantId ?? null,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice ?? item.totalPrice / Math.max(1, item.quantity),
      })).filter((l) => l.productId),
    );
    const c = order.customer;
    setAddress({
      firstName: c?.firstName ?? '',
      lastName: c?.lastName ?? '',
      houseNumber: c?.houseNumber ?? '',
      street: c?.street ?? '',
      area: c?.area ?? '',
      landmark: c?.landmark ?? '',
      city: c?.city ?? '',
      state: c?.state ?? '',
      pincode: c?.pincode ?? '',
      deliveryNotes: order.deliveryNotes ?? '',
    });
    setEditing(true);
    setError('');
  }

  async function saveEdit() {
    if (!lines.length) {
      setError('Keep at least one item on the order');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          delivery: address,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update order');
        return;
      }
      setOrder(data.order);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder() {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not cancel order');
        return;
      }
      setOrder(data.order);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ChevronLeft className="w-4 h-4" />
            My Account
          </Link>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading order...</p>
        ) : error && !order ? (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <p className="text-gray-500">{error || 'Unable to load order'}</p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/account">Back to account</Link>
            </Button>
          </div>
        ) : !order ? null : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs text-gray-500">Order</p>
              <h1 className="text-xl font-bold text-gray-900">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">{formatDateTime(order.createdAt)} · {formatCurrency(order.grandTotal)}</p>
              {canMutate && countdown && (
                <p className="text-xs text-blinkit-green font-semibold mt-2">
                  You can edit or cancel for {countdown}
                </p>
              )}
              {lockedReason ? <p className="text-xs text-gray-500 mt-2">{lockedReason}</p> : null}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <OrderProgressTracker status={order.status} cancelMessage={order.cancelNotice} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-sm text-gray-900 mb-3">{editing ? 'Edit items' : 'Items'}</h2>
              {editing ? (
                <OrderContentsEditor lines={lines} onChange={setLines} disabled={saving} />
              ) : (
                <ul className="space-y-2">
                  {order.items.map((item, i) => (
                    <li key={item.id ?? i} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {formatOrderLineLabel(item)}
                      </span>
                      <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(order.subtotal != null || order.deliveryCharge != null) && !editing && (
                <div className="mt-4 pt-3 border-t border-dashed space-y-1.5 text-sm">
                  {order.subtotal != null && (
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                  )}
                  {(order.discountAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-blinkit-green">
                      <span>
                        Discount
                        {order.discountType === 'COUPON' && order.couponCode
                          ? ` (${order.couponCode})`
                          : order.discountType === 'MEMBERSHIP'
                            ? ' (Membership)'
                            : ''}
                      </span>
                      <span>−{formatCurrency(order.discountAmount!)}</span>
                    </div>
                  )}
                  {order.deliveryCharge != null && (
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery</span>
                      <span>{formatCurrency(order.deliveryCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Grand Total</span>
                    <span className="text-blinkit-green">{formatCurrency(order.grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {editing && order.customer && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h2 className="font-semibold text-sm text-gray-900">Delivery address</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>First name</Label>
                    <Input value={address.firstName} onChange={(e) => setAddress((a) => ({ ...a, firstName: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input value={address.lastName} onChange={(e) => setAddress((a) => ({ ...a, lastName: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>House / flat</Label>
                  <Input value={address.houseNumber} onChange={(e) => setAddress((a) => ({ ...a, houseNumber: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Street</Label>
                  <Input value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Area</Label>
                  <Input value={address.area} onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>City</Label>
                    <Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>PIN</Label>
                    <Input value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} className="mt-1" maxLength={6} />
                  </div>
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={address.deliveryNotes} onChange={(e) => setAddress((a) => ({ ...a, deliveryNotes: e.target.value }))} className="mt-1" />
                </div>
              </div>
            )}

            {error && order ? <p className="text-sm text-red-600 text-center">{error}</p> : null}

            {canMutate && !editing && (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={startEdit} disabled={saving}>
                  Edit order
                </Button>
                <Button variant="outline" className="flex-1 text-red-600" onClick={() => void cancelOrder()} disabled={saving}>
                  Cancel order
                </Button>
              </div>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void saveEdit()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>
                  Back
                </Button>
              </div>
            )}

            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <p className="text-center text-[11px] text-gray-400">Status updates automatically every 60 seconds</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
