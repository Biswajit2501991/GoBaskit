'use client';

export type AdminRealtimeEvent =
  | { type: 'connected'; at: string }
  | { type: 'order_created'; payload: Record<string, unknown> }
  | { type: 'order_updated'; payload: Record<string, unknown> }
  | { type: 'notification_created'; payload: Record<string, unknown> };

type Listener = (event: AdminRealtimeEvent) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (source) return;
  source = new EventSource('/api/admin/events');
  source.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data) as AdminRealtimeEvent;
      listeners.forEach((listener) => listener(event));
    } catch {
      // ignore invalid event payloads
    }
  };
  source.onerror = () => {
    // Keep the stream healthy by forcing a reconnect.
    source?.close();
    source = null;
    if (listeners.size > 0) {
      connect();
    }
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
  listeners.add(listener);
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      scheduleDisconnect();
    }
  };
}
