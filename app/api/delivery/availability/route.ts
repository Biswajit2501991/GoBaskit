import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDeliveryPartner } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { PartnerDeliveryError, PartnerDeliveryService } from '@/services/PartnerDeliveryService';

const bodySchema = z.object({
  online: z.boolean(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireDeliveryPartner();
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose on or off' }, { status: 400 });
  }
  try {
    const session = await PartnerDeliveryService.setOnline(auth.staff!.id, parsed.data.online);
    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof PartnerDeliveryError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not update Start Delivery' }, { status: 400 });
  }
}
