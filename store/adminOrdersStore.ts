'use client';

import { create } from 'zustand';
import { subscribeToAdminEvents, type AdminRealtimeEvent } from '@/lib/realtime/adminEventsClient';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import {
  ensureAdminQuery,
  peekAdminQuery,
  useAdminSessionStore,
} from '@/store/adminSessionCache';
import type { ShopPickupRow } from '@/components/Admin/ShopPickupCosts';
import type { OpsFilter, OpsSummary } from '@/components/Admin/OrdersLiveOpsStrip';

export type AdminOrderItem = {
  id: string;
  productId?: string;
  variantId?: string | null;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice: number;
};

export type AdminOrderCustomer = {
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
  isWhatsappVerified?: boolean;
};

export type AdminOrderRow = {
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
  customer: AdminOrderCustomer;
  items: AdminOrderItem[];
  statusHistory?: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string;
    staff?: { name: string; mobile: string } | null;
  }>;
  assignmentFrozenAt?: string | null;
  shopSourcing?: {
    procurementTotal: number;
    fulfillments: ShopPickupRow[];
  };
};

export type AdminAssignee = {
  id: string;
  name: string;
  role: string;
  mobile?: string;
};

export type AdminOrdersBoardParams = {
  page: number;
  pageSize?: number;
  search?: string;
  scope: 'all' | 'mine';
  staffId: string;
  opsFilter: OpsFilter;
};

export type AdminOrdersBoard = {
  items: AdminOrderRow[];
  total: number;
};

const BOARD_PREFIX = 'orders:board:';
export const ORDERS_OPS_KEY = 'orders:ops';
export const ORDERS_ASSIGNEES_KEY = 'orders:assignees';

type AdminOrdersMeta = {
  boardEpoch: number;
  opsEpoch: number;
  needsBoardRefresh: boolean;
  needsOpsRefresh: boolean;
  refreshingBoard: boolean;
  refreshingOps: boolean;
  ensureRealtime: () => void;
  fetchBoard: (params: AdminOrdersBoardParams, opts?: { force?: boolean }) => Promise<void>;
  fetchOps: (opts?: { force?: boolean }) => Promise<void>;
  fetchAssignees: (opts?: { force?: boolean }) => Promise<void>;
  writeBoard: (params: AdminOrdersBoardParams, board: AdminOrdersBoard) => void;
  patchOrder: (id: string, patch: Partial<AdminOrderRow>) => void;
  applyRealtimeEvent: (event: AdminRealtimeEvent) => void;
  invalidateOrders: () => void;
};

export function adminOrdersBoardKey(params: AdminOrdersBoardParams): string {
  return `${BOARD_PREFIX}${JSON.stringify({
    page: params.page,
    pageSize: params.pageSize ?? ADMIN_LIST_PAGE_SIZE,
    search: (params.search ?? '').trim(),
    scope: params.scope,
    staffId: params.scope === 'mine' ? params.staffId : '',
    ops: params.opsFilter ?? null,
  })}`;
}

export const useAdminOrdersStore = create<AdminOrdersMeta>((set, get) => ({
  boardEpoch: 0,
  opsEpoch: 0,
  needsBoardRefresh: false,
  needsOpsRefresh: false,
  refreshingBoard: false,
  refreshingOps: false,

  ensureRealtime: () => {
    ensureOrdersRealtime();
  },

  fetchBoard: async (params, opts) => {
    const key = adminOrdersBoardKey(params);
    const cached = peekAdminQuery<AdminOrdersBoard>(key);
    const force = Boolean(opts?.force) || get().needsBoardRefresh;
    if (cached && !force && !cached.dirty) {
      const fresh = Date.now() - cached.fetchedAt < 5 * 60 * 1000;
      if (fresh) return;
    }
    if (cached && !opts?.force) {
      set({ refreshingBoard: true });
      void loadBoard(params, key).finally(() => set({ refreshingBoard: false }));
      return;
    }
    await loadBoard(params, key);
    set({ refreshingBoard: false });
  },

  fetchOps: async (opts) => {
    const cached = peekAdminQuery<OpsSummary>(ORDERS_OPS_KEY);
    const force = Boolean(opts?.force) || get().needsOpsRefresh;
    if (cached && !force && !cached.dirty && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return;
    }
    if (cached && !opts?.force) {
      set({ refreshingOps: true });
      void loadOps().finally(() => set({ refreshingOps: false }));
      return;
    }
    await loadOps();
    set({ refreshingOps: false });
  },

  fetchAssignees: async (opts) => {
    await ensureAdminQuery(ORDERS_ASSIGNEES_KEY, loadAssignees, {
      force: opts?.force,
      staleTime: 5 * 60 * 1000,
    });
  },

  writeBoard: (params, board) => {
    useAdminSessionStore.getState().setEntry(adminOrdersBoardKey(params), board);
  },

  patchOrder: (id, patch) => {
    patchOrderInBoards(id, (row) => ({ ...row, ...patch }));
  },

  applyRealtimeEvent: (event) => {
    applyOrdersRealtimeEvent(event, set, get);
  },

    invalidateOrders: () => {
    useAdminSessionStore.getState().invalidate('orders:');
    set({
      needsBoardRefresh: false,
      needsOpsRefresh: false,
      boardEpoch: 0,
      opsEpoch: 0,
    });
  },
}));

