# Continuous CRO Optimization Engine — Design

**Date:** 2026-06-03
**Project:** Eliminai Cart Drawer (`C:\Projects\eliminai-cart-drawer`)
**Status:** Design — approved direction, pending spec review

## Problem

The cart drawer already runs A/B tests on individual add-ons, but each test is a
manual, one-off action. There is no system that strings tests together, keeps the
cart improving on its own, or shows the merchant the value they are getting. As a
result:

- The merchant has to remember to start the next test; the cart often sits idle.
- Express checkout and most single add-ons are free, copyable Shopify features — no
  moat. The defensible product is the *optimization engine*, not any one add-on.
- The merchant never sees a clear "your conversion rate went up because of us"
  number, so there is no strong reason not to uninstall.

## Goal

Turn the cart into a system that **always has something to test** and **continuously
improves CRO and AOV over time**, while **proving that value** to the merchant so they
keep the app. Make the engine progressively smarter using cross-store learning.

## Scope and build order

The vision is large, so it ships in two slices. Each slice gets its own
implementation plan and can ship independently.

- **Slice A — "See & Prove your CRO"** (build first). Capture a baseline at install
  and add an Analytics page that shows CRO/AOV lift over time. Fast visible payoff,
  no dependency on the engine.
- **Slice B — "The always-on engine"** (build second). Test-picker, autonomy modes,
  and the auto-progression engine that keeps tests running and applies winners.

Cross-store learning is **on as a feature from the start** but uses simple heuristic
priors initially and swaps to real cross-store Bayesian priors once enough stores
feed data (a phase-2 upgrade inside Slice B). It is not a blocker.

## What already exists (build on, do not rebuild)

- `backend/src/lib/autopilot.ts` — `buildOptimizeQueue` / `buildOptimizeQueueRich`:
  breadth-first "quick sweep" (with-vs-without) then "fine-tune" (dimension) strategy;
  hardcoded `CATEGORY_PRIORITY`; `applyWinner` saves `previousConfig` for rollback.
- `/api/stores/[id]/autopilot` (GET/PATCH) stores
  `config.autopilot = { enabled, currentTestSlot, queue, completedCount, totalLift, startedAt }`.
- `/api/stores/[id]/addons/reorder-queue`, `/addons/apply-recommended`.
- `/api/stores/[id]/addons/test/tournament` + `lib/tournament.ts` — multi-variant
  brackets (reuse for custom A-vs-B variant tests).
- `/addons/test/apply-winner`, `lib/thompson.ts` (Thompson sampling).
- Addon model: `mode: 'off' | 'locked' | 'auto-optimize'`,
  `optimizeState: { queuePosition, step?, totalSteps?, status? }`.
- Experiment statuses: `RUNNING / PAUSED / WINNER_FOUND / NO_DIFFERENCE`.
- Side nav: `backend/src/app/dashboard/layout.tsx` `NAV` array.
- `/dashboard/results` = "Test History" (per-test; not lift-over-time).

## Slice A — See & Prove your CRO

### Baseline capture

On install / store connect, pull the merchant's **last 30 days** of
orders, conversion rate, and AOV from the Shopify Admin API and store them as
`config.cro.baseline = { capturedAt, windowDays: 30, conversionRate, aov, orders, revenue }`.

Caveat to handle in implementation: Shopify reports **store-level** conversion and
AOV, not cart-drawer-specific CRO. So:

- The "since install" headline uses the **store-level** baseline vs current store-level
  metrics. It is *directional* — it includes outside factors (seasonality, sales,
  traffic shifts).
- **Cart-drawer-specific CRO** (drawer opens → checkouts) is measured **forward only**,
  from install onward, via the app's own event tracking.
- Per-test measured wins provide the **hard causal proof** underneath the headline.

The page must label which number is which so it stays honest.

### Analytics page

Add an **Analytics** item to the dashboard `NAV` and a new
`backend/src/app/dashboard/analytics/page.tsx`. It shows:

- Baseline vs current **CRO** and **AOV**, with cumulative lift (% and currency).
- A trend line of CRO/AOV over time since install.
- **Per-test win history** (reuses Test History / experiment data) as the hard proof.
- A plain-English **"what we've done for you"** activity log (tests run, winners
  applied, estimated and measured impact of each).

Framing is retention-first: the merchant should see, at a glance, the money the app
has made them.

## Slice B — The always-on engine

### Test-picker (after install, on demand)

Per add-on, the merchant chooses one of three test modes:

- **Don't test** — keep as-is, never include in the queue (e.g. Rewards always on,
  never tested "without").
- **With vs without** — the default first test for most add-ons.
- **Custom variants** — same add-on, different configs pitted against each other
  (e.g. Shipping Protection $5 vs $10, Reward milestone A vs B). Reuses the existing
  tournament/multi-variant engine. UI nudges the merchant to keep variants minimally
  different for cleaner reads.

