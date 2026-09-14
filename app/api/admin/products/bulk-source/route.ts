import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { parseCostPrice } from '@/lib/fulfillmentSource';

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  fulfillmentSource: z.enum(['UNSET', 'IN_HOUSE', 'OUTSOURCE']),
  costPrice: z.unknown().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Select products and a tag' }, { status: 400 });
  }

  const data: { fulfillmentSource: 'UNSET' | 'IN_HOUSE' | 'OUTSOURCE'; costPrice?: number | null } = {
    fulfillmentSource: parsed.data.fulfillmentSource,
  };
  if (parsed.data.costPrice !== undefined) {
    data.costPrice = parseCostPrice(parsed.data.costPrice);
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: parsed.data.ids } },
    data,
  });

  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'products_bulk_source',
    entity: 'products',
    meta: { count: result.count, fulfillmentSource: parsed.data.fulfillmentSource },
  });

  return NextResponse.json({ updated: result.count });
}
