import { composeOrderItemName, formatCartLineName, formatOrderItemsSummary } from '@/utils/orderItemName';

describe('composeOrderItemName', () => {
  it('keeps the full product name instead of the first word', () => {
    expect(
      composeOrderItemName({
        productName: 'Amul Taaza Homogenised Milk 1L',
        clientName: 'Amul',
      }),
    ).toBe('Amul Taaza Homogenised Milk 1L');
  });

  it('joins parent product and option so similar brands stay distinct', () => {
    expect(
      composeOrderItemName({
        productName: 'Sunflower Oil',
        variantLabel: 'Fortune 1L',
      }),
    ).toBe('Sunflower Oil — Fortune 1L');
    expect(
      composeOrderItemName({
        productName: 'Sunflower Oil',
        variantLabel: 'Saffola 1L',
      }),
    ).toBe('Sunflower Oil — Saffola 1L');
  });

  it('does not duplicate when the client already sent the full line', () => {
    expect(
      composeOrderItemName({
        productName: 'Sunflower Oil',
        variantLabel: 'Fortune 1L',
        clientName: 'Sunflower Oil — Fortune 1L',
      }),
    ).toBe('Sunflower Oil — Fortune 1L');
  });

  it('prefers a longer client name when catalog is shorter', () => {
    expect(
      composeOrderItemName({
        productName: 'Amul',
        clientName: 'Amul Gold Full Cream Milk 1L',
      }),
    ).toBe('Amul Gold Full Cream Milk 1L');
  });
});

describe('formatCartLineName', () => {
  it('appends the variant label for WhatsApp and cart lines', () => {
    expect(
      formatCartLineName({
        name: 'Atta',
        variantLabel: 'Aashirvaad 5kg',
      }),
    ).toBe('Atta — Aashirvaad 5kg');
  });
});

describe('formatOrderItemsSummary', () => {
  it('lists every item with its full name and quantity', () => {
    expect(
      formatOrderItemsSummary([
        { name: 'Amul Taaza Homogenised Milk 1L', quantity: 2 },
        { name: 'Amul Gold Full Cream Milk 1L', quantity: 1 },
      ]),
    ).toBe('Amul Taaza Homogenised Milk 1L × 2\nAmul Gold Full Cream Milk 1L × 1');
  });
});
