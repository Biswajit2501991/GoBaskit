type RealtimeEvent =
  | { type: 'order_created'; payload: Record<string, unknown> }
  | { type: 'order_updated'; payload: Record<string, unknown> }
  | { type: 'orders_archived'; payload: Record<string, unknown> }
  | { type: 'whatsapp_verification_updated'; payload: Record<string, unknown> }
  | { type: 'notification_created'; payload: Record<string, unknown> };

type Listener = (event: RealtimeEvent) => void;

class RealtimeEventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: RealtimeEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const adminEventBus = new RealtimeEventBus();

export type { RealtimeEvent };
