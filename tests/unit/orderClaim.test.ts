import {
  shouldClaimUnassignedPending,
  shouldUnlockStaffLock,
} from '@/lib/orderClaim';

describe('order claim from Pending', () => {
  it('claims when an unassigned Pending order moves to Accepted or later (not Cancelled)', () => {
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'PENDING',
        nextStatus: 'ACCEPTED',
        assignedStaffId: null,
      }),
    ).toBe(true);
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'PENDING',
        nextStatus: 'PACKED',
        assignedStaffId: null,
      }),
    ).toBe(true);
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'PENDING',
        nextStatus: 'CANCELLED',
        assignedStaffId: null,
      }),
    ).toBe(false);
  });

  it('does not steal an order that already has an assignee', () => {
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'PENDING',
        nextStatus: 'ACCEPTED',
        assignedStaffId: 'staff-1',
      }),
    ).toBe(false);
  });

  it('does not claim status-only edits or moves that stay Pending', () => {
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'PENDING',
        nextStatus: 'PENDING',
        assignedStaffId: null,
      }),
    ).toBe(false);
    expect(
      shouldClaimUnassignedPending({
        currentStatus: 'ACCEPTED',
        nextStatus: 'PACKED',
        assignedStaffId: null,
      }),
    ).toBe(false);
  });

  it('unlocks when the order is delivered or cancelled', () => {
    expect(shouldUnlockStaffLock('DELIVERED')).toBe(true);
    expect(shouldUnlockStaffLock('CANCELLED')).toBe(true);
    expect(shouldUnlockStaffLock('PACKED')).toBe(false);
    expect(shouldUnlockStaffLock(undefined)).toBe(false);
  });
});
