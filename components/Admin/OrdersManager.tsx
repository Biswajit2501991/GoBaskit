'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { formatCustomerAddress, formatCustomerName } from '@/utils/customer';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Lock, MapPin, MessageCircle, Phone, Trash2, Unlock } from 'lucide-react';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';
import { buildWhatsAppUrl } from '@/utils/whatsapp';
import { PAYMENT_METHODS } from '@/constants';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import ListPagination from './ListPagination';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
}

interface CustomerDetails {
  firstName: string;
  lastName: string;
  mobile: string;
  alternateMobile?: string | null;
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  staff?: { name: string; mobile: string } | null;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  discountAmount?: number;
  discountType?: string;
  couponCode?: string | null;
  priority: string;
  paymentMethod: string;
  deliveryNotes?: string | null;
  orderSource?: string;
  assignedStaffId: string | null;
  assignedStaff: { id: string; name: string; mobile?: string } | null;
  lockedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  customer: CustomerDetails;
  items: OrderItem[];
  statusHistory?: StatusHistoryEntry[];
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
  mobile?: string;
}

const STATUSES = ['PENDING', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'];
const SSE_RELOAD_DEBOUNCE_MS = 800;
const BOARD_PAGE_SIZE = ADMIN_LIST_PAGE_SIZE;
const ORDER_DRAG_TYPE = 'application/gobaskit-order-id';

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('select, input, button, textarea, a, label'));
}

const STATUS_SECTION_STYLES: Record<string, { header: string; border: string }> = {
  PENDING: { header: 'bg-amber-50 text-amber-900 border-amber-200', border: 'border-amber-100' },
  ACCEPTED: { header: 'bg-blue-50 text-blue-900 border-blue-200', border: 'border-blue-100' },
  PACKED: { header: 'bg-purple-50 text-purple-900 border-purple-200', border: 'border-purple-100' },
  OUT_FOR_DELIVERY: { header: 'bg-orange-50 text-orange-900 border-orange-200', border: 'border-orange-100' },
  DELIVERED: { header: 'bg-green-50 text-green-900 border-green-200', border: 'border-green-100' },
  CANCELLED: { header: 'bg-gray-100 text-gray-700 border-gray-200', border: 'border-gray-200' },
};

function getWhatsAppMessage(order: OrderRow) {
  return [
    `Hi ${order.customer.firstName},`,
    `Your GoBaskit order ${order.orderNumber} is now ${order.status.replace(/_/g, ' ')}.`,
    `Total: ${formatCurrency(order.grandTotal)}.`,
    'Thank you for shopping with us.',
  ].join('\n');
}

function patchOrderFromEvent(order: OrderRow, payload: Record<string, unknown>): OrderRow {
  const assignedStaff = payload.assignedStaff as { id: string; name: string; mobile?: string } | null | undefined;
  const customer = payload.customer as CustomerDetails | undefined;
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
    ...(customer ? { customer: { ...order.customer, ...customer } } : {}),
  };
}

const ARCHIVE_CONFIRM_MESSAGE =
  'Customers will be notified that their order was cancelled due to unavailability or product quality. Orders move to Archive for 72 hours, then are permanently deleted. Customers see the notice for 24 hours.';

