import { fulfillmentTicket, roundMoney } from '@/lib/shopSourcing';
import {
  coerceFulfillmentSource,
  type FulfillmentSource,
} from '@/lib/fulfillmentSource';

export type ProfitLineInput = {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  fulfillmentSource: FulfillmentSource | string;
  costPriceSnapshot: number | null;
  liveSource?: FulfillmentSource | string | null;
  liveCostPrice?: number | null;
  ticketSuffix: string | null;
  shopLineCost: number;
  shopCostConfirmed: boolean;
};

export type ProfitTicketInput = {
  suffix: string;
  costToGobaskit: number;
  costConfirmed: boolean;
};

export type ProfitLineResult = {
  id: string;
  productName: string;
  quantity: number;
  selling: number;
  source: FulfillmentSource;
  sourceFrozen: boolean;
  inHouseCogs: number | null;
  missingInHouseCost: boolean;
  shopLineCost: number;
  shopCostOnInHouse: number;
};

export type ProfitTicketResult = {
  suffix: string;
  ticket: string;
  itemCount: number;
  outsourceCount: number;
  inHouseCount: number;
  untaggedCount: number;
  outsourceSelling: number;
  inHouseSelling: number;
  paidToShops: number;
  pendingShopCost: number;
  inHouseCogs: number;
  shopCostOnInHouse: number;
};

export type ProfitOrderResult = {
  id: string;
  orderNumber: string;
  createdAt: string;
  deliveryCharge: number;
  customerPaid: number;
  outsourceSelling: number;
  inHouseSelling: number;
  untaggedSelling: number;
  untaggedCount: number;
  paidToShops: number;
  pendingShopCost: number;
  inHouseCogs: number;
  paidToGobaskitGrocery: number;
  shopCostOnInHouse: number;
  missingInHouseCostCount: number;
  outsourceProfit: number;
  inHouseProfit: number;
  tickets: ProfitTicketResult[];
  lines: ProfitLineResult[];
};

function resolveSource(line: ProfitLineInput): { source: FulfillmentSource; frozen: boolean } {
  const snap = coerceFulfillmentSource(line.fulfillmentSource);
  if (snap !== 'UNSET') return { source: snap, frozen: true };
  const live = coerceFulfillmentSource(line.liveSource);
  return { source: live, frozen: false };
}

function resolveInHouseUnitCost(line: ProfitLineInput): number | null {
  if (line.costPriceSnapshot != null && Number.isFinite(line.costPriceSnapshot) && line.costPriceSnapshot >= 0) {
    return roundMoney(line.costPriceSnapshot);
  }
  if (line.liveCostPrice != null && Number.isFinite(line.liveCostPrice) && line.liveCostPrice >= 0) {
    return roundMoney(line.liveCostPrice);
  }
  return null;
}

function allocateTicketFallback(
  ticketLines: ProfitLineInput[],
  ticketCost: number,
): Map<string, number> {
  const allocated = new Map<string, number>();
  const hasLineCosts = ticketLines.some((line) => line.shopLineCost > 0);
  if (hasLineCosts || ticketCost <= 0) {
    for (const line of ticketLines) allocated.set(line.id, roundMoney(line.shopLineCost));
    return allocated;
  }
  const qty = ticketLines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
  if (qty <= 0) {
    const each = roundMoney(ticketCost / ticketLines.length);
    for (const line of ticketLines) allocated.set(line.id, each);
    return allocated;
  }
  let remaining = roundMoney(ticketCost);
  ticketLines.forEach((line, index) => {
    const share =
      index === ticketLines.length - 1
        ? remaining
        : roundMoney((ticketCost * line.quantity) / qty);
    allocated.set(line.id, share);
    remaining = roundMoney(remaining - share);
  });
  return allocated;
}

