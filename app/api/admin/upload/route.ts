import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { randomBytes } from 'crypto';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { compressAndSave } from '@/services/bulk-upload/imageCompress';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'product';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, and GIF images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
    }

    const folder = type === 'category' ? 'categories' : 'products';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    const baseFilename = `${Date.now()}-${randomBytes(6).toString('hex')}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url, thumbUrl, filename } = await compressAndSave(buffer, uploadDir, baseFilename, {
      // Product uploads don't need generated thumbnails right now; skipping them
      // keeps upload latency low for normal admin image updates.
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
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