function OrderCard({
  order,
  expanded,
  isDragging,
  onToggle,
  onDragStart,
  onDragEnd,
  canEdit,
  canDelete,
  canAssign,
  canOverrideLock,
  selected,
  onToggleSelect,
  onArchiveOne,
  archivingOne,
  currentStaffId,
  forceAssignedToMe,
  staffList,
  onUpdate,
  onAssign,
  onRelease,
  onWhatsApp,
}: {
  order: OrderRow;
  expanded: boolean;
  isDragging: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canOverrideLock: boolean;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onArchiveOne: () => void;
  archivingOne: boolean;
  currentStaffId: string;
  forceAssignedToMe: boolean;
  staffList: StaffOption[];
  onUpdate: (id: string, patch: Record<string, unknown>, optimistic: Partial<OrderRow>) => void;
  onAssign: (id: string, staffId: string) => void;
  onRelease: (id: string) => void;
  onWhatsApp: (order: OrderRow) => void;
}) {
  const isLocked = Boolean(order.lockedAt && order.assignedStaffId);
  const isMine = order.assignedStaffId === currentStaffId;
  const lockedByOther = isLocked && !isMine && !canOverrideLock;
  const canDrag = canEdit && !lockedByOther;
  const address = formatCustomerAddress(order.customer);
  const paymentLabel =
    PAYMENT_METHODS[order.paymentMethod as keyof typeof PAYMENT_METHODS] ?? order.paymentMethod;

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag || isInteractiveDragTarget(e.target)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(ORDER_DRAG_TYPE, order.id);
        e.dataTransfer.setData('text/plain', order.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${
        isDragging ? 'opacity-40 border-dashed border-blinkit-green scale-[0.98]' : 'border-gray-100'
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full text-left p-3 hover:bg-gray-50/80 transition-colors"
      >
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1 min-w-0">
              {canDelete && (
                <input
                  type="checkbox"
                  checked={selected}
                  aria-label={`Select ${order.orderNumber}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(e.target.checked);
                  }}
                  className="mt-0.5 shrink-0 rounded border-gray-300"
                />
              )}
              {canDrag && (
                <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" aria-hidden />
              )}
              <p className="font-bold text-sm leading-tight">{order.orderNumber}</p>
            </div>
            <div className="flex items-start gap-1 shrink-0">
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${order.orderNumber}`}
                  disabled={archivingOne}
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchiveOne();
                  }}
                  className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <p className="font-bold text-sm text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
            </div>
          </div>
          {(order.discountAmount ?? 0) > 0 && (
            <p className="text-[10px] text-blinkit-green font-medium">
              Discount −{formatCurrency(order.discountAmount!)}
              {order.discountType === 'COUPON' && order.couponCode
                ? ` (${order.couponCode})`
                : order.discountType === 'MEMBERSHIP'
                  ? ' (Membership)'
                  : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {order.priority !== 'NORMAL' && (
              <span className="text-[10px] font-semibold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                {order.priority}
              </span>
            )}
            {order.orderSource === 'whatsapp' && (
              <span className="text-[10px] font-medium bg-green-100 text-green-800 px-1.5 py-0.5 rounded">WA</span>
            )}
            {isLocked && (
              <span className="text-[10px] flex items-center gap-0.5 text-gray-500">
                <Lock className="w-3 h-3" /> {order.assignedStaff?.name ?? 'Assigned'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-700 leading-snug">
            {formatCustomerName(order.customer.firstName, order.customer.lastName)}
          </p>
          <p className="text-[11px] text-gray-500 flex items-center gap-0.5">
            <Phone className="w-3 h-3 shrink-0" /> +91 {order.customer.mobile}
          </p>
          <p className="text-[11px] text-gray-500 flex items-start gap-1 line-clamp-2 leading-snug">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            {address}
          </p>
          <select
            value={order.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate(order.id, { status: e.target.value }, { status: e.target.value });
            }}
            className="w-full text-[11px] font-semibold border rounded px-2 py-1 mt-1"
            disabled={!canEdit || lockedByOther}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400">{formatDateTime(order.createdAt)}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50 space-y-3">
          <div className="grid sm:grid-cols-2 gap-4 pt-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
              <p className="font-medium">{formatCustomerName(order.customer.firstName, order.customer.lastName)}</p>
              <p>+91 {order.customer.mobile}</p>
              {order.customer.alternateMobile && <p>Alt: +91 {order.customer.alternateMobile}</p>}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery Address</p>
              <p>{order.customer.houseNumber}, {order.customer.street}</p>
              <p>{order.customer.area}{order.customer.landmark ? `, ${order.customer.landmark}` : ''}</p>
              <p>{order.customer.city}, {order.customer.state}</p>
              <p>PIN {order.customer.pincode}</p>
              {order.deliveryNotes && (
                <p className="text-xs text-gray-600 mt-1">Notes: {order.deliveryNotes}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Items</p>
            <div className="text-sm text-gray-600 space-y-1">
              {order.items.map((item) => (
                <p key={item.id}>{item.productName} × {item.quantity} = {formatCurrency(item.totalPrice)}</p>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Payment: {paymentLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-50">
            <select
              value={order.priority}
              onChange={(e) => onUpdate(order.id, { priority: e.target.value }, { priority: e.target.value })}
              className="text-xs border rounded px-2 py-1"
              disabled={!canEdit || lockedByOther}
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            {!forceAssignedToMe && (
              <select
                value={order.assignedStaffId ?? ''}
                onChange={(e) => e.target.value && onAssign(order.id, e.target.value)}
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
              <Button type="button" variant="outline" size="sm" onClick={() => onRelease(order.id)} className="gap-1 h-7 text-xs">
                <Unlock className="w-3 h-3" /> Release
              </Button>
            )}

            <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onWhatsApp(order)}>
              <MessageCircle className="w-3 h-3" /> Send WhatsApp
            </Button>

            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={archivingOne}
                onClick={onArchiveOne}
                className="gap-1 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" /> Delete order
              </Button>
            )}

            <Input
              placeholder="Admin notes..."
              defaultValue={order.adminNotes ?? ''}
              onBlur={(e) => {
                if (e.target.value !== (order.adminNotes ?? '')) {
                  onUpdate(order.id, { adminNotes: e.target.value }, { adminNotes: e.target.value });
                }
              }}
              className="max-w-xs h-7 text-xs"
              disabled={!canEdit || lockedByOther}
            />
          </div>

          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="pt-2 border-t border-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">Status timeline</p>
              <div className="space-y-2">
                {order.statusHistory.map((h) => (
                  <div key={h.id} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-gray-800">{h.status.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{formatDateTime(h.createdAt)}</span>
                    </div>
                    {h.staff ? (
                      <p className="text-gray-600 mt-0.5">
                        Staff: <span className="font-medium">{h.staff.name}</span>
                        {' · '}+91 {h.staff.mobile}
                      </p>
                    ) : (
                      <p className="text-gray-400 mt-0.5">System</p>
                    )}
                    {h.note && <p className="text-gray-500 mt-0.5">{h.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersManager({
  currentStaffId,
  canEdit,
  canDelete,
  canAssign,
  canOverrideLock,
  forceAssignedToMe = false,
}: {
  currentStaffId: string;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canOverrideLock: boolean;
  forceAssignedToMe?: boolean;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archivingAll, setArchivingAll] = useState(false);
  const [archivingSelected, setArchivingSelected] = useState(false);
  const [archivingOrderId, setArchivingOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

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

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(BOARD_PAGE_SIZE),
      includeHistory: '1',
    });
    if (search) params.set('search', search);
    if (forceAssignedToMe) params.set('assignedStaffId', currentStaffId);

    try {
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      initialLoadDone.current = true;
    }
  }, [page, search, forceAssignedToMe, currentStaffId]);

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

      if (data.type === 'order_created' || data.type === 'orders_archived') {
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

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, OrderRow[]> = {};
    for (const status of STATUSES) {
      grouped[status] = orders.filter((o) => o.status === status);
    }
    return grouped;
  }, [orders]);

  const selectedCount = selectedIds.size;
  const allOnPageSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const archivingBusy = archivingAll || archivingSelected || archivingOrderId !== null;

  function toggleOrderSelection(orderId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const order of orders) next.delete(order.id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const order of orders) next.add(order.id);
      return next;
    });
  }

  async function archiveOrdersRequest(orderIds: string[]) {
    const res = await fetch('/api/admin/orders/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === 'string' ? data.error : 'Failed to archive orders');
      return null;
    }
    alert(`Archived ${data.archivedCount ?? 0} order(s). SMS sent to ${data.smsRecipients ?? 0} customer(s) (if SMS is configured).`);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of orderIds) next.delete(id);
      return next;
    });
    await load();
    return data;
  }

  async function archiveSelectedOrders() {
    if (!canDelete || archivingBusy || selectedCount === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedCount} selected order${selectedCount === 1 ? '' : 's'}?\n\n${ARCHIVE_CONFIRM_MESSAGE}`,
    );
    if (!confirmed) return;

    setArchivingSelected(true);
    try {
      await archiveOrdersRequest([...selectedIds]);
    } finally {
      setArchivingSelected(false);
    }
  }

  async function archiveOneOrder(order: OrderRow) {
    if (!canDelete || archivingBusy) return;
    const confirmed = window.confirm(
      `Delete order ${order.orderNumber}?\n\n${ARCHIVE_CONFIRM_MESSAGE}`,
    );
    if (!confirmed) return;

    setArchivingOrderId(order.id);
    try {
      await archiveOrdersRequest([order.id]);
    } finally {
      setArchivingOrderId(null);
    }
  }

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
          ? {
              ...o,
              assignedStaffId: staffId,
              assignedStaff: staff ? { id: staff.id, name: staff.name, mobile: staff.mobile } : null,
              lockedAt: new Date().toISOString(),
            }
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

  function statusLabel(status: string) {
    return status.replace(/_/g, ' ');
  }

  function clearDragState() {
    setDraggingOrderId(null);
    setDragOverStatus(null);
  }

  function handleStatusDrop(targetStatus: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    clearDragState();
    if (!canEdit) return;

    const orderId = e.dataTransfer.getData(ORDER_DRAG_TYPE) || e.dataTransfer.getData('text/plain');
    if (!orderId) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === targetStatus) return;

    const isLocked = Boolean(order.lockedAt && order.assignedStaffId);
    const isMine = order.assignedStaffId === currentStaffId;
    const lockedByOther = isLocked && !isMine && !canOverrideLock;
    if (lockedByOther) {
      alert('This order is locked to another staff member.');
      return;
    }

    void updateOrder(orderId, { status: targetStatus }, { status: targetStatus });
  }

  async function archiveAllOrders() {
    if (!canDelete || archivingBusy) return;
    const confirmed = window.confirm(
      `Delete ALL active orders?\n\n${ARCHIVE_CONFIRM_MESSAGE}`,
    );
    if (!confirmed) return;

    setArchivingAll(true);
    try {
      const res = await fetch('/api/admin/orders/archive-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : 'Failed to archive orders');
        return;
      }
      alert(`Archived ${data.archivedCount ?? 0} order(s). SMS sent to ${data.smsRecipients ?? 0} customer(s) (if SMS is configured).`);
      setSelectedIds(new Set());
      setPage(1);
      await load();
    } finally {
      setArchivingAll(false);
    }
  }

  return (
    <div className="p-6 w-full max-w-[100vw]">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold">Orders ({total})</h1>
        {refreshing && <span className="text-xs text-gray-400 animate-pulse">Updating…</span>}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Kanban board by status — drag cards between columns or use the status dropdown. Status updates automatically when dropped.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search order #, customer, mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-sm"
          />
          {canDelete && orders.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAllOnPage}
                className="rounded border-gray-300"
              />
              Select all on page
            </label>
          )}
        </div>
        {canDelete && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 && (
              <Button
                type="button"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={archivingBusy}
                onClick={archiveSelectedOrders}
              >
                {archivingSelected ? 'Archiving...' : `Delete selected (${selectedCount})`}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={archivingBusy || total === 0}
              onClick={archiveAllOrders}
            >
              {archivingAll ? 'Archiving...' : 'Delete all orders'}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">No orders found</p>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3 items-start min-h-[calc(100vh-13rem)]">
            {STATUSES.map((status) => {
              const sectionOrders = ordersByStatus[status] ?? [];
              const styles = STATUS_SECTION_STYLES[status];

              return (
                <section
                  key={status}
                  className={`flex flex-col w-[min(300px,78vw)] shrink-0 rounded-xl border overflow-hidden max-h-[calc(100vh-13rem)] transition-shadow ${
                    styles.border
                  } ${dragOverStatus === status ? 'ring-2 ring-blinkit-green shadow-md' : ''}`}
                >
                  <div className={`px-3 py-2.5 border-b shrink-0 ${styles.header}`}>
                    <p className="font-semibold text-xs leading-tight">{statusLabel(status)}</p>
                    <p className="text-[11px] opacity-80 mt-0.5">{sectionOrders.length} order{sectionOrders.length === 1 ? '' : 's'}</p>
                  </div>

                  <div
                    className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] transition-colors ${
                      dragOverStatus === status ? 'bg-blinkit-green-light/50' : 'bg-gray-50/60'
                    }`}
                    onDragOver={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverStatus(status);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDragOverStatus((prev) => (prev === status ? null : prev));
                    }}
                    onDrop={(e) => handleStatusDrop(status, e)}
                  >
                    {sectionOrders.length === 0 ? (
                      <p className={`text-[11px] text-center py-6 px-2 border border-dashed rounded-lg ${
                        dragOverStatus === status
                          ? 'text-blinkit-green border-blinkit-green/40 bg-white/60'
                          : 'text-gray-400 border-transparent'
                      }`}
                      >
                        {dragOverStatus === status ? 'Drop here' : 'No orders'}
                      </p>
                    ) : (
                      sectionOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          expanded={expandedOrderId === order.id}
                          isDragging={draggingOrderId === order.id}
                          onToggle={() => setExpandedOrderId((id) => (id === order.id ? null : order.id))}
                          onDragStart={() => setDraggingOrderId(order.id)}
                          onDragEnd={clearDragState}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canAssign={canAssign}
                          canOverrideLock={canOverrideLock}
                          selected={selectedIds.has(order.id)}
                          onToggleSelect={(checked) => toggleOrderSelection(order.id, checked)}
                          onArchiveOne={() => archiveOneOrder(order)}
                          archivingOne={archivingOrderId === order.id}
                          currentStaffId={currentStaffId}
                          forceAssignedToMe={forceAssignedToMe}
                          staffList={staffList}
                          onUpdate={updateOrder}
                          onAssign={assignOrder}
                          onRelease={releaseOrder}
                          onWhatsApp={sendWhatsAppUpdate}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <ListPagination page={page} total={total} onPageChange={setPage} className="mt-6" />
    </div>
  );
}
