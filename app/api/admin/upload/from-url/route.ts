import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { randomBytes } from 'crypto';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { compressAndSave } from '@/services/bulk-upload/imageCompress';

const MAX_REMOTE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const remoteUrl = String(body?.url || '').trim();
  const type = body?.type === 'category' ? 'category' : 'product';

  if (!remoteUrl) {
    return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'GoBaskit-ImageImporter/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch image (${res.status})` }, { status: 400 });
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!Array.from(ALLOWED_TYPES).some((typeName) => contentType.includes(typeName.split('/')[1]))) {
      return NextResponse.json({ error: 'URL did not return a supported image type' }, { status: 400 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REMOTE_SIZE) {
      return NextResponse.json({ error: 'Image is empty or too large (max 8MB)' }, { status: 400 });
    }

    const folder = type === 'category' ? 'categories' : 'products';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    const baseFilename = `${Date.now()}-${randomBytes(6).toString('hex')}`;

    const { url, thumbUrl, filename } = await compressAndSave(buffer, uploadDir, baseFilename, {
      withThumbnail: false,
      fast: true,
    });

    await prisma.upload.create({
      data: {
        filename,
        url,
        type: folder,
        size: buffer.length,
      },
    });

    return NextResponse.json({ url, thumbUrl, filename });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: 'Failed to import image from URL' }, { status: 500 });
  }
}

