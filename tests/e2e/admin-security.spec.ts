import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

function randomMobile() {
  const suffix = Math.floor(Math.random() * 9000000) + 1000000;
  return `9${suffix}123`;
}

async function loginStaff(ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>, mobile: string, password: string) {
  const res = await ctx.post('/api/auth/staff-login', {
    data: { mobile, password, rememberMe: false },
  });
  return res;
}

async function loginAnyAdmin(ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>) {
  const staffRes = await loginStaff(ctx, '9046370119', 'admin123');
  if (staffRes.ok()) return 'staff';

  const legacyRes = await ctx.post('/api/auth/login', {
    data: { email: 'admin@gobaskit.com', password: 'admin123' },
  });
  if (legacyRes.ok()) return 'legacy';
  return null;
}

async function createStaff(
  adminCtx: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  role: string,
) {
  const mobile = randomMobile();
  const password = 'rolepass123';
  const res = await adminCtx.post('/api/admin/staff', {
    data: {
      name: `E2E ${role} ${mobile.slice(-4)}`,
      mobile,
      role,
      password,
      active: true,
    },
  });
  if (!res.ok()) return null;
  const staff = await res.json();
  return { id: staff.id as string, mobile, password };
}

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
    expect(data).toHaveProperty('serviceablePins');
    if (data.homepageConfig) {
      expect(data.homepageConfig).toHaveProperty('showHeroBanner');
    }
  });

  test('session expiry blocks staff endpoints after logout', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL });
    const mode = await loginAnyAdmin(ctx);
    test.skip(!mode, 'Admin credentials not available in this environment');
    const authRes = await ctx.get('/api/admin/orders');
    expect(authRes.status()).not.toBe(401);

    await ctx.delete('/api/auth/login');
    await ctx.delete('/api/auth/staff-login');
    const afterLogout = await ctx.get('/api/admin/orders');
    expect([401, 403]).toContain(afterLogout.status());
    await ctx.dispose();
  });

  test('read-only role cannot mutate product APIs', async () => {
    const adminCtx = await playwrightRequest.newContext({ baseURL });
    const mode = await loginAnyAdmin(adminCtx);
    test.skip(!mode, 'Admin credentials not available in this environment');
    const ro = await createStaff(adminCtx, 'READ_ONLY');
    test.skip(!ro, 'Staff management endpoint unavailable in this environment');

    const roCtx = await playwrightRequest.newContext({ baseURL });
    const roLogin = await loginStaff(roCtx, ro.mobile, ro.password);
    test.skip(!roLogin.ok(), 'Staff mobile login unavailable in this environment');
    const res = await roCtx.post('/api/admin/products', {
      data: { name: 'forbidden', categoryId: 'x' },
    });
    expect([401, 403]).toContain(res.status());

    await roCtx.dispose();
    await adminCtx.dispose();
  });

  test('order lock ownership blocks non-owner edits', async () => {
    const adminCtx = await playwrightRequest.newContext({ baseURL });
    const mode = await loginAnyAdmin(adminCtx);
    test.skip(!mode, 'Admin credentials not available in this environment');
    const staffA = await createStaff(adminCtx, 'ORDER_MANAGER');
    const staffB = await createStaff(adminCtx, 'ORDER_MANAGER');
    test.skip(!staffA || !staffB, 'Staff creation endpoint unavailable in this environment');

    const cfgRes = await adminCtx.get('/api/config');
    const cfg = await cfgRes.json();
    const pin = Array.isArray(cfg.serviceablePins) && cfg.serviceablePins.length ? cfg.serviceablePins[0] : '700001';

    const productsRes = await adminCtx.get('/api/products');
    const products = await productsRes.json();
    expect(Array.isArray(products) && products.length > 0).toBeTruthy();
    const product = products[0];
    const minOrder = typeof cfg.minOrderValue === 'number' ? cfg.minOrderValue : 0;
    const qty = Math.max(1, Math.ceil((minOrder + 10) / Math.max(1, Number(product.price))));

    const checkoutRes = await adminCtx.post('/api/checkout', {
      data: {
        customer: {
          firstName: 'E2E',
          lastName: 'Lock',
          mobile: `9${Date.now().toString().slice(-9)}`,
          houseNumber: '10A',
          street: 'Main Road',
          area: 'Center',
          city: 'Kolkata',
          state: 'WB',
          pincode: pin,
          paymentMethod: 'COD',
        },
        paymentMethod: 'COD',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: qty,
            price: Number(product.price),
            unit: product.unit,
          },
        ],
      },
    });
    expect(checkoutRes.ok()).toBeTruthy();
    const checkout = await checkoutRes.json();
    const orderId = checkout.order.id as string;

    const aCtx = await playwrightRequest.newContext({ baseURL });
    const bCtx = await playwrightRequest.newContext({ baseURL });
    const aLogin = await loginStaff(aCtx, staffA.mobile, staffA.password);
    const bLogin = await loginStaff(bCtx, staffB.mobile, staffB.password);
    test.skip(!aLogin.ok() || !bLogin.ok(), 'Staff login endpoint unavailable in this environment');

    const assignRes = await aCtx.post(`/api/admin/orders/${orderId}/assign`, {
      data: { staffId: staffA.id },
    });
    expect([200, 403, 404]).toContain(assignRes.status());
    test.skip(!assignRes.ok(), 'Order assignment route unavailable in this environment');

    const blockedUpdate = await bCtx.patch('/api/admin/orders', {
      data: { id: orderId, status: 'PACKED' },
    });
    expect([400, 403]).toContain(blockedUpdate.status());
    const blockedJson = await blockedUpdate.json();
    expect(String(blockedJson.error || '')).toMatch(/locked/i);

    await aCtx.dispose();
    await bCtx.dispose();
    await adminCtx.dispose();
  });
});
