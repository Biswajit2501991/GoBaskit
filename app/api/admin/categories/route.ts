import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { CategoryService } from '@/services/ProductService';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('categories:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await CategoryService.listAdmin({
    search: searchParams.get('search') || undefined,
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || ADMIN_LIST_PAGE_SIZE),
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('categories:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const slug = parsed.data.slug || slugify(parsed.data.name);
  const slugExists = await prisma.category.findUnique({ where: { slug } });
  if (slugExists) {
    return NextResponse.json({ error: { slug: ['Slug already exists'] } }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug,
      imageUrl: parsed.data.imageUrl || null,
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: parsed.data.isActive ?? true,
    },
    include: { _count: { select: { products: true } } },
  });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'category_created',
    entity: 'categories',
    entityId: category.id,
  });
  return NextResponse.json(category, { status: 201 });
}
