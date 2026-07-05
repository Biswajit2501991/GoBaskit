import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

function toTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ',');
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || '').trim();
  const category = (searchParams.get('category') || '').trim();

  if (name.length < 2) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  }

  const baseTags = [toTag(name), toTag(category), 'indian,grocery', 'food']
    .filter(Boolean)
    .join(',');

  const suggestions = [1, 2, 3, 4].map((n) => ({
    id: `s${n}`,
    url: `https://loremflickr.com/1200/1200/${baseTags}?lock=${n}`,
    label: `Suggestion ${n}`,
  }));

  return NextResponse.json({ suggestions });
}

