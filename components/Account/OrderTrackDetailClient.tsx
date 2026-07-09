'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import Header from '@/components/Header/Header';
import OrderProgressTracker from '@/components/Account/OrderProgressTracker';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  cancelNotice?: string | null;
  customerVisibleUntil?: string | null;
  items: Array<{ productName: string; quantity: number; unit: string; totalPrice: number }>;
}

export default function OrderTrackDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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
        ) : error || !order ? (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <p className="text-gray-500">{error || 'Unable to load order'}</p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/account">Back to account</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs text-gray-500">Order</p>
              <h1 className="text-xl font-bold text-gray-900">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-1">{formatDateTime(order.createdAt)} · {formatCurrency(order.grandTotal)}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <OrderProgressTracker status={order.status} cancelMessage={order.cancelNotice} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-sm text-gray-900 mb-3">Items</h2>
              <ul className="space-y-2">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.productName} × {item.quantity} {item.unit}
                    </span>
                    <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                  </li>
                ))}
              </ul>
              {(order.subtotal != null || order.deliveryCharge != null) && (
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

            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <p className="text-center text-[11px] text-gray-400">Status updates automatically every 60 seconds</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
