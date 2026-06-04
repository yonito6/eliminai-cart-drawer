import type { ConversionWindow } from './cro-conversion';

export interface ValueInput {
  before: ConversionWindow;
  now: ConversionWindow;
  visitors: number;        // visitors over the comparison period
  ordersNow: number;       // existing order base for the period
  aovBefore: number | null;
  aovNow: number | null;
  winsBanked: number;
}
export interface CartValue {
  extraOrders: number;
  extraRevenue: number;
  aovLift: number;
  convLift: number;        // percentage points
  winsBanked: number;
}

const floor0 = (n: number) => (n > 0 ? n : 0);

export function computeValue(i: ValueInput): CartValue {
  const aovNow = i.aovNow ?? 0;
  const convDelta = i.now.conversion - i.before.conversion;            // fraction
  const extraOrders = Math.round(floor0(i.visitors * convDelta));

  // If aovBefore is null, no baseline = zero AOV lift contribution
  let aovLift = 0;
  if (i.aovBefore !== null) {
    aovLift = floor0(Math.round((aovNow - i.aovBefore) * 100) / 100);
  }

  // LOCKED interpretation (spec): extra orders at today's AOV + AOV-lift across existing base.
  const extraRevenue = Math.round(floor0(extraOrders * aovNow + i.ordersNow * aovLift) * 100) / 100;
  const convLift = floor0(Math.round(convDelta * 100 * 10000) / 10000);  // percentage points
  return { extraOrders, extraRevenue, aovLift, convLift, winsBanked: i.winsBanked };
}
