import { NextRequest, NextResponse } from 'next/server';
import { VariantService } from '@/services/VariantService';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variants = await VariantService.listActiveByProduct(id);
  return NextResponse.json({ items: variants });
}
