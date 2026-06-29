import { NextResponse } from 'next/server';
import { CategoryService } from '@/services/ProductService';

export async function GET() {
  const categories = await CategoryService.getAll();
  return NextResponse.json(categories);
}
