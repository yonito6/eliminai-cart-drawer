# Analytics Page Redesign — Momentum Dashboard

**Date:** 2026-06-04
**Status:** Approved design, ready for planning
**Surface:** `backend/src/app/dashboard/analytics/page.tsx` + `backend/src/app/api/stores/[id]/cro/route.ts`

## Goal

Replace the current basic Analytics page (two stat cards + activity list) with a **motivation-first "momentum dashboard"** that immediately shows the merchant the concrete dollar value the cart has generated versus their old cart, how that value is growing, and what the autopilot will test next — including new research-backed tactics they can activate.

## Why

The current page shows AOV + a buggy "Cart Checkout Rate" (renders ~156% because `baselineCheckoutRate` is stored >1). It is neither clear nor motivating. The merchant (non-technical store owner) asked for: concrete before/now numbers for **revenue, orders, AOV, and conversion**, graphs showing ongoing improvement, the upcoming testing roadmap, and new data-backed ideas to test — all framed to motivate.

## Data Feasibility (verified against production, read-only)

DailySummary has 23 distinct days (2026-04-09 → present). Populated: `uniqueVisitors` (18,402 total), `ordersCompleted` (176), `cartOpens` (1157), `checkoutClicks` (644). **Dead fields:** `totalRevenue` = 0, `checkoutStarts` = 0.

Consequences:
- Purchase-conversion time-series (ordersCompleted / uniqueVisitors): **feasible** — drives the trend graph.
- AOV before/now: **feasible** from Shopify Orders (`fetchOrders30d`) + `config.cro.baseline`.
- AOV-over-time line graph: **NOT feasible** (revenue=0 in rollups) — AOV stays as before/now cards. Deferred.

## Components

### 1. Value Scoreboard (hero) — the headline ask

Leads with one concrete number: **"We generated you +$X in extra revenue vs. your old cart (last 30 days)."** Below it, four delta tiles: **+N more orders · +$Y higher AOV · +Z pp conversion · W wins banked.** Plus a "+$… this week, accelerating" momentum pill.

**Incremental-value formulas** (all from real data, labelled "estimated"):
- `convNow` = recent rolling window conversion = Σ ordersCompleted / Σ uniqueVisitors (last 7 days with data).
- `convBefore` = earliest 7 days of DailySummary conversion (the data-derived baseline; not frozen — the window rolls forward as data accumulates, so the story keeps growing).
- `aovNow` = `computeAov(fetchOrders30d)`. `aovBefore` = `config.cro.baseline.aov`.
- `visitors30d` = Σ uniqueVisitors over the comparison period.
- `extraOrders` = `visitors30d × (convNow − convBefore)` (floor at 0).
- `extraRevenue` = `extraOrders × aovNow + ordersNow × (aovNow − aovBefore)` (floor at 0).
- `aovLift` = `aovNow − aovBefore`. `convLift` = `convNow − convBefore` (percentage points).
- `winsBanked` = count of applied winners (autopilot `completedCount` / addons with `lastWinner`).
- "this week" delta = same formula restricted to the last 7 days vs the prior 7.

All formulas are pure functions in a new `backend/src/lib/cro-value.ts`, unit-tested with divide-by-zero / null / negative-lift guards (mirror the existing `cro-lift.ts` discipline).

### 2. Before → Now comparison

Side-by-side cards: old cart (convBefore, aovBefore, ordersBefore/mo) → new cart (convNow, aovNow, ordersNow/mo).

### 3. Conversion trend graph

