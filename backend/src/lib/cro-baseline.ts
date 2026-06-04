export interface OrdersAgg {
  orderCount: number;
  totalRevenue: number; // major currency units
  currency: string;
}

export interface CroBaseline {
  capturedAt: string;   // ISO
  windowDays: 30;
  orders30d: number;
  revenue30d: number;
  aov: number;
  currency: string;
}

export function computeAov(totalRevenue: number, orderCount: number): number {
  if (!orderCount) return 0;
  return Math.round((totalRevenue / orderCount) * 100) / 100;
}

export function buildBaseline(agg: OrdersAgg, now: Date = new Date()): CroBaseline {
  return {
    capturedAt: now.toISOString(),
    windowDays: 30,
    orders30d: agg.orderCount,
    revenue30d: agg.totalRevenue,
    aov: computeAov(agg.totalRevenue, agg.orderCount),
    currency: agg.currency,
  };
}
