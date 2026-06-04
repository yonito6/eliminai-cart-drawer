export interface CroSnapshot {
  aov: number | null;
  checkoutRate: number | null;
}

export interface LiftValue {
  absolute: number;
  percent: number | null;
}

export interface CroLift {
  aov: LiftValue;
  checkoutRate: LiftValue;
}

function lift(base: number | null, curr: number | null): LiftValue {
  // No current measurement yet → show no movement, not a -100% crash.
  if (curr == null) return { absolute: 0, percent: null };
  const b = base ?? 0;
  const absolute = Math.round((curr - b) * 100000) / 100000;
  const percent = b === 0 ? null : Math.round(((curr - b) / b) * 100 * 100) / 100;
  return { absolute, percent };
}

export function computeLift(baseline: CroSnapshot, current: CroSnapshot): CroLift {
  return {
    aov: lift(baseline.aov, current.aov),
    checkoutRate: lift(baseline.checkoutRate, current.checkoutRate),
  };
}
