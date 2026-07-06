'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { formatCustomerName } from '@/utils/customer';
import { Input } from '@/components/ui/input';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import { CUSTOMER_ORDER_VISIBLE_HOURS, ORDER_ARCHIVE_RETENTION_HOURS } from '@/constants/orderArchive';
import ListPagination from './ListPagination';

interface ArchivedOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  archivedAt: string | null;
  customerVisibleUntil: string | null;
  purgeAt: string | null;
  cancelNotice: string | null;
  smsSentAt: string | null;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    mobile: string;
    city: string;
    pincode: string;
  };
  items: Array<{ productName: string; quantity: number; totalPrice: number }>;
}

export default function ArchiveManager() {
  const [items, setItems] = useState<ArchivedOrderRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_LIST_PAGE_SIZE),
    });
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/admin/orders/archive?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6 w-full">
      <h1 className="text-2xl font-bold mb-1">Archive</h1>
      <p className="text-sm text-gray-500 mb-6">
        Orders removed from the active list stay here for {ORDER_ARCHIVE_RETENTION_HOURS} hours, then are permanently deleted.
        Customers see cancellation notices for {CUSTOMER_ORDER_VISIBLE_HOURS} hours.
      </p>

      <Input
        placeholder="Search archived orders..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-sm mb-4"
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No archived orders. Use &quot;Delete all orders&quot; on the Orders page to move orders here.</p>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <div key={order.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold">{order.orderNumber}</p>
                  <p className="text-sm text-gray-600">
                    {formatCustomerName(order.customer.firstName, order.customer.lastName)} · +91 {order.customer.mobile}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                  <p className="text-gray-400">{order.status}</p>
                </div>
              </div>
              {order.cancelNotice && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
                  {order.cancelNotice}
                </p>
              )}
              <div className="text-xs text-gray-500 grid sm:grid-cols-2 gap-1">
                <p>Archived: {order.archivedAt ? formatDateTime(order.archivedAt) : '—'}</p>
                <p>Customer visible until: {order.customerVisibleUntil ? formatDateTime(order.customerVisibleUntil) : '—'}</p>
                <p>Auto-delete at: {order.purgeAt ? formatDateTime(order.purgeAt) : '—'}</p>
                <p>SMS sent: {order.smsSentAt ? formatDateTime(order.smsSentAt) : 'Not sent / not configured'}</p>
              </div>
              <p className="text-xs text-gray-400 mt-2">{order.items.length} item{order.items.length === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      )}

      <ListPagination page={page} pageSize={ADMIN_LIST_PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
