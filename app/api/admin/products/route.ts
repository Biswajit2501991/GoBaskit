import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

export async function GET() {
  const auth = await requireStaffPermission('products:view');
  if (auth.error) return auth.error;
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('products:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      price: parsed.data.price,
      unit: parsed.data.unit,
      stock: parsed.data.stock,
      categoryId: parsed.data.categoryId,
      status: parsed.data.status ?? 'ACTIVE',
      imageUrl: parsed.data.imageUrl || null,
      discount: parsed.data.discount ?? 0,
      isFeatured: parsed.data.isFeatured ?? false,
      isVisible: parsed.data.isVisible ?? true,
    },
    include: { category: true },
  });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'product_created',
    entity: 'products',
    entityId: product.id,
  });
  return NextResponse.json(product, { status: 201 });
}
