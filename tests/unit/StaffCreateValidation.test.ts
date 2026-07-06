import { staffCreateSchema } from '@/lib/validations';
import { STAFF_ROLES } from '@/types/staff';

const basePayload = {
  name: 'Test User',
  mobile: '9876543210',
  password: 'secret1',
  active: true,
  assignedAreas: [] as string[],
  latitude: null,
  longitude: null,
  deliveryRadius: null,
};

describe('staffCreateSchema', () => {
  it.each(STAFF_ROLES.map((role) => [role]))(
    'accepts role %s with optional fields empty',
    (role) => {
      const result = staffCreateSchema.safeParse({ ...basePayload, role, email: '' });
      expect(result.success).toBe(true);
    }
  );

  it('rejects invalid optional email', () => {
    const result = staffCreateSchema.safeParse({
      ...basePayload,
      role: 'ORDER_MANAGER',
      email: '7899813212',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid optional email', () => {
    const result = staffCreateSchema.safeParse({
      ...basePayload,
      role: 'ORDER_MANAGER',
      email: 'staff@gobaskit.com',
    });
    expect(result.success).toBe(true);
  });

  it('coerces empty latitude strings to null', () => {
    const result = staffCreateSchema.safeParse({
      ...basePayload,
      role: 'DELIVERY_MANAGER',
      latitude: '',
      longitude: '',
      deliveryRadius: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBeNull();
      expect(result.data.longitude).toBeNull();
      expect(result.data.deliveryRadius).toBeNull();
    }
  });
});
