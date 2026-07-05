import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';

const categories = [
  { name: 'Vegetables', slug: 'vegetables', sortOrder: 1 },
  { name: 'Fruits', slug: 'fruits', sortOrder: 2 },
  { name: 'Dairy', slug: 'dairy', sortOrder: 3 },
  { name: 'Grocery', slug: 'grocery', sortOrder: 4 },
  { name: 'Rice', slug: 'rice', sortOrder: 5 },
  { name: 'Flour', slug: 'flour', sortOrder: 6 },
  { name: 'Snacks', slug: 'snacks', sortOrder: 7 },
  { name: 'Drinks', slug: 'drinks', sortOrder: 8 },
  { name: 'Bakery', slug: 'bakery', sortOrder: 9 },
  { name: 'Household', slug: 'household', sortOrder: 10 },
  { name: 'Personal Care', slug: 'personal-care', sortOrder: 11 },
];

const products = [
  { name: 'Fresh Tomatoes', description: 'Farm-fresh red tomatoes', unit: '500 g', price: 30, stock: 50, category: 'vegetables', isFeatured: true },
  { name: 'Onions', description: 'Fresh medium onions', unit: '1 kg', price: 35, stock: 80, category: 'vegetables', isFeatured: true },
  { name: 'Potatoes', description: 'Fresh potatoes', unit: '1 kg', price: 28, stock: 70, category: 'vegetables' },
  { name: 'Bananas', description: 'Sweet ripe bananas', unit: '6 pcs', price: 45, stock: 40, category: 'fruits', isFeatured: true },
  { name: 'Apples', description: 'Crisp Kashmiri apples', unit: '4 pcs', price: 160, stock: 30, category: 'fruits' },
  { name: 'Amul Milk', description: 'Fresh toned milk', unit: '500 ml', price: 28, stock: 60, category: 'dairy', isFeatured: true },
  { name: 'Curd', description: 'Fresh homemade curd', unit: '400 g', price: 35, stock: 35, category: 'dairy' },
  { name: 'Basmati Rice', description: 'Premium basmati rice', unit: '1 kg', price: 120, stock: 45, category: 'rice', isFeatured: true },
  { name: 'Toor Dal', description: 'High quality toor dal', unit: '500 g', price: 85, stock: 38, category: 'grocery' },
  { name: 'Wheat Flour', description: 'Chakki fresh atta', unit: '1 kg', price: 48, stock: 55, category: 'flour' },
  { name: 'Lays Chips', description: 'Classic salted chips', unit: '52 g', price: 20, stock: 100, category: 'snacks' },
  { name: 'Coca Cola', description: 'Refreshing cola', unit: '750 ml', price: 40, stock: 50, category: 'drinks' },
  { name: 'Bread', description: 'Fresh white bread', unit: '400 g', price: 35, stock: 25, category: 'bakery' },
  { name: 'Detergent Powder', description: 'Laundry detergent', unit: '1 kg', price: 110, stock: 30, category: 'household' },
  { name: 'Toothpaste', description: 'Fresh mint toothpaste', unit: '150 g', price: 85, stock: 40, category: 'personal-care' },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gobaskit.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await hashPassword(adminPassword);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      name: 'Admin',
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash,
    },
  });

  // Remove legacy admin from before GoBaskit rename
  if (adminEmail !== 'admin@gobasket.com') {
    await prisma.admin.deleteMany({ where: { email: 'admin@gobasket.com' } });
  }

  const settings = [
    { key: 'store_name', value: 'GoBaskit' },
    { key: 'whatsapp_number', value: process.env.WHATSAPP_NUMBER || '919046370119' },
    { key: 'delivery_charge', value: process.env.DELIVERY_CHARGE || 'tiered' },
    { key: 'min_order_value', value: process.env.MIN_ORDER_VALUE || '100' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  const categoryMap: Record<string, string> = {};

  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder },
    });
    categoryMap[cat.slug] = created.id;
  }

  for (const p of products) {
    const categoryId = categoryMap[p.category];
    if (!categoryId) continue;

    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
        categoryId,
        isFeatured: p.isFeatured ?? false,
        status: 'ACTIVE',
      },
    });
  }

  console.log('Seed completed!');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