The picker shows the **proposed test order** (from the queue builder, with a one-line
reason per test) and lets the merchant **reorder** it.

### Autonomy dial + guardrails

One global setting per store: **Manual → Semi-auto → Full-auto**.

Paired with **per-add-on guardrails** the merchant sets once:

- **Locked** — always on, never tested without.
- **Off-limits** — never enabled by the engine.
- **Free to test** — engine may enable / test / vary it.

Mode behavior:

- **Manual** — engine stays quiet; merchant drives every test (today's behavior).
- **Semi-auto** — engine proposes the next action into an **Approvals inbox**
  ("Test Scarcity Timer on/off — est. +3%, ~6 days — Approve / Skip / Always allow").
  Nothing changes until approved.
- **Full-auto** — engine acts on its own *inside the guardrails*, including enabling a
  free-to-test add-on the merchant has not switched on (surfaced with a warning and
  logged). It can only ever act within the sandbox the merchant drew.

### Auto-progression engine

The core missing loop. When a running test reaches a verdict
(`WINNER_FOUND` / `NO_DIFFERENCE`):

1. Apply the winner (or revert to control), saving `previousConfig` for rollback.
2. Pick the next test from the queue by **expected lift per day** =
   `(predicted lift × win probability) ÷ days-to-verdict`. Low-traffic stores
   naturally favor big-swing with-vs-without tests over slow fine-tuning.
3. Start the next test (or, in semi-auto, queue it for approval).
4. Use **sequential testing with early stopping** (via `thompson.ts`) so verdicts
   come as soon as they are statistically sound and the queue keeps moving.
5. **Auto-rollback**: keep watching an applied winner; if it regresses, revert.

There is always something testing until the queue is exhausted, then the engine
enters a low-intensity "watch" mode (periodic re-tests, newly added add-ons).

### Cross-store learning (phased)

The prioritizer in step 2 needs priors for `predicted lift` and `win probability`.

- **Phase 1 (now):** heuristic priors from the existing `CATEGORY_PRIORITY` and each
  add-on's `estimatedImpact`.
- **Phase 2 (later):** real cross-store **Bayesian priors with shrinkage** — a new
  store borrows the global prior, then its estimate slides toward its own data as
  orders accumulate. Priors are **segmented** by store profile (AOV band, vertical,
  traffic level). More stores → smarter priors → better results for everyone (data
  flywheel). This is the moat.

The interface between the engine and the prior source is designed so Phase 2 swaps in
without reworking the engine.

## Data model (additions to `store.config`)

- `cro.baseline` — `{ capturedAt, windowDays, conversionRate, aov, orders, revenue }`.
- `cro.history` — time series of measured CRO/AOV snapshots.
- `autonomy` — `{ mode: 'manual' | 'semi' | 'full' }`.
- Per add-on `guardrail` — `'locked' | 'off-limits' | 'free'`.
- Per add-on `testPlan` — `{ mode: 'none' | 'with-without' | 'custom', variants?: [...] }`.
- `approvals` — queue of proposed actions awaiting merchant decision (semi-auto).
- Extend existing `config.autopilot` rather than introducing a parallel concept.

## Error handling and safety

- Engine actions run inside guardrails; off-limits add-ons are never touched.
- Every applied winner stores `previousConfig` and is monitored for regression
  (auto-rollback).
- Every autonomy action is logged in plain English with estimated and measured
  impact (feeds the Analytics activity log and builds trust).
- Statistical floors: a minimum number of orders/visitors before any verdict; a max
  test duration so nothing runs forever.
- Baseline capture failures (missing scope, API error) degrade gracefully: the
  Analytics page shows forward-only metrics and notes the baseline is unavailable.

## Testing

- Follow the project's blast-radius + TDD conventions (RED tests first).
- Unit-test the prioritizer (expected-lift-per-day ordering), the guardrail
  enforcement (off-limits never selected; locked never tested without), and the
  auto-progression state transitions (verdict → apply → pick next → start).
- Lock cross-path behavior: the queue builder, autopilot route, and test routes must
  stay consistent (they already share `config.autopilot` / `optimizeQueue`).
- Slice A: test baseline capture and the lift math (baseline vs current).

## Out of scope (for now)

- Permanent holdout cohort (explicitly rejected — no sacrificing results for a number).
- Real cross-store priors data set (phase-2; ships with heuristic priors first).
- Multi-test parallelism beyond what the cart's independent add-on slots already allow.

## Open implementation questions (resolve in plan)

- Exact Shopify Admin API calls for last-30-day store-level conversion + AOV, and the
  scopes required.
- How forward-only cart-drawer CRO events are recorded and aggregated for the trend.
- Where the engine "tick" runs (existing nightly cron vs on test-verdict webhook).
