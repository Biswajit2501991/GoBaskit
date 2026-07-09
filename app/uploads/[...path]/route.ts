import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, stat } from 'fs/promises';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_FOLDERS = new Set(['products', 'categories', 'badges']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const segments = (await params).path;
  if (!segments?.length || segments.some((s) => s.includes('..') || s.includes('\0'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!ALLOWED_FOLDERS.has(segments[0])) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.join(UPLOADS_ROOT, ...segments);
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse('Not found', { status: 404 });

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return new NextResponse('Not found', { status: 404 });

    const data = await readFile(filePath);

    return new NextResponse(data as unknown as BodyInit, {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
