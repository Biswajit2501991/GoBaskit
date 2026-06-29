import sharp from 'sharp';

const MAX_WIDTH = 1200;
const THUMB_SIZE = 200;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 80;

export interface CompressedImage {
  main: Buffer;
  thumbnail: Buffer;
  ext: 'webp' | 'jpg' | 'png';
}

export async function compressImage(input: Buffer): Promise<CompressedImage> {
  const image = sharp(input, { failOn: 'none' });
  const meta = await image.metadata();

  const mainPipeline = sharp(input).rotate().resize({
    width: MAX_WIDTH,
    height: MAX_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const thumbnailPipeline = sharp(input).rotate().resize(THUMB_SIZE, THUMB_SIZE, {
    fit: 'cover',
    position: 'centre',
  });

  if (meta.hasAlpha) {
    const [main, thumbnail] = await Promise.all([
      mainPipeline.webp({ quality: WEBP_QUALITY }).toBuffer(),
      thumbnailPipeline.webp({ quality: 70 }).toBuffer(),
    ]);
    return { main, thumbnail, ext: 'webp' };
  }

  const [main, thumbnail] = await Promise.all([
    mainPipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(),
    thumbnailPipeline.jpeg({ quality: 75, mozjpeg: true }).toBuffer(),
  ]);
  return { main, thumbnail, ext: 'jpg' };
}

export async function compressAndSave(
  input: Buffer,
  uploadDir: string,
  baseFilename: string
): Promise<{ url: string; thumbUrl: string; filename: string }> {
  const { writeFile, mkdir } = await import('fs/promises');
  await mkdir(uploadDir, { recursive: true });

  const { main, thumbnail, ext } = await compressImage(input);
  const filename = `${baseFilename}.${ext}`;
  const thumbFilename = `${baseFilename}-thumb.${ext}`;
  const filepath = `${uploadDir}/${filename}`;
  const thumbPath = `${uploadDir}/${thumbFilename}`;

  await Promise.all([writeFile(filepath, main), writeFile(thumbPath, thumbnail)]);

  const folder = uploadDir.includes('categories') ? 'categories' : 'products';
  return {
    url: `/uploads/${folder}/${filename}`,
    thumbUrl: `/uploads/${folder}/${thumbFilename}`,
    filename,
  };
}
