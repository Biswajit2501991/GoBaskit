'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter({ staffId }: { staffId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [readState, setReadState] = useState<'all' | 'read' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundAtRef = useRef(0);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => {
        if (typeof c.notificationSoundEnabled === 'boolean') {
          setSoundEnabled(c.notificationSoundEnabled);
        }
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '20', readState });
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/admin/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    }
  }, [readState, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function playNotificationSound() {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 400) return;
    lastSoundAtRef.current = now;
    audioRef.current?.play().catch(() => {
      // browsers can block autoplay until user interaction
    });
  }

  useEffect(() => {
    const unsubscribe = subscribeToAdminEvents((data) => {
      if (data.type !== 'notification_created') return;
      const payload = data.payload as Record<string, unknown>;
      const targetStaffId = payload.staffId ? String(payload.staffId) : null;
      if (targetStaffId && targetStaffId !== staffId) return;

      const n: NotificationItem = {
        id: String(payload.id ?? ''),
        type: String(payload.type ?? ''),
        title: String(payload.title ?? ''),
        message: String(payload.message ?? ''),
        entityType: payload.entityType ? String(payload.entityType) : null,
        entityId: payload.entityId ? String(payload.entityId) : null,
        readAt: null,
        createdAt: String(payload.createdAt ?? new Date().toISOString()),
      };
      setUnreadCount((c) => c + 1);
      setItems((prev) => [{ ...n, readAt: null }, ...prev].slice(0, 10));
      setToast(n);
      setTimeout(() => setToast(null), 5000);

      playNotificationSound();

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(n.title, { body: n.message });
      }
    });
    return unsubscribe;
  }, [staffId, soundEnabled]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        // noop
      });
    }
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function markTypeRead() {
    if (!typeFilter) return;
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markTypeRead: typeFilter }),
    });
    await load();
  }

  return (
    <>
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAA////AAAA////AAAA////AAAA" type="audio/wav" />
      </audio>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="relative p-2 rounded-lg hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-lg z-50">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              <button type="button" onClick={load} className="text-xs text-gray-500 hover:underline">
                Refresh
              </button>
            </div>
            <div className="p-2 border-b bg-gray-50 space-y-2">
              <div className="flex gap-2">
                <select
                  value={readState}
                  onChange={(e) => setReadState(e.target.value as 'all' | 'read' | 'unread')}
                  className="text-xs border rounded px-2 py-1 flex-1"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs border rounded px-2 py-1 flex-1"
                >
                  <option value="">All types</option>
                  <option value="new_order">New Order</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="flex justify-between">
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllRead} className="text-xs text-blinkit-green hover:underline">
                    Mark all read
                  </button>
                ) : <span />}
                {typeFilter && (
                  <button type="button" onClick={markTypeRead} className="text-xs text-blinkit-green hover:underline">
                    Mark {typeFilter} read
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No notifications</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { if (!n.readAt) markRead(n.id); }}
                    className={`w-full text-left p-3 border-b hover:bg-gray-50 ${!n.readAt ? 'bg-green-50/50' : ''}`}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{n.message}</p>
                    {n.entityType === 'orders' && n.entityId && (
                      <Link href="/admin/orders" className="text-xs text-blinkit-green mt-1 inline-block" onClick={() => setOpen(false)}>
                        View orders →
                      </Link>
                    )}
                    {n.entityType === 'products' && n.entityId && (
                      <Link href="/admin/products" className="text-xs text-blinkit-green mt-1 inline-block" onClick={() => setOpen(false)}>
                        Update stock →
                      </Link>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-white border shadow-lg rounded-xl p-4 max-w-sm flex gap-3">
          <Bell className="w-5 h-5 text-blinkit-green shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{toast.title}</p>
            <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{toast.message}</p>
          </div>
          <button type="button" onClick={() => setToast(null)}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}
    </>
  );
}
