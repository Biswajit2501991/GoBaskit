import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { requireSameOrigin } from '@/lib/security';
import { getRequestMeta } from '@/lib/request-meta';

/** DELETE /api/admin/whatsapp-verifications/[id] — remove row + clear verified flags. */
export async function DELETE(
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
    const result = await WhatsAppVerificationService.deleteVerification(id, auth.staff!.id, meta.ip);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
