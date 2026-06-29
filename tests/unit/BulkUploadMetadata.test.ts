import { embedMetadata, extractMetadata, skuFromDescription } from '@/services/bulk-upload/metadata';

describe('metadata helpers', () => {
  it('embeds and extracts SKU metadata', () => {
    const desc = embedMetadata('Fresh tomatoes', { sku: 'VEG-001', brand: 'Farm' });
    expect(extractMetadata(desc).sku).toBe('VEG-001');
    expect(skuFromDescription(desc)).toBe('VEG-001');
  });
});
