import { mkdir } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import JSZip from 'jszip';
import { compressAndSave } from './imageCompress';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function processImageZip(buffer: ArrayBuffer): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(buffer);
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  await mkdir(uploadDir, { recursive: true });

  const map: Record<string, string> = {};

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const basename = path.basename(name);
    const ext = basename.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXT.has(ext)) continue;

    const content = await file.async('uint8array');
    if (content.byteLength > MAX_IMAGE_SIZE) continue;

    const baseFilename = `${Date.now()}-${randomBytes(4).toString('hex')}-${basename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { url } = await compressAndSave(Buffer.from(content), uploadDir, baseFilename);

    const key = basename.toLowerCase();
    map[key] = url;
    const stem = basename.replace(/\.[^.]+$/, '').toLowerCase();
    map[stem] = url;
  }

  return map;
}

export function resolveImageUrl(
  imageUrl: string,
  imageMap: Record<string, string>,
  sku?: string,
  productName?: string
): string {
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;

  const lower = imageUrl.toLowerCase();
  if (imageMap[lower]) return imageMap[lower];

  const stem = imageUrl.replace(/\.[^.]+$/, '').toLowerCase();
  if (imageMap[stem]) return imageMap[stem];
  if (sku && imageMap[sku.toLowerCase()]) return imageMap[sku.toLowerCase()];
  if (productName && imageMap[productName.toLowerCase().replace(/\s+/g, '-')]) {
    return imageMap[productName.toLowerCase().replace(/\s+/g, '-')];
  }

  return imageUrl;
}
