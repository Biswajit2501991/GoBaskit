import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { buildProductPricingData } from '@/utils/pricing';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { InventoryService } from '@/services/InventoryService';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const pricing = buildProductPricingData({
    price: parsed.data.price,
    actualPrice: parsed.data.actualPrice,
  });

  await InventoryService.applyAdminStockUpdate(
    existing,
    parsed.data.stock,
    parsed.data.status ?? existing.status,
  );

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      price: pricing.price,
      actualPrice: pricing.actualPrice,
      unit: parsed.data.unit,
      categoryId: parsed.data.categoryId,
      imageUrl: parsed.data.imageUrl || null,
      discount: pricing.discount,
      isFeatured: parsed.data.isFeatured ?? false,
      isVisible: parsed.data.isVisible ?? true,
    },
    include: { category: true },
  });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'product_updated',
    entity: 'products',
    entityId: product.id,
  });

  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('products:delete');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'product_deleted',
    entity: 'products',
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
