import { checkoutSchema } from '@/lib/validations';
import { deliveryAddressLineError } from '@/lib/deliveryAddress';

describe('delivery address lines', () => {
  it('accepts ordinary Indian house, street, and area', () => {
    expect(deliveryAddressLineError('12/A', 'house')).toBeNull();
    expect(deliveryAddressLineError('Qtr 4', 'house')).toBeNull();
    expect(deliveryAddressLineError('Station Road', 'street')).toBeNull();
    expect(deliveryAddressLineError('Lane 2', 'street')).toBeNull();
    expect(deliveryAddressLineError('Railway Colony', 'area')).toBeNull();
    expect(deliveryAddressLineError('Adra', 'area')).toBeNull();
    expect(deliveryAddressLineError('12/A', 'house')).toBeNull();
    expect(deliveryAddressLineError('subhas nagar', 'street')).toBeNull();
    expect(deliveryAddressLineError('adra', 'area')).toBeNull();
    expect(deliveryAddressLineError('mandir', 'landmark')).toBeNull();
  });

  it('rejects a saved Test / tets profile so that customer cannot place another order until they fix the address', () => {
    const parsed = checkoutSchema.safeParse({
      firstName: 'Sunahs',
      lastName: 'Kumar',
      mobile: '9876543210',
      houseNumber: 'Sunahs',
      street: 'Test',
      area: 'tets',
      city: 'Adra',
      state: 'West Bengal',
      pincode: '723121',
      landmark: '',
      deliveryNotes: '',
      paymentMethod: 'COD',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects placeholders and keyboard smash', () => {
    expect(deliveryAddressLineError('test', 'street')).toBeTruthy();
    expect(deliveryAddressLineError('asdf', 'area')).toBeTruthy();
    expect(deliveryAddressLineError('xxxx', 'house')).toBeTruthy();
    expect(deliveryAddressLineError('....', 'street')).toBeTruthy();
    expect(deliveryAddressLineError('aaa', 'area')).toBeTruthy();
    expect(deliveryAddressLineError('meow', 'area')).toBeTruthy();
    expect(deliveryAddressLineError('tets', 'street')).toBeTruthy();
  });

  it('rejects a checkout payload that copies junk into every line', () => {
    const parsed = checkoutSchema.safeParse({
      firstName: 'Ravi',
      lastName: 'Kumar',
      mobile: '9876543210',
      houseNumber: 'asdf',
      street: 'asdf',
      area: 'asdf',
      city: 'Adra',
      state: 'West Bengal',
      pincode: '723121',
      landmark: '',
      deliveryNotes: '',
      paymentMethod: 'COD',
    });
    expect(parsed.success).toBe(false);
  });

  it('allows short real Adra lines already used by customers', () => {
    expect(deliveryAddressLineError('Sbi', 'street')).toBeNull();
    expect(deliveryAddressLineError('DVC', 'area')).toBeNull();
    expect(deliveryAddressLineError('L 42', 'area')).toBeNull();
    expect(deliveryAddressLineError('Lower beniasol', 'house')).toBeNull();
    expect(deliveryAddressLineError('Church road', 'street')).toBeNull();
  });

  it('allows a village name repeated in house, street, and area', () => {
    const parsed = checkoutSchema.safeParse({
      firstName: 'Ravi',
      lastName: 'Kumar',
      mobile: '9876543210',
      houseNumber: 'Senera',
      street: 'Senera',
      area: 'Senera',
      city: 'Raghunathpur',
      state: 'West Bengal',
      pincode: '723121',
      landmark: '',
      deliveryNotes: '',
      paymentMethod: 'COD',
    });
    expect(parsed.success).toBe(true);
  });

  it('still accepts a complete real checkout address', () => {
    const parsed = checkoutSchema.safeParse({
      firstName: 'Ravi',
      lastName: 'Kumar',
      mobile: '9876543210',
      houseNumber: '10A',
      street: 'Main Road',
      area: 'Center',
      city: 'Adra',
      state: 'West Bengal',
      pincode: '723121',
      landmark: '',
      deliveryNotes: '',
      paymentMethod: 'COD',
    });
    expect(parsed.success).toBe(true);
  });
});
