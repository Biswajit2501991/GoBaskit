import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { requireSameOrigin } from '@/lib/security';
import { getRequestMeta } from '@/lib/request-meta';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission('verification:manage', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const meta = getRequestMeta(req);

  try {
    const result = await WhatsAppVerificationService.approve(id, auth.staff!.id, meta.ip);
    // Best-effort customer notification when Cloud API is configured.
    if (result.mobile) {
      const { sendWhatsAppTextReply } = await import('@/lib/whatsapp-cloud');
      void sendWhatsAppTextReply(
        result.mobile,
        'GoBaskit: Your WhatsApp account is verified. Thank you!',
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