let realtimeStop: (() => void) | null = null;

export function ensureOrdersRealtime() {
  if (realtimeStop) return;
  realtimeStop = subscribeToAdminEvents((event) => {
    useAdminOrdersStore.getState().applyRealtimeEvent(event);
  });
}

function boardQuery(params: AdminOrdersBoardParams): URLSearchParams {
  const pageSize = params.pageSize ?? ADMIN_LIST_PAGE_SIZE;
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(pageSize),
  });
  const search = (params.search ?? '').trim();
  if (search) qs.set('search', search);
  if (params.scope === 'mine') {
    qs.set('assignedStaffId', params.staffId);
    return qs;
  }
  const opsFilter = params.opsFilter;
  if (opsFilter?.type === 'unassigned') {
    qs.set('assignedStaffId', 'unassigned');
    if (opsFilter.status) qs.set('status', opsFilter.status);
    else qs.set('activeOnly', '1');
  } else if (opsFilter?.type === 'staff') {
    qs.set('assignedStaffId', opsFilter.staffId);
    qs.set('activeOnly', '1');
  }
  return qs;
}

async function loadBoard(params: AdminOrdersBoardParams, key: string) {
  const startedEpoch = useAdminOrdersStore.getState().boardEpoch;
  try {
    const res = await fetch(`/api/admin/orders?${boardQuery(params)}`);
    if (!res.ok) {
      if (!peekAdminQuery(key)) {
        useAdminSessionStore.getState().setEntry(key, { items: [], total: 0 } satisfies AdminOrdersBoard);
      }
      return;
    }
    const data = await res.json();
    const items: AdminOrderRow[] = Array.isArray(data.items) ? data.items : [];
    const total = typeof data.total === 'number' ? data.total : 0;
    useAdminSessionStore.getState().setEntry(key, { items, total } satisfies AdminOrdersBoard);
    if (useAdminOrdersStore.getState().boardEpoch === startedEpoch) {
      useAdminOrdersStore.setState({ needsBoardRefresh: false });
    }
  } catch {
    if (!peekAdminQuery(key)) {
      useAdminSessionStore.getState().setEntry(key, { items: [], total: 0 } satisfies AdminOrdersBoard);
    }
  }
}

async function loadOps(): Promise<void> {
  const startedEpoch = useAdminOrdersStore.getState().opsEpoch;
  try {
    const res = await fetch('/api/admin/orders/ops-summary');
    if (!res.ok) return;
    const data = (await res.json()) as OpsSummary;
    useAdminSessionStore.getState().setEntry(ORDERS_OPS_KEY, data);
    if (useAdminOrdersStore.getState().opsEpoch === startedEpoch) {
      useAdminOrdersStore.setState({ needsOpsRefresh: false });
    }
  } catch {
    /* keep previous */
  }
}

async function loadAssignees(): Promise<AdminAssignee[]> {
  const res = await fetch('/api/admin/staff?pageSize=100');
  if (!res.ok) return peekAdminQuery<AdminAssignee[]>(ORDERS_ASSIGNEES_KEY)?.data ?? [];
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.filter((s: AdminAssignee & { active?: boolean }) => Boolean(s.active));
}

