'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCustomerName } from '@/utils/customer';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, MessageCircle, Unlock } from 'lucide-react';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';
import { buildWhatsAppUrl } from '@/utils/whatsapp';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  staff?: { name: string } | null;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  priority: string;
  assignedStaffId: string | null;
  assignedStaff: { id: string; name: string } | null;
  lockedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  customer: { firstName: string; lastName: string; mobile: string };
  items: OrderItem[];
  statusHistory?: StatusHistoryEntry[];
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

const STATUSES = ['PENDING', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'];
const SSE_RELOAD_DEBOUNCE_MS = 800;

function getWhatsAppMessage(order: OrderRow) {
  return [
    `Hi ${order.customer.firstName},`,
    `Your GoBaskit order ${order.orderNumber} is now ${order.status.replace(/_/g, ' ')}.`,
    `Total: ${formatCurrency(order.grandTotal)}.`,
    'Thank you for shopping with us.',
  ].join('\n');
}

function patchOrderFromEvent(order: OrderRow, payload: Record<string, unknown>): OrderRow {
  const assignedStaff = payload.assignedStaff as { id: string; name: string } | null | undefined;
  const customer = payload.customer as { firstName: string; lastName: string; mobile: string } | undefined;
  return {
    ...order,
    ...(payload.status ? { status: String(payload.status) } : {}),
    ...(payload.priority ? { priority: String(payload.priority) } : {}),
    ...(payload.grandTotal != null ? { grandTotal: Number(payload.grandTotal) } : {}),
    ...(payload.assignedStaffId !== undefined
      ? { assignedStaffId: payload.assignedStaffId ? String(payload.assignedStaffId) : null }
      : {}),
    ...(assignedStaff !== undefined ? { assignedStaff: assignedStaff ?? null } : {}),
    ...(payload.lockedAt !== undefined
      ? { lockedAt: payload.lockedAt ? String(payload.lockedAt) : null }
      : {}),
    ...(payload.adminNotes !== undefined
      ? { adminNotes: payload.adminNotes ? String(payload.adminNotes) : null }
      : {}),
    ...(customer ? { customer } : {}),
  };
}

export default function OrdersManager({
  currentStaffId,
  canEdit,
  canAssign,
  canOverrideLock,
  forceAssignedToMe = false,
}: {
  currentStaffId: string;
  canEdit: boolean;
  canAssign: boolean;
  canOverrideLock: boolean;
  forceAssignedToMe?: boolean;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const initialLoadDone = useRef(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => {});

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? initialLoadDone.current;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (forceAssignedToMe) params.set('assignedStaffId', currentStaffId);

    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.items);
        setTotal(data.total);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      initialLoadDone.current = true;
    }
  }, [page, search, statusFilter, forceAssignedToMe, currentStaffId]);

  loadRef.current = load;

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch('/api/admin/staff?pageSize=100')
      .then((r) => r.json())
      .then((d) => setStaffList(d.items?.filter((s: StaffOption & { active: boolean }) => s.active) ?? []));
  }, []);

  useEffect(() => {
    function scheduleSilentReload() {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        void loadRef.current({ silent: true });
      }, SSE_RELOAD_DEBOUNCE_MS);
    }

    const unsubscribe = subscribeToAdminEvents((data) => {
      if (data.type === 'order_updated') {
        const payload = data.payload;
        const id = String(payload.id ?? '');
        if (id) {
          setOrders((prev) => {
            const index = prev.findIndex((o) => o.id === id);
            if (index === -1) {
              scheduleSilentReload();
              return prev;
            }
            return prev.map((o) => (o.id === id ? patchOrderFromEvent(o, payload) : o));
          });
        }
        return;
      }

      if (data.type === 'order_created') {
        scheduleSilentReload();
      }
    });

    return () => {
      unsubscribe();
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, []);

  async function updateOrder(id: string, patch: Record<string, unknown>, optimistic: Partial<OrderRow>) {
    if (!canEdit) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...optimistic } : o)));
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      void load({ silent: true });
      const data = await res.json();
      alert(data.error || 'Update failed');
      return;
    }
    const updated = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
  }

  async function assignOrder(id: string, staffId: string) {
    if (!canAssign) return;
    const staff = staffList.find((s) => s.id === staffId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, assignedStaffId: staffId, assignedStaff: staff ? { id: staff.id, name: staff.name } : null, lockedAt: new Date().toISOString() }
          : o,
      ),
    );
    const res = await fetch(`/api/admin/orders/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId }),
    });
    if (!res.ok) {
      void load({ silent: true });
      const data = await res.json();
      alert(data.error || 'Assign failed');
      return;
    }
    const updated = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
  }

  function sendWhatsAppUpdate(order: OrderRow) {
    const message = getWhatsAppMessage(order);
    const url = buildWhatsAppUrl(`91${order.customer.mobile}`, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function releaseOrder(id: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, assignedStaffId: null, assignedStaff: null, lockedAt: null } : o)),
    );
    const res = await fetch(`/api/admin/orders/${id}/release`, { method: 'POST' });
    if (!res.ok) {
      void load({ silent: true });
      const data = await res.json();
      alert(data.error || 'Release failed');
      return;
    }
    const updated = await res.json();
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
  }

  const pageCount = Math.ceil(total / 20);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Orders ({total})</h1>
        {refreshing && (
          <span className="text-xs text-gray-400 animate-pulse">Updating…</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search order #, customer, mobile..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">No orders found</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isLocked = Boolean(order.lockedAt && order.assignedStaffId);
            const isMine = order.assignedStaffId === currentStaffId;
            const lockedByOther = isLocked && !isMine && !canOverrideLock;
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{order.orderNumber}</p>
                      {order.priority !== 'NORMAL' && (
                        <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                          {order.priority}
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-xs flex items-center gap-1 text-gray-500">
                          <Lock className="w-3 h-3" /> {order.assignedStaff?.name ?? 'Assigned'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatCustomerName(order.customer.firstName, order.customer.lastName)} · +91 {order.customer.mobile}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrder(order.id, { status: e.target.value }, { status: e.target.value })}
                      className="text-xs font-semibold border rounded px-2 py-1 mt-1"
                      disabled={!canEdit || lockedByOther}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-1 mb-3">
                  {order.items.map((item) => (
                    <p key={item.id}>{item.productName} × {item.quantity} = {formatCurrency(item.totalPrice)}</p>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-50">
                  <select
                    value={order.priority}
                    onChange={(e) => updateOrder(order.id, { priority: e.target.value }, { priority: e.target.value })}
                    className="text-xs border rounded px-2 py-1"
                    disabled={!canEdit || lockedByOther}
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>

                  {!forceAssignedToMe && (
                    <select
                      value={order.assignedStaffId ?? ''}
                      onChange={(e) => e.target.value && assignOrder(order.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                      disabled={!canAssign || lockedByOther}
                    >
                      <option value="">Assign to...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role.replace(/_/g, ' ')})</option>
                      ))}
                    </select>
                  )}

                  {order.assignedStaffId && canEdit && (isMine || !isLocked || canOverrideLock) && (
                    <Button type="button" variant="outline" size="sm" onClick={() => releaseOrder(order.id)} className="gap-1 h-7 text-xs">
                      <Unlock className="w-3 h-3" /> Release
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => sendWhatsAppUpdate(order)}
                  >
                    <MessageCircle className="w-3 h-3" /> Send WhatsApp
                  </Button>

                  <Input
                    placeholder="Admin notes..."
                    defaultValue={order.adminNotes ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (order.adminNotes ?? '')) {
                        updateOrder(order.id, { adminNotes: e.target.value }, { adminNotes: e.target.value });
                      }
                    }}
                    className="max-w-xs h-7 text-xs"
                    disabled={!canEdit || lockedByOther}
                  />
                </div>

                {order.statusHistory && order.statusHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Status timeline</p>
                    <div className="flex flex-wrap gap-2">
                      {order.statusHistory.map((h) => (
                        <span key={h.id} className="text-[10px] bg-gray-50 px-2 py-0.5 rounded">
                          {h.status.replace(/_/g, ' ')} · {formatDateTime(h.createdAt)}
                          {h.staff?.name && ` · ${h.staff.name}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-gray-500 self-center">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
