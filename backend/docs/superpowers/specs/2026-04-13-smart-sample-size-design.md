# Smart Sample Size & Day-over-Day Consistency

## Problem
Hardcoded 400-visitor threshold is arbitrary. Shows "100% complete" after 2,176 visitors when statistically ~10,000 are needed. The exploration minimum (25-200 per variant) is based on CI width, not detectable effect size.

## Design

### 1. Auto-Calculated Sample Target
- **Formula:** `n = (Z_α + Z_β)² × [p₁(1-p₁) + p₂(1-p₂)] / (p₂ - p₁)²`
- **MDE:** 50% relative lift (universal, hardcoded)
- **Power:** 80%, **Significance:** 5% one-sided
- **Baseline rate:** observed purchase rate (orders/cart-opens) from last 7 days, or 3% default
- **Clamped:** min 500, max 20,000 per variant

### 2. Order-Based Minimum (NOT Visitors)
- **Minimum 25 orders per variant** before Thompson can declare winner
- Stepper step 1 becomes "Orders" showing `12/25 per variant`
- Visitors shown as secondary info text

### 3. Day-over-Day Consistency
- Track daily leader (which variant leads) in experiment `notes.dailyLeaders[]`
- `consistency = days_leading_variant_led / total_days`
- \>80%: normal. 60-80%: extend ×1.5. <60%: extend ×2.0
- Penalizes display confidence: `displayConfidence = rawConfidence × consistency`
- Shows mini daily dots in Impact step when volatile

### 4. Early Stop Rules
```
All three required to declare winner:
  1. orders_per_variant >= 25
  2. calendar_days >= 3
  3. consistency > 70%
Then Thompson decides via expected loss as usual.
```

### 5. Files Changed
- `thompson.ts` — new `calculateSampleTarget()`, `calculateConsistency()`
- `nightly/route.ts` — track daily leaders, store consistency
- `adaptive/route.ts` — same daily leader tracking
- `experiments/route.ts` — return sampleTarget, dailyLeaders, consistency
- `addons/page.tsx` — stepper: Orders replaces Visitors, consistency dots
