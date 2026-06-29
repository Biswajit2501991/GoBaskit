import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const categories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let success = 0;
  const errors: string[] = [];
  const preview: unknown[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row['Product Name'] || row['name'] || '').trim();
    const categoryName = String(row['Category'] || row['category'] || '').trim();
    const price = parseFloat(String(row['Price'] || row['price'] || '0'));
    const unit = String(row['Unit'] || row['unit'] || '1 pc').trim();
    const stock = parseInt(String(row['Stock'] || row['stock'] || '0'), 10);
    const description = String(row['Description'] || row['description'] || '').trim();
    const imageUrl = String(row['Image URL'] || row['image_url'] || '').trim() || null;

    if (!name || !categoryName || !price) {
      errors.push(`Row ${i + 2}: Missing required fields`);
      continue;
    }

    let categoryId = categoryMap[categoryName.toLowerCase()];
    if (!categoryId) {
      const slug = slugify(categoryName);
      const cat = await prisma.category.create({ data: { name: categoryName, slug } });
      categoryId = cat.id;
      categoryMap[categoryName.toLowerCase()] = categoryId;
    }

    const existing = await prisma.product.findFirst({ where: { name } });
    if (existing) {
      errors.push(`Row ${i + 2}: Duplicate product "${name}" — skipped`);
      continue;
    }

    preview.push({ name, categoryName, price, unit, stock });
    success++;
  }

  const confirm = formData.get('confirm') === 'true';
  if (!confirm) {
    return NextResponse.json({ preview, success, errors, requiresConfirm: true });
  }

  let imported = 0;
  for (const item of preview as { name: string; categoryName: string; price: number; unit: string; stock: number }[]) {
    const categoryId = categoryMap[item.categoryName.toLowerCase()];
    await prisma.product.create({
      data: {
        name: item.name,
        price: item.price,
        unit: item.unit,
        stock: item.stock,
        categoryId,
        status: 'ACTIVE',
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, errors });
}
