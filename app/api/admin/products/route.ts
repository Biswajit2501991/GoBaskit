import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validations';
import { buildProductPricingData } from '@/utils/pricing';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { InventoryService } from '@/services/InventoryService';
import { ProductService, CategoryService } from '@/services/ProductService';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants';
import { parseAdminSourceFilter, parseAdminStockFilter } from '@/lib/adminProductFilters';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('products:view');
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const stock = parseAdminStockFilter(searchParams.get('stock'));
    const source = parseAdminSourceFilter(searchParams.get('source'));

    if (searchParams.get('idsOnly') === '1') {
      const data = await ProductService.listAdminIds({ search, categoryId, stock, source });
      return NextResponse.json(data);
    }

    const includeCategories = searchParams.get('includeCategories') === '1';
    const [data, categories] = await Promise.all([
      ProductService.listAdmin({
        search,
        categoryId,
        page: Number(searchParams.get('page') || 1),
        pageSize: Number(searchParams.get('pageSize') || ADMIN_LIST_PAGE_SIZE),
        sort: searchParams.get('sort') === 'stock' ? 'stock' : 'name',
        stock,
        source,
      }),
      includeCategories ? CategoryService.getAll(false) : Promise.resolve(null),
    ]);

    return NextResponse.json(categories ? { ...data, categories } : data);
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
      details: parsed.data.details ?? '',
      price: pricing.price,
      actualPrice: pricing.actualPrice,
      unit: parsed.data.unit,
      stock: parsed.data.stock,
      stockBaseline: parsed.data.stock,
      categoryId: parsed.data.categoryId,
      status: InventoryService.resolveStatus(parsed.data.stock, parsed.data.status ?? 'ACTIVE'),
      imageUrl: parsed.data.imageUrl || null,
      discount: pricing.discount,
      isFeatured: parsed.data.isFeatured ?? false,
      isVisible: parsed.data.isVisible ?? true,
      hasVariants: parsed.data.hasVariants ?? false,
      healthStarRating: parsed.data.healthStarRating ?? null,
      fulfillmentSource: parsed.data.fulfillmentSource ?? 'UNSET',
      costPrice: parsed.data.costPrice ?? null,
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
