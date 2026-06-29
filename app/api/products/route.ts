import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/services/ProductService';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const products = await ProductService.getAll({
    search: searchParams.get('search') || undefined,
    categorySlug: searchParams.get('category') || undefined,
    featured: searchParams.get('featured') === 'true',
    sort: (searchParams.get('sort') as 'price_asc' | 'price_desc' | 'name') || 'name',
  });
  return NextResponse.json(products);
}
