import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { productSchema } from '@/lib/validations';

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  return NextResponse.json(product, { status: 201 });
}
