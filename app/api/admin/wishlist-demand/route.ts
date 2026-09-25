import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { WishlistService } from '@/services/WishlistService';

/** Read-only ranked wishlist demand. Does not change wishlist rows. */
export async function GET() {
  const auth = await requireStaffPermission('products:view');
  if (auth.error) return auth.error;

  const data = await WishlistService.demandRanking();
  return NextResponse.json({ ok: true, ...data });
}
