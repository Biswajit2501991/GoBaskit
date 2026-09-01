import {
  adminLoginHref,
  sanitizeAdminNextPath,
  staffOrderDeepLink,
} from '@/lib/adminDeepLink';

describe('sanitizeAdminNextPath', () => {
  it('allows staff order deep links and rejects off-site URLs', () => {
    expect(sanitizeAdminNextPath('/admin/orders?order=clxxxxxxxxxxxxxxxxxxxx')).toBe(
      '/admin/orders?order=clxxxxxxxxxxxxxxxxxxxx',
    );
    expect(sanitizeAdminNextPath('/admin/settings')).toBe('/admin/settings');
    expect(sanitizeAdminNextPath('/admin')).toBeNull();
    expect(sanitizeAdminNextPath('/')).toBeNull();
    expect(sanitizeAdminNextPath('https://evil.example/admin/orders')).toBeNull();
    expect(sanitizeAdminNextPath('//evil.example/admin/orders')).toBeNull();
    expect(sanitizeAdminNextPath('/store')).toBeNull();
  });
});

describe('adminLoginHref', () => {
  it('attaches a safe next query for login', () => {
    expect(adminLoginHref('/admin/orders?order=abc12345abc12345abc12345')).toContain(
      'next=%2Fadmin%2Forders%3Forder%3D',
    );
    expect(adminLoginHref('https://evil.example')).toBe('/admin');
  });
});

describe('staffOrderDeepLink', () => {
  it('builds an orders URL only for plausible ids', () => {
    expect(staffOrderDeepLink('clxxxxxxxxxxxxxxxxxxxx')).toBe(
      '/admin/orders?order=clxxxxxxxxxxxxxxxxxxxx',
    );
    expect(staffOrderDeepLink('../x')).toBe('/admin/orders');
    expect(staffOrderDeepLink('')).toBe('/admin/orders');
  });
});
