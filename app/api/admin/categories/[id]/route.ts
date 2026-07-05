import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('categories:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const slug = parsed.data.slug || slugify(parsed.data.name);
  const slugConflict = await prisma.category.findFirst({
    where: { slug, NOT: { id } },
  });
  if (slugConflict) {
    return NextResponse.json({ error: { slug: ['Slug already in use'] } }, { status: 400 });
  }

  const category = await prisma.category.update({
    where: { id },
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
    action: 'category_updated',
    entity: 'categories',
    entityId: category.id,
  });

  return NextResponse.json(category);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('categories:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  if (existing._count.products > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${existing._count.products} product(s) use this category` },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id } });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'category_deleted',
    entity: 'categories',
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
