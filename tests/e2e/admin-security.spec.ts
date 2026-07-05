import { test, expect } from '@playwright/test';

test.describe('Admin security regression scaffold', () => {
  test('unauthenticated admin settings read is blocked', async ({ request }) => {
    const res = await request.get('/api/admin/settings');
    expect([401, 403]).toContain(res.status());
  });

  test('unauthenticated admin product write is blocked', async ({ request }) => {
    const res = await request.post('/api/admin/products', {
      data: {
        name: 'Unauth product',
        description: '',
        price: 10,
        unit: '1 pc',
        stock: 1,
        categoryId: 'invalid',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('public config exposes homepage config', async ({ request }) => {
    const res = await request.get('/api/config');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('homepageConfig');
    expect(data.homepageConfig).toHaveProperty('showHeroBanner');
  });
});
