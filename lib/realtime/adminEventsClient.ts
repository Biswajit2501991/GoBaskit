'use client';

export type AdminRealtimeEvent =
  | { type: 'connected'; at: string }
  | { type: 'order_created'; payload: Record<string, unknown> }
  | { type: 'order_updated'; payload: Record<string, unknown> }
  | { type: 'orders_archived'; payload: Record<string, unknown> }
  | { type: 'whatsapp_verification_updated'; payload: Record<string, unknown> }
  | { type: 'notification_created'; payload: Record<string, unknown> };

type Listener = (event: AdminRealtimeEvent) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

function connect() {
  if (source || reconnectTimer) return;
  source = new EventSource('/api/admin/events');
  source.onopen = () => {
    reconnectAttempts = 0;
  };
  source.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data) as AdminRealtimeEvent;
      listeners.forEach((listener) => listener(event));
    } catch {
      // ignore invalid event payloads
    }
  };
  source.onerror = () => {
    source?.close();
    source = null;
    if (listeners.size === 0) return;

    reconnectAttempts += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempts - 1, 5));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
}

function scheduleDisconnect() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (listeners.size === 0) {
      source?.close();
      source = null;
    }
  }, 5000);
}

export function subscribeToAdminEvents(listener: Listener) {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  listeners.add(listener);
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      scheduleDisconnect();
    }
  };
}
