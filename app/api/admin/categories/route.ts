import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { categorySchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  return NextResponse.json(category, { status: 201 });
}
