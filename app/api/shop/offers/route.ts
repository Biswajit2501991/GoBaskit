import { NextResponse } from 'next/server';
import { requireShopStaff } from '@/lib/staff-auth';
import { ShopSourcingService } from '@/services/ShopSourcingService';

export async function GET() {
  const auth = await requireShopStaff();
  if (auth.error) return auth.error;
  const [offers, fulfillments] = await Promise.all([
    ShopSourcingService.listOpenForShop(auth.staff!.shopId!),
    ShopSourcingService.listFulfillmentsForShop(auth.staff!.shopId!),
  ]);
  return NextResponse.json({ offers, fulfillments });
}