Daily purchase-conversion line (rolling, Apr 9 → today) with gold milestone markers where the autopilot applied a winner (from each addon's `lastWinner.appliedAt` + the win label/lift). SVG line chart (no new chart dependency unless the reviewer prefers one).

### 4. Fuel callout

"`{visitors}` shoppers analyzed — your cart is learning fast. More visitors = quicker wins." Reinforces that verdict speed scales with traffic (the merchant's own framing).

### 5. Next-moves roadmap

"🚀 Next up on your testing roadmap." Fed by the real autopilot queue (`buildOptimizeQueueRich`): the active test (with confidence bar + ETA-to-verdict at current traffic), then the queued tests with plain-English reasons + estimated impact.

### 6. Research suggestion cards (new catalog)

"💡 Suggested new tactics (research-backed)." Five cards, each with title, one-line data-backed reason, and an **Activate** button. Activating surfaces/enables the tactic in the existing addons flow so the merchant can configure + test it. Engraving is starred as the watch-specific play.

The five suggestions live in a new **suggestions catalog** (`backend/src/lib/cro-suggestions.ts`) as metadata (key, label, blurb, evidence stat + source, impact range, metric, fitNote). They are display + activate-hook only in this milestone. **Full storefront rendering of each tactic (v14) is explicitly deferred to its own per-tactic build** — out of scope here. The five:
1. `freeReturns` — risk-reversal / money-back microcopy line.
2. `deliveryDate` — estimated delivery date in cart.
3. `checkoutMicrocopy` — checkout-button label + benefit subtext.
4. `giftEngraving` — "this is a gift" toggle + paid engraving line item.
5. `bnpl` — installment ("4 payments of $X") messaging.

### 7. Bug fix: `baselineCheckoutRate` > 1 normalization

The stored `baselineCheckoutRate` (1.56…) is not a fraction. Fix the normalization at the write site and defensively clamp at the read/display site so the rate renders as a sane percentage. Apply the fix in ALL paths that write/read it (blast-radius map required: `cro/route.ts` `?refresh=1` backfill + display, `cro-baseline.ts`, anywhere `store.baselineCheckoutRate` is set/read).

## Architecture / data flow

`GET /api/stores/[id]/cro` is extended (or a sibling `?view=momentum` block added) to return one payload:
```
{ currency,
  value: { extraRevenue, extraOrders, aovLift, convLift, winsBanked, thisWeekRevenue },
  before: { conversion, aov, ordersPerMonth },
  now:    { conversion, aov, ordersPerMonth },
  trend:  [{ date, conversion }],          // daily, from DailySummary
  milestones: [{ date, addonKey, label, lift }],
  fuel:   { visitors },
  roadmap: { active, queue },              // from buildOptimizeQueueRich
  suggestions: [ …cro-suggestions… ] }
```
`page.tsx` becomes a presentational redesign consuming this. Heavy calc lives in pure `lib/` functions (`cro-value.ts`) so it is unit-testable without the DB.

## Frontend design

Built with the `frontend-design` skill after the plan: dark "command center" aesthetic (teal accent on deep navy as in the approved mockup), responsive, mobile-friendly. Mockup of record: `.superpowers/brainstorm/65948-1780573482/analytics-momentum-v3.html`.

## Testing

- `cro-value.ts` pure-function unit tests: zero-visitor, null-baseline, negative-lift-floored, this-week-vs-prior-week, winsBanked counting.
- `baselineCheckoutRate` normalization: RED test reproducing the >1 render, fix, blast-radius locks on every write/read path.
- API route test: payload shape + values from a seeded DailySummary fixture.
- Follow the **blast-radius-shield** skill for the bug fix and any change to shared `cro-*` helpers.

## Out of scope (explicit)

- Full storefront (v14) implementation of any of the 5 suggested tactics — each is a separate build.
- AOV-over-time line graph (data not available; revisit when per-day revenue is recorded).
- Backfilling `totalRevenue` / `checkoutStarts` in DailySummary.
- Slice B2 (autonomy dial) / B3 (test picker) — separate specs.

## Risks

- Incremental-value numbers are estimates (counterfactual). Must be labelled "estimated" in the UI to stay honest; floor negatives at 0 so an early noisy week never shows a scary negative.
- Rolling baseline means the "before" number shifts as the earliest window ages out — acceptable and intended (keeps the story growing), but document it so it is not mistaken for a bug.
