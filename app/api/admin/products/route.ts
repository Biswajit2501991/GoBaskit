import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { buildProductPricingData } from '@/utils/pricing';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { ProductService } from '@/services/ProductService';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('products:view');
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const data = await ProductService.listAdmin({
      search: searchParams.get('search') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || ADMIN_LIST_PAGE_SIZE),
      sort: searchParams.get('sort') === 'stock' ? 'stock' : 'name',
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin/products GET]', err);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
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

  const pricing = buildProductPricingData({
    price: parsed.data.price,
    actualPrice: parsed.data.actualPrice,
  });

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      price: pricing.price,
      actualPrice: pricing.actualPrice,
      unit: parsed.data.unit,
      stock: parsed.data.stock,
      categoryId: parsed.data.categoryId,
      status: parsed.data.status ?? 'ACTIVE',
      imageUrl: parsed.data.imageUrl || null,
      discount: pricing.discount,
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
