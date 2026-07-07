import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { VariantService } from '@/services/VariantService';

type RouteContext = { params: Promise<{ id: string; variantId: string }> };

const bodySchema = z.object({ stock: z.coerce.number().int().min(0) });

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id, variantId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid stock value' }, { status: 400 });
  }

  try {
    const variant = await VariantService.updateStock(id, variantId, parsed.data.stock);
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'variant_stock_updated',
      entity: 'product_variants',
      entityId: variant.id,
    });
    return NextResponse.json(variant);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update stock';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
