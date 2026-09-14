import { computeOrderProfit, withDeliveryProfit } from '@/lib/profitDashboard';

describe('computeOrderProfit', () => {
  it('splits a mixed ticket using shop line costs and catalog in-house cost', () => {
    const row = computeOrderProfit({
      id: 'o1',
      orderNumber: 'ABCD001',
      createdAt: '2026-09-14T00:00:00.000Z',
      grandTotal: 300,
      deliveryCharge: 20,
      tickets: [{ suffix: 'A', costToGobaskit: 200, costConfirmed: true }],
      lines: [
        {
          id: '1',
          productName: 'Out 1',
          quantity: 1,
          totalPrice: 60,
          fulfillmentSource: 'OUTSOURCE',
          costPriceSnapshot: null,
          ticketSuffix: 'A',
          shopLineCost: 50,
          shopCostConfirmed: true,
        },
        {
          id: '2',
          productName: 'Out 2',
          quantity: 1,
          totalPrice: 60,
          fulfillmentSource: 'OUTSOURCE',
          costPriceSnapshot: null,
          ticketSuffix: 'A',
          shopLineCost: 50,
          shopCostConfirmed: true,
        },
        {
          id: '3',
          productName: 'In 1',
          quantity: 1,
          totalPrice: 55,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: 50,
          ticketSuffix: 'A',
          shopLineCost: 50,
          shopCostConfirmed: true,
        },
        {
          id: '4',
          productName: 'In 2',
          quantity: 1,
          totalPrice: 55,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: 50,
          ticketSuffix: 'A',
          shopLineCost: 50,
          shopCostConfirmed: true,
        },
      ],
    });

    expect(row.tickets[0].outsourceCount).toBe(2);
    expect(row.tickets[0].inHouseCount).toBe(2);
    expect(row.paidToShops).toBe(100);
    expect(row.inHouseCogs).toBe(100);
    expect(row.outsourceProfit).toBe(20);
    expect(row.inHouseProfit).toBe(10);
    expect(row.shopCostOnInHouse).toBe(100);
    expect(withDeliveryProfit(row, true).totalProfit).toBe(50);
    expect(withDeliveryProfit(row, false).totalProfit).toBe(30);
    expect(withDeliveryProfit(row, true).paidToGobaskit).toBe(120);
  });

  it('allocates a ticket total across lines when item costs are still 0', () => {
    const row = computeOrderProfit({
      id: 'o2',
      orderNumber: 'ABCD001',
      createdAt: '2026-09-14T00:00:00.000Z',
      grandTotal: 400,
      deliveryCharge: 0,
      tickets: [{ suffix: 'B', costToGobaskit: 300, costConfirmed: true }],
      lines: [
        {
          id: 'a',
          productName: 'O1',
          quantity: 1,
          totalPrice: 70,
          fulfillmentSource: 'OUTSOURCE',
          costPriceSnapshot: null,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
        {
          id: 'b',
          productName: 'O2',
          quantity: 1,
          totalPrice: 70,
          fulfillmentSource: 'OUTSOURCE',
          costPriceSnapshot: null,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
        {
          id: 'c',
          productName: 'O3',
          quantity: 1,
          totalPrice: 70,
          fulfillmentSource: 'OUTSOURCE',
          costPriceSnapshot: null,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
        {
          id: 'd',
          productName: 'I1',
          quantity: 1,
          totalPrice: 50,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: 40,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
        {
          id: 'e',
          productName: 'I2',
          quantity: 1,
          totalPrice: 50,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: 40,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
        {
          id: 'f',
          productName: 'I3',
          quantity: 1,
          totalPrice: 50,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: 40,
          ticketSuffix: 'B',
          shopLineCost: 0,
          shopCostConfirmed: true,
        },
      ],
    });

    expect(row.paidToShops).toBe(150);
    expect(row.inHouseCogs).toBe(120);
    expect(row.outsourceProfit).toBe(60);
    expect(row.inHouseProfit).toBe(30);
  });

  it('keeps untagged selling out of profit and pending shop cost out of paid-to-shops', () => {
    const row = computeOrderProfit({
      id: 'o3',
      orderNumber: 'GB1',
      createdAt: '2026-09-14T00:00:00.000Z',
      grandTotal: 100,
      deliveryCharge: 10,
      tickets: [{ suffix: 'A', costToGobaskit: 40, costConfirmed: false }],
      lines: [
        {
          id: 'u',
          productName: 'Unknown',
          quantity: 2,
          totalPrice: 80,
          fulfillmentSource: 'UNSET',
          costPriceSnapshot: null,
          ticketSuffix: 'A',
          shopLineCost: 40,
          shopCostConfirmed: false,
        },
      ],
    });
    expect(row.untaggedCount).toBe(2);
    expect(row.untaggedSelling).toBe(80);
    expect(row.paidToShops).toBe(0);
    expect(row.pendingShopCost).toBe(0);
    expect(row.outsourceProfit).toBe(0);
  });

  it('flags in-house lines without a cost price', () => {
    const row = computeOrderProfit({
      id: 'o4',
      orderNumber: 'GB2',
      createdAt: '2026-09-14T00:00:00.000Z',
      grandTotal: 50,
      deliveryCharge: 0,
      tickets: [],
      lines: [
        {
          id: 'h',
          productName: 'House',
          quantity: 1,
          totalPrice: 50,
          fulfillmentSource: 'IN_HOUSE',
          costPriceSnapshot: null,
          ticketSuffix: null,
          shopLineCost: 0,
          shopCostConfirmed: false,
        },
      ],
    });
    expect(row.missingInHouseCostCount).toBe(1);
    expect(row.inHouseCogs).toBe(0);
    expect(row.inHouseProfit).toBe(0);
    expect(row.inHouseSelling).toBe(0);
  });

  it('uses a live catalog tag when the order line snapshot is UNSET', () => {
    const row = computeOrderProfit({
      id: 'o5',
      orderNumber: 'GB3',
      createdAt: '2026-09-14T00:00:00.000Z',
      grandTotal: 90,
      deliveryCharge: 0,
      tickets: [{ suffix: 'A', costToGobaskit: 30, costConfirmed: true }],
      lines: [
        {
          id: 'x',
          productName: 'Old',
          quantity: 1,
          totalPrice: 90,
          fulfillmentSource: 'UNSET',
          costPriceSnapshot: null,
          liveSource: 'OUTSOURCE',
          liveCostPrice: null,
          ticketSuffix: 'A',
          shopLineCost: 30,
          shopCostConfirmed: true,
        },
      ],
    });
    expect(row.lines[0].source).toBe('OUTSOURCE');
    expect(row.lines[0].sourceFrozen).toBe(false);
    expect(row.paidToShops).toBe(30);
    expect(row.outsourceProfit).toBe(60);
  });
});
