import { adminEventBus } from '@/lib/realtime/eventBus';
import { requireShopStaff } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireShopStaff();
  if (auth.error) return auth.error;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const staffId = auth.staff!.id;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: 'connected', at: new Date().toISOString() });
      unsubscribe = adminEventBus.subscribe((event) => {
        if (event.type === 'notification_created') {
          const payload = event.payload as { staffId?: string | null };
          if (payload.staffId && payload.staffId !== staffId) return;
        }
        send(event);
      });
      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
