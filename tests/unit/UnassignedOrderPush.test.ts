import { orderCapableStaffIds } from '@/services/StaffAssignmentService';
import { isUnassignedReminderDue } from '@/services/UnassignedOrderReminderService';
import { UNASSIGNED_PUSH_REMINDER_MAX } from '@/constants/orders';

describe('orderCapableStaffIds', () => {
  it('includes every role that can view orders', () => {
    const ids = orderCapableStaffIds([
      { id: 'a', role: 'ALL_SUPER_ADMIN', permissions: [] },
      { id: 'b', role: 'DELIVERY_MANAGER', permissions: [] },
      { id: 'c', role: 'CUSTOMER_SUPPORT', permissions: [] },
      { id: 'd', role: 'FINANCE', permissions: [] },
      { id: 'e', role: 'READ_ONLY', permissions: [] },
      { id: 'f', role: 'INVENTORY_MANAGER', permissions: [] },
      { id: 'g', role: 'MARKETING', permissions: [] },
      { id: 'h', role: 'CUSTOM', permissions: ['orders:view'] },
    ]);
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'h']);
  });

  it('excludes CUSTOM without orders:view', () => {
    expect(orderCapableStaffIds([{ id: 'x', role: 'CUSTOM', permissions: ['products:view'] }])).toEqual(
      [],
    );
  });
});

describe('isUnassignedReminderDue', () => {
  const now = Date.parse('2026-08-31T10:00:00.000Z');
  const base = {
    id: 'o1',
    assignedStaffId: null as string | null,
    archivedAt: null as Date | null,
    status: 'PENDING',
    createdAt: new Date(now - 15 * 60 * 1000),
    unassignedPushReminders: 0,
    lastUnassignedPushAt: new Date(now - 15 * 60 * 1000),
  };

  it('is not due in the first 10 minutes', () => {
    expect(
      isUnassignedReminderDue(
        {
          ...base,
          createdAt: new Date(now - 5 * 60 * 1000),
          lastUnassignedPushAt: new Date(now - 5 * 60 * 1000),
        },
        now,
      ),
    ).toBe(false);
  });

  it('is not due when recently pushed', () => {
    expect(
      isUnassignedReminderDue({ ...base, lastUnassignedPushAt: new Date(now - 2 * 60 * 1000) }, now),
    ).toBe(false);
  });

  it('is not due after assignment', () => {
    expect(isUnassignedReminderDue({ ...base, assignedStaffId: 'staff-1' }, now)).toBe(false);
  });

  it('stops after the reminder cap', () => {
    expect(
      isUnassignedReminderDue({ ...base, unassignedPushReminders: UNASSIGNED_PUSH_REMINDER_MAX }, now),
    ).toBe(false);
  });

  it('skips delivered and cancelled', () => {
    expect(isUnassignedReminderDue({ ...base, status: 'DELIVERED' }, now)).toBe(false);
    expect(isUnassignedReminderDue({ ...base, status: 'CANCELLED' }, now)).toBe(false);
  });
});
