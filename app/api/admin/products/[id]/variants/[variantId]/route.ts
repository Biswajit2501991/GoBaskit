import { NextRequest, NextResponse } from 'next/server';
import { variantSchema } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { VariantService } from '@/services/VariantService';

type RouteContext = { params: Promise<{ id: string; variantId: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id, variantId } = await params;
  const body = await req.json();
  const parsed = variantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const variant = await VariantService.update(id, variantId, parsed.data);
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'variant_updated',
      entity: 'product_variants',
      entityId: variant.id,
    });
    return NextResponse.json(variant);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update variant';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id, variantId } = await params;
  await VariantService.remove(id, variantId);
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'variant_deleted',
    entity: 'product_variants',
    entityId: variantId,
  });
  return NextResponse.json({ success: true });
}
