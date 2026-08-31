#!/usr/bin/env tsx
import { UnassignedOrderReminderService } from '../services/UnassignedOrderReminderService';

async function main() {
  const result = await UnassignedOrderReminderService.remindDue();
  console.log(
    `[unassigned-order-reminders] scanned ${result.scanned}, reminded ${result.reminded}`,
  );
}

main()
  .catch((err) => {
    console.error('[unassigned-order-reminders] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  });
