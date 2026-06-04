export interface DailyConversionRow {
  date: Date | string;
  uniqueVisitors: number;
  ordersCompleted: number;
}
export interface ConversionPoint { date: string; conversion: number }
export interface ConversionWindow { conversion: number; visitors: number; orders: number }

function dayKey(d: Date | string): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
function frac(orders: number, visitors: number): number {
  return visitors > 0 ? Math.round((orders / visitors) * 1e6) / 1e6 : 0;
}

/** One sorted point per day. Conversion is ordersCompleted / uniqueVisitors. */
export function buildConversionSeries(rows: DailyConversionRow[]): ConversionPoint[] {
  return [...rows]
    .map(r => ({ key: dayKey(r.date), v: r.uniqueVisitors ?? 0, o: r.ordersCompleted ?? 0 }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(r => ({ date: r.key, conversion: frac(r.o, r.v) }));
}

/** Earliest `windowDays` distinct days vs latest `windowDays`. Window rolls forward intentionally. */
export function windowConversion(
  rows: DailyConversionRow[],
  windowDays = 7,
): { before: ConversionWindow; now: ConversionWindow } {
  const byDay = new Map<string, { v: number; o: number }>();
  for (const r of rows) {
    const k = dayKey(r.date);
    const cur = byDay.get(k) ?? { v: 0, o: 0 };
    cur.v += r.uniqueVisitors ?? 0;
    cur.o += r.ordersCompleted ?? 0;
    byDay.set(k, cur);
  }
  const days = Array.from(byDay.keys()).sort();
  const agg = (keys: string[]): ConversionWindow => {
    let v = 0, o = 0;
    for (const k of keys) { const d = byDay.get(k)!; v += d.v; o += d.o; }
    return { conversion: frac(o, v), visitors: v, orders: o };
  };
  return {
    before: agg(days.slice(0, windowDays)),
    now: agg(days.slice(-windowDays)),
  };
}
