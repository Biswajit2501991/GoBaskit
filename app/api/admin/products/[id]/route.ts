import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { productSchema } from '@/lib/validations';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const product = await prisma.product.update({
    where: { id },
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

  return NextResponse.json(product);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
