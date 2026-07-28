import { NextResponse } from 'next/server';
import { CategoryService } from '@/services/ProductService';

export async function GET() {
  const categories = await CategoryService.getAll();
  return NextResponse.json(categories, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
