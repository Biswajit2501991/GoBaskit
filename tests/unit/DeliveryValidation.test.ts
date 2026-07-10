import {
  cityForPin,
  cityIsServiceable,
  deliveryIsServiceable,
  normalizeLocationToken,
  pinForCity,
  pinIsServiceable,
} from '@/utils/delivery';

describe('delivery validation', () => {
  const pins = ['723131', '3064'];
  const cities = ['Kolkata', 'Craigieburn'];
  const aliases = { craigieburn: ['craigie burn', 'Craigie Burn'] };

  it('matches pincode exactly', () => {
    expect(pinIsServiceable(pins, '723131')).toBe(true);
    expect(pinIsServiceable(pins, '999999')).toBe(false);
  });

  it('matches city case-insensitively', () => {
    expect(cityIsServiceable(cities, 'kolkata')).toBe(true);
    expect(cityIsServiceable(cities, 'CRAIGIEBURN')).toBe(true);
    expect(cityIsServiceable(cities, 'Sydney')).toBe(false);
  });

  it('supports alternate spellings via aliases', () => {
    expect(cityIsServiceable(cities, 'craigie burn', aliases)).toBe(true);
  });

  it('allows delivery when city OR pincode matches', () => {
    expect(
      deliveryIsServiceable({
        serviceablePins: pins,
        serviceableCities: cities,
        city: 'Craigieburn',
        pincode: '',
        cityAliases: aliases,
      }),
    ).toBe(true);

    expect(
      deliveryIsServiceable({
        serviceablePins: pins,
        serviceableCities: cities,
        city: 'Unknown',
        pincode: '3064',
      }),
    ).toBe(true);

    expect(
      deliveryIsServiceable({
        serviceablePins: pins,
        serviceableCities: cities,
        city: 'Unknown',
        pincode: '',
      }),
    ).toBe(false);
  });

  it('normalizes spaces in city names', () => {
    expect(normalizeLocationToken(' Craigie  Burn ')).toBe('craigieburn');
  });

  it('maps serviceable PIN to city (Adra single-city / pinCityMap)', () => {
    const adraPins = ['723131', '723132', '723133', '723121'];
    expect(
      cityForPin({
        pin: '723131',
        serviceablePins: adraPins,
        serviceableCities: ['Adra'],
      }),
    ).toBe('Adra');

    expect(
      cityForPin({
        pin: '723131',
        serviceablePins: adraPins,
        serviceableCities: ['Adra', 'Kolkata'],
        pinCityMap: { '723131': 'Adra' },
      }),
    ).toBe('Adra');

    expect(
      cityForPin({
        pin: '999999',
        serviceablePins: adraPins,
        serviceableCities: ['Adra'],
      }),
    ).toBeNull();
  });

  it('maps serviceable city to default PIN (Adra → 723121)', () => {
    const adraPins = ['723131', '723132', '723133', '723121'];
    expect(
      pinForCity({
        city: 'Adra',
        serviceablePins: adraPins,
        serviceableCities: ['Adra'],
      }),
    ).toBe('723121');

    expect(
      pinForCity({
        city: 'Adra',
        serviceablePins: adraPins,
        serviceableCities: ['Adra', 'Kolkata'],
        cityDefaultPins: { Adra: '723121' },
      }),
    ).toBe('723121');
  });
});
