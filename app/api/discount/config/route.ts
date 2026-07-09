import { NextResponse } from 'next/server';
import { DiscountEngine } from '@/services/DiscountEngine';

export async function GET() {
  try {
    const config = await DiscountEngine.getPublicConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error('[discount/config]', err);
    return NextResponse.json(
      {
        couponsEnabled: false,
        membershipEnabled: false,
        membershipMessage: '',
        membershipDiscountPercent: 0,
      },
      { status: 200 },
    );
  }
}
