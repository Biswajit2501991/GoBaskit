#!/usr/bin/env tsx
import { OrderArchiveService } from '../services/OrderArchiveService';

async function main() {
  const result = await OrderArchiveService.purgeExpiredOrders();
  console.log(
    `[purge-archived-orders] purged ${result.purgedOrders} order(s), ${result.purgedNotices} notice(s)`,
  );
}

main()
  .catch((err) => {
    console.error('[purge-archived-orders] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  });