function patchOrderInBoards(id: string, update: (row: AdminOrderRow) => AdminOrderRow): boolean {
    const { entries, updateEntry } = useAdminSessionStore.getState();
    let found = false;
    for (const [key, entry] of Object.entries(entries)) {
      if (!key.startsWith(BOARD_PREFIX)) continue;
      const board = entry.data as AdminOrdersBoard;
      if (!board?.items?.some((row) => row.id === id)) continue;
      found = true;
      updateEntry(key, {
        ...board,
        items: board.items.map((row) => (row.id === id ? update(row) : row)),
      });
    }
  return found;
}

export function patchOrderFromEvent(
  order: AdminOrderRow,
  payload: Record<string, unknown>,
): AdminOrderRow {
  const assignedStaff = payload.assignedStaff as { id: string; name: string; mobile?: string } | null | undefined;
  const customer = payload.customer as AdminOrderCustomer | undefined;
  const items = Array.isArray(payload.items) ? (payload.items as AdminOrderItem[]) : undefined;
  return {
    ...order,
    ...(payload.status ? { status: String(payload.status) } : {}),
    ...(payload.priority ? { priority: String(payload.priority) } : {}),
    ...(payload.grandTotal != null ? { grandTotal: Number(payload.grandTotal) } : {}),
    ...(payload.discountAmount != null ? { discountAmount: Number(payload.discountAmount) } : {}),
    ...(payload.discountType != null ? { discountType: String(payload.discountType) } : {}),
    ...(payload.couponCode !== undefined
      ? { couponCode: payload.couponCode ? String(payload.couponCode) : null }
      : {}),
    ...(payload.deliveryNotes !== undefined
      ? { deliveryNotes: payload.deliveryNotes ? String(payload.deliveryNotes) : null }
      : {}),
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
    ...(items ? { items } : {}),
  };
}

let boardEpochTimer: ReturnType<typeof setTimeout> | null = null;
let opsEpochTimer: ReturnType<typeof setTimeout> | null = null;
const REALTIME_DEBOUNCE_MS = 800;

function bumpBoardRefresh(set: (partial: Partial<AdminOrdersMeta>) => void, get: () => AdminOrdersMeta) {
  set({ needsBoardRefresh: true });
  useAdminSessionStore.getState().markDirty(BOARD_PREFIX);
  if (boardEpochTimer) clearTimeout(boardEpochTimer);
  boardEpochTimer = setTimeout(() => {
    boardEpochTimer = null;
    set({ boardEpoch: get().boardEpoch + 1 });
  }, REALTIME_DEBOUNCE_MS);
}

function bumpOpsRefresh(set: (partial: Partial<AdminOrdersMeta>) => void, get: () => AdminOrdersMeta) {
  set({ needsOpsRefresh: true });
  useAdminSessionStore.getState().markDirty(ORDERS_OPS_KEY);
  if (opsEpochTimer) clearTimeout(opsEpochTimer);
  opsEpochTimer = setTimeout(() => {
    opsEpochTimer = null;
    set({ opsEpoch: get().opsEpoch + 1 });
  }, REALTIME_DEBOUNCE_MS);
}

function applyOrdersRealtimeEvent(
  event: AdminRealtimeEvent,
  set: (partial: Partial<AdminOrdersMeta>) => void,
  get: () => AdminOrdersMeta,
) {
  if (event.type === 'order_updated') {
    const payload = event.payload;
    const id = String(payload.id ?? '');
    if (!id) return;
    const found = patchOrderInBoards(id, (row) => patchOrderFromEvent(row, payload));
    bumpOpsRefresh(set, get);
    if (!found || Array.isArray(payload.items)) {
      bumpBoardRefresh(set, get);
    }
    return;
  }

  if (event.type === 'order_created' || event.type === 'orders_archived') {
    bumpBoardRefresh(set, get);
    bumpOpsRefresh(set, get);
    return;
  }

  if (event.type === 'whatsapp_verification_updated') {
    bumpBoardRefresh(set, get);
  }
}
