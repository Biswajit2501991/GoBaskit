import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, stat } from 'fs/promises';
import sharp from 'sharp';

// Reads the same files as /uploads (public/uploads/**) but resizes them on the
// fly. It lives under /img/ so it is NOT shadowed by Next's static serving of
// public/ (which would otherwise ignore the ?w= query and return the full file).
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

/** Parse a safe target width from `?w=`; returns null when absent/invalid. */
function parseWidth(req: NextRequest): number | null {
  const raw = req.nextUrl.searchParams.get('w');
  if (!raw) return null;
  const w = Number(raw);
  if (!Number.isFinite(w)) return null;
  return Math.min(1600, Math.max(32, Math.round(w)));
}

export async function GET(req: NextRequest, { params }: RouteContext) {
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
    const width = parseWidth(req);

    // Resize on the fly for smaller contexts (cards, thumbnails). GIFs are left
    // untouched to preserve animation. Cloudflare/browser cache the result, so
    // sharp only runs on the first request per (path, width).
    if (width && ext !== '.gif') {
      try {
        const resized = await sharp(data)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        return new NextResponse(resized as unknown as BodyInit, {
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch {
        /* fall through to original on any resize failure */
      }
    }

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
