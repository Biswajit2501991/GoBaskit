import { compressImage } from '@/services/bulk-upload/imageCompress';
import sharp from 'sharp';

describe('imageCompress', () => {
  it('resizes and compresses a large image buffer', async () => {
    const large = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    expect(large.byteLength).toBeGreaterThan(5000);

    const result = await compressImage(large);
    expect(result.main.byteLength).toBeLessThan(large.byteLength);
    expect(result.thumbnail.byteLength).toBeGreaterThan(0);
    expect(['jpg', 'webp', 'png']).toContain(result.ext);
  });
});
