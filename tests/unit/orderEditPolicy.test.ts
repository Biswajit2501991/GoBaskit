import {
  canCustomerMutate,
  canStaffMutateItems,
  customerEditDenialMessage,
  customerEditExpiresAt,
  CUSTOMER_ORDER_EDIT_WINDOW_MS,
  isItemEditableStatus,
  staffItemEditDenialMessage,
} from '@/utils/orderEditPolicy';

const createdAt = new Date('2026-08-30T10:00:00.000Z');

describe('orderEditPolicy', () => {
  it('expires 10 minutes after createdAt', () => {
    expect(customerEditExpiresAt(createdAt).getTime() - createdAt.getTime()).toBe(
      CUSTOMER_ORDER_EDIT_WINDOW_MS,
    );
  });

  it('lets the customer edit PENDING orders inside the window', () => {
    const now = new Date(createdAt.getTime() + 9 * 60 * 1000);
    expect(canCustomerMutate({ status: 'PENDING', createdAt }, now)).toBe(true);
    expect(canCustomerMutate({ status: 'ACCEPTED', createdAt }, now)).toBe(true);
  });

  it('locks the customer after 10 minutes', () => {
    const now = new Date(createdAt.getTime() + 10 * 60 * 1000);
    expect(canCustomerMutate({ status: 'PENDING', createdAt }, now)).toBe(false);
    expect(customerEditDenialMessage({ status: 'PENDING', createdAt }, now)).toMatch(/10-minute/i);
  });

  it('locks the customer as soon as the order is packed', () => {
    const now = new Date(createdAt.getTime() + 2 * 60 * 1000);
    expect(canCustomerMutate({ status: 'PACKED', createdAt }, now)).toBe(false);
    expect(canCustomerMutate({ status: 'OUT_FOR_DELIVERY', createdAt }, now)).toBe(false);
    expect(customerEditDenialMessage({ status: 'PACKED', createdAt }, now)).toMatch(/prepared/i);
  });

  it('does not treat archived orders as editable', () => {
    expect(
      canCustomerMutate({ status: 'PENDING', createdAt, archivedAt: new Date() }, createdAt),
    ).toBe(false);
    expect(canStaffMutateItems({ status: 'PENDING', createdAt, archivedAt: new Date() })).toBe(
      false,
    );
  });

  it('lets staff change items only while PENDING or ACCEPTED', () => {
    expect(isItemEditableStatus('PENDING')).toBe(true);
    expect(canStaffMutateItems({ status: 'ACCEPTED', createdAt })).toBe(true);
    expect(canStaffMutateItems({ status: 'PACKED', createdAt })).toBe(false);
    expect(staffItemEditDenialMessage({ status: 'PACKED', createdAt })).toMatch(/packed/i);
  });
});
