import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { WishlistService, WISHLIST_MAX_ITEMS } from '@/services/WishlistService';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Login required', code: 'LOGIN_REQUIRED' }, { status: 401 });
  }

  const items = await WishlistService.list(mobile);
  const keys = await WishlistService.idsForMobile(mobile);
  return NextResponse.json({ items, keys, max: WISHLIST_MAX_ITEMS });
}

const addSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Login required', code: 'LOGIN_REQUIRED' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid wishlist item' }, { status: 400 });
  }

  try {
    const item = await WishlistService.add(mobile, parsed.data);
    const items = await WishlistService.list(mobile);
    const keys = await WishlistService.idsForMobile(mobile);
    return NextResponse.json({ item, items, keys, max: WISHLIST_MAX_ITEMS }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add to wishlist';
    const status = message.includes('full') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Login required', code: 'LOGIN_REQUIRED' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const productId = searchParams.get('productId');
  const variantId = searchParams.get('variantId');

  if (id) {
    await WishlistService.remove(mobile, id);
  } else if (productId) {
    await WishlistService.removeByProduct(mobile, productId, variantId);
  } else {
    return NextResponse.json({ error: 'Missing id or productId' }, { status: 400 });
  }

  const items = await WishlistService.list(mobile);
  const keys = await WishlistService.idsForMobile(mobile);
  return NextResponse.json({ items, keys, max: WISHLIST_MAX_ITEMS });
}
