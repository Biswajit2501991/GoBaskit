'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import Header from '@/components/Header/Header';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { ChevronLeft } from 'lucide-react';
import {
  getWarmCustomerSession,
  peekWarmCustomerSession,
  warmCustomerSession,
  type WarmActiveOrder,
} from '@/utils/warmCustomerSession';

interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  createdAt: string;
  itemCount: number;
}

function toListItem(order: WarmActiveOrder): OrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
    itemCount: order.itemCount,
  };
}

export default function OrderTrackListClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cached = peekWarmCustomerSession();
    if (cached?.activeOrders?.length) {
      if (cached.activeOrders.length === 1) {
        router.replace(`/account/track/${cached.activeOrders[0].id}`);
        return;
      }
      setOrders(cached.activeOrders.map(toListItem));
      setLoading(false);
    }

    const warm = await warmCustomerSession({
      force: !getWarmCustomerSession()?.mobile,
    });
    if (!warm.mobile) {
      router.replace('/account');
      return;
    }

    const list = warm.activeOrders.map(toListItem);
    if (list.length === 1) {
      router.replace(`/account/track/${list[0].id}`);
      return;
    }
    setOrders(list);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ChevronLeft className="w-4 h-4" />
          My Account
        </Link>
        <h1 className="text-xl font-bold mb-1">Track an order</h1>
        <p className="text-sm text-gray-500 mb-6">Select an active order to view live status</p>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border p-6 text-center">
            <p className="text-gray-500 text-sm">No active orders to track.</p>
            <Button asChild className="mt-4">
              <Link href="/account">Back to account</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/track/${order.id}`}
                  className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-blinkit-green/40 hover:shadow-sm transition-all"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(order.createdAt)}</p>
                      <p className="text-xs text-gray-500">{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                      <p className="text-[11px] text-gray-400 mt-1 capitalize">{order.status.replace(/_/g, ' ').toLowerCase()}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
