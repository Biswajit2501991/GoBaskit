import sharp from 'sharp';

const MAX_WIDTH = 1200;
const THUMB_SIZE = 200;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 80;

export interface CompressedImage {
  main: Buffer;
  thumbnail?: Buffer;
  ext: 'webp' | 'jpg' | 'png';
}

export async function compressImage(
  input: Buffer,
  options?: { withThumbnail?: boolean; fast?: boolean },
): Promise<CompressedImage> {
  const withThumbnail = options?.withThumbnail ?? true;
  const fast = options?.fast ?? false;
  const image = sharp(input, { failOn: 'none' });
  const meta = await image.metadata();
  const sourceFormat = (meta.format || '').toLowerCase();

  const mainPipeline = sharp(input).rotate().resize({
    width: MAX_WIDTH,
    height: MAX_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const thumbnailPipeline = withThumbnail
    ? sharp(input).rotate().resize(THUMB_SIZE, THUMB_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
    : null;

  if (sourceFormat === 'png') {
    const [main, thumbnail] = await Promise.all([
      mainPipeline
        .png({ compressionLevel: fast ? 6 : 9, adaptiveFiltering: true, quality: 90 })
        .toBuffer(),
      withThumbnail && thumbnailPipeline
        ? thumbnailPipeline
            .png({ compressionLevel: fast ? 6 : 9, adaptiveFiltering: true, quality: 82 })
            .toBuffer()
        : Promise.resolve(undefined),
    ]);
    return { main, thumbnail, ext: 'png' };
  }

  if (meta.hasAlpha) {
    const [main, thumbnail] = await Promise.all([
      mainPipeline.webp({ quality: fast ? 76 : WEBP_QUALITY, effort: fast ? 2 : 4 }).toBuffer(),
      withThumbnail && thumbnailPipeline
        ? thumbnailPipeline.webp({ quality: 70, effort: fast ? 2 : 4 }).toBuffer()
        : Promise.resolve(undefined),
    ]);
    return { main, thumbnail, ext: 'webp' };
  }

  const [main, thumbnail] = await Promise.all([
    mainPipeline.jpeg({ quality: fast ? 78 : JPEG_QUALITY, mozjpeg: !fast }).toBuffer(),
    withThumbnail && thumbnailPipeline
      ? thumbnailPipeline.jpeg({ quality: 75, mozjpeg: !fast }).toBuffer()
      : Promise.resolve(undefined),
  ]);
  return { main, thumbnail, ext: 'jpg' };
}

export async function compressAndSave(
  input: Buffer,
  uploadDir: string,
  baseFilename: string,
  options?: { withThumbnail?: boolean; fast?: boolean },
): Promise<{ url: string; thumbUrl: string; filename: string }> {
  const { writeFile, mkdir } = await import('fs/promises');
  await mkdir(uploadDir, { recursive: true });

  const withThumbnail = options?.withThumbnail ?? true;
  const { main, thumbnail, ext } = await compressImage(input, options);
  const filename = `${baseFilename}.${ext}`;
  const thumbFilename = `${baseFilename}-thumb.${ext}`;
  const filepath = `${uploadDir}/${filename}`;
  const writes: Promise<unknown>[] = [writeFile(filepath, main)];
  if (withThumbnail && thumbnail) {
    const thumbPath = `${uploadDir}/${thumbFilename}`;
    writes.push(writeFile(thumbPath, thumbnail));
  }
  await Promise.all(writes);

  const folder = uploadDir.includes('categories') ? 'categories' : 'products';
  return {
    url: `/uploads/${folder}/${filename}`,
    thumbUrl: withThumbnail ? `/uploads/${folder}/${thumbFilename}` : `/uploads/${folder}/${filename}`,
    filename,
  };
}
