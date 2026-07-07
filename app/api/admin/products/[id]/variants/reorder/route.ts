import { NextRequest, NextResponse } from 'next/server';
import { variantReorderSchema } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { VariantService } from '@/services/VariantService';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = variantReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
  }

  await VariantService.reorder(id, parsed.data.orderedIds);
  const variants = await VariantService.listByProduct(id);
  return NextResponse.json({ items: variants });
}