export function computeOrderProfit(params: {
  id: string;
  orderNumber: string;
  createdAt: Date | string;
  grandTotal: number;
  deliveryCharge: number;
  lines: ProfitLineInput[];
  tickets: ProfitTicketInput[];
}): ProfitOrderResult {
  const deliveryCharge = roundMoney(Number(params.deliveryCharge) || 0);
  const ticketBySuffix = new Map(params.tickets.map((t) => [t.suffix, t]));
  const linesByTicket = new Map<string | null, ProfitLineInput[]>();
  for (const line of params.lines) {
    const key = line.ticketSuffix;
    const list = linesByTicket.get(key) ?? [];
    list.push(line);
    linesByTicket.set(key, list);
  }

  const shopAlloc = new Map<string, number>();
  for (const [suffix, ticketLines] of linesByTicket) {
    if (!suffix) {
      for (const line of ticketLines) shopAlloc.set(line.id, roundMoney(line.shopLineCost));
      continue;
    }
    const ticket = ticketBySuffix.get(suffix);
    const map = allocateTicketFallback(ticketLines, Number(ticket?.costToGobaskit) || 0);
    for (const [id, cost] of map) shopAlloc.set(id, cost);
  }

  const lineResults: ProfitLineResult[] = params.lines.map((line) => {
    const { source, frozen } = resolveSource(line);
    const selling = roundMoney(Number(line.totalPrice) || 0);
    const unitCost = resolveInHouseUnitCost(line);
    const missingInHouseCost = source === 'IN_HOUSE' && unitCost == null;
    const inHouseCogs =
      source === 'IN_HOUSE' && unitCost != null ? roundMoney(unitCost * Math.max(0, line.quantity)) : null;
    const shopLineCost = shopAlloc.get(line.id) ?? roundMoney(line.shopLineCost);
    return {
      id: line.id,
      productName: line.productName,
      quantity: line.quantity,
      selling,
      source,
      sourceFrozen: frozen,
      inHouseCogs,
      missingInHouseCost,
      shopLineCost,
      shopCostOnInHouse: source === 'IN_HOUSE' ? shopLineCost : 0,
    };
  });

  const lineById = new Map(lineResults.map((line) => [line.id, line]));

  const tickets: ProfitTicketResult[] = params.tickets.map((ticket) => {
    const ticketLines = params.lines.filter((line) => line.ticketSuffix === ticket.suffix);
    let outsourceCount = 0;
    let inHouseCount = 0;
    let untaggedCount = 0;
    let outsourceSelling = 0;
    let inHouseSelling = 0;
    let paidToShops = 0;
    let pendingShopCost = 0;
    let inHouseCogs = 0;
    let shopCostOnInHouse = 0;
    for (const raw of ticketLines) {
      const line = lineById.get(raw.id)!;
      if (line.source === 'OUTSOURCE') {
        outsourceCount += raw.quantity;
        outsourceSelling += line.selling;
        if (ticket.costConfirmed) paidToShops += line.shopLineCost;
        else pendingShopCost += line.shopLineCost;
      } else if (line.source === 'IN_HOUSE') {
        inHouseCount += raw.quantity;
        shopCostOnInHouse += line.shopCostOnInHouse;
        if (!line.missingInHouseCost) {
          inHouseSelling += line.selling;
          inHouseCogs += line.inHouseCogs ?? 0;
        }
      } else {
        untaggedCount += raw.quantity;
      }
    }
    return {
      suffix: ticket.suffix,
      ticket: fulfillmentTicket(params.orderNumber, ticket.suffix),
      itemCount: ticketLines.reduce((sum, line) => sum + line.quantity, 0),
      outsourceCount,
      inHouseCount,
      untaggedCount,
      outsourceSelling: roundMoney(outsourceSelling),
      inHouseSelling: roundMoney(inHouseSelling),
      paidToShops: roundMoney(paidToShops),
      pendingShopCost: roundMoney(pendingShopCost),
      inHouseCogs: roundMoney(inHouseCogs),
      shopCostOnInHouse: roundMoney(shopCostOnInHouse),
    };
  });

  let outsourceSelling = 0;
  let inHouseSelling = 0;
  let untaggedSelling = 0;
  let untaggedCount = 0;
  let paidToShops = 0;
  let pendingShopCost = 0;
  let inHouseCogs = 0;
  let shopCostOnInHouse = 0;
  let missingInHouseCostCount = 0;

  for (const raw of params.lines) {
    const line = lineById.get(raw.id)!;
    const confirmed = raw.ticketSuffix
      ? Boolean(ticketBySuffix.get(raw.ticketSuffix)?.costConfirmed)
      : raw.shopCostConfirmed;
    if (line.source === 'OUTSOURCE') {
      outsourceSelling += line.selling;
      if (confirmed) paidToShops += line.shopLineCost;
      else pendingShopCost += line.shopLineCost;
    } else if (line.source === 'IN_HOUSE') {
      if (line.missingInHouseCost) missingInHouseCostCount += 1;
      else {
        inHouseSelling += line.selling;
        inHouseCogs += line.inHouseCogs ?? 0;
      }
      shopCostOnInHouse += line.shopCostOnInHouse;
    } else {
      untaggedSelling += line.selling;
      untaggedCount += raw.quantity;
    }
  }

  outsourceSelling = roundMoney(outsourceSelling);
  inHouseSelling = roundMoney(inHouseSelling);
  untaggedSelling = roundMoney(untaggedSelling);
  paidToShops = roundMoney(paidToShops);
  pendingShopCost = roundMoney(pendingShopCost);
  inHouseCogs = roundMoney(inHouseCogs);
  shopCostOnInHouse = roundMoney(shopCostOnInHouse);

  const outsourceProfit = roundMoney(outsourceSelling - paidToShops);
  const inHouseProfit = roundMoney(inHouseSelling - inHouseCogs);

  return {
    id: params.id,
    orderNumber: params.orderNumber,
    createdAt: typeof params.createdAt === 'string' ? params.createdAt : params.createdAt.toISOString(),
    deliveryCharge,
    customerPaid: roundMoney(Number(params.grandTotal) || 0),
    outsourceSelling,
    inHouseSelling,
    untaggedSelling,
    untaggedCount,
    paidToShops,
    pendingShopCost,
    inHouseCogs,
    paidToGobaskitGrocery: inHouseCogs,
    shopCostOnInHouse,
    missingInHouseCostCount,
    outsourceProfit,
    inHouseProfit,
    tickets,
    lines: lineResults,
  };
}

export function withDeliveryProfit(row: ProfitOrderResult, includeDelivery: boolean) {
  const paidToGobaskit = roundMoney(row.paidToGobaskitGrocery + (includeDelivery ? row.deliveryCharge : 0));
  const totalProfit = roundMoney(
    row.outsourceProfit + row.inHouseProfit + (includeDelivery ? row.deliveryCharge : 0),
  );
  return { paidToGobaskit, totalProfit };
}
