import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { variantSchema } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { VariantService } from '@/services/VariantService';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:view');
  if (auth.error) return auth.error;

  const { id } = await params;
  const variants = await VariantService.listByProduct(id);
  return NextResponse.json({ items: variants });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const body = await req.json();
  const parsed = variantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const variant = await VariantService.create(id, parsed.data);
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'variant_created',
    entity: 'product_variants',
    entityId: variant.id,
  });
  return NextResponse.json(variant, { status: 201 });
}
