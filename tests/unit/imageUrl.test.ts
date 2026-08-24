import { upiQrDisplayUrl } from '@/utils/image';

describe('upiQrDisplayUrl', () => {
  it('maps a mistaken products path to the badges /img route', () => {
    expect(upiQrDisplayUrl('/uploads/products/qr.png', 360)).toBe('/img/badges/qr.png?w=360');
  });

  it('leaves an already-correct badges path on /img', () => {
    expect(upiQrDisplayUrl('/uploads/badges/qr.png', 360)).toBe('/img/badges/qr.png?w=360');
  });

  it('leaves external URLs unchanged', () => {
    expect(upiQrDisplayUrl('https://cdn.example/qr.png', 360)).toBe('https://cdn.example/qr.png');
  });
});
