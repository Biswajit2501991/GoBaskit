import { adminEventBus } from '@/lib/realtime/eventBus';
import { requireStaffSession } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'connected', at: new Date().toISOString() });

      unsubscribe = adminEventBus.subscribe((event) => {
        send(event);
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 25000);

      const cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
      };

      // @ts-expect-error attach cleanup for cancel
      controller._cleanup = cleanup;
    },
    cancel() {
      closed = true;
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
