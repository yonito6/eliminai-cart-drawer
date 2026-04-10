# A/B Test Timeline, Autopilot & Post-Winner Flow — Design Spec

> **Date:** 2026-04-10
> **Status:** Approved
> **Project:** Eliminai Cart Drawer (`C:/Projects/eliminai-cart-drawer/backend/`)

## Goal

Extend the existing A/B testing system (Thompson Sampling, 2-variant tests, per-addon experiments) with time estimates, autopilot mode, a results history page, post-winner decision flow, edit-triggers-test functionality, custom variant tournaments with bracket-style testing, and mid-test change protection with tiered warnings. The system is NOT addon-specific — it will expand to test checkout buttons, fonts, layouts, colors, and any other cart element.

---

## Part 1: Time Estimate

**What:** Show users how long the current test needs to reach statistical significance (95% confidence).

**Data source:** Our own `Event` table (cart opens, checkout clicks per day). We already collect this data via the tracking pixel. No Shopify analytics dependency.

**Calculation:**
1. Look at the last 7 days of events for this store
2. Calculate average daily checkout events
3. Use power analysis formula: `requiredSamples = 16 * (p * (1-p)) / (MDE^2)` where `p` = current checkout rate, `MDE` = minimum detectable effect (default 5%)
4. `daysRemaining = (requiredSamples - currentSamples) / dailyRate`
5. Cap estimate at `maxDays` (14 days default)

**Display:**
- Below the confidence bar in Track Results view
- Format: "~X days remaining" or "Enough data — analyzing" or "Low traffic — may take 2+ weeks"
- If fewer than 10 events/day → show warning: "Your store has low traffic. Consider running tests longer or driving more traffic."

**API:** Add to existing `/api/stores/[id]/addons/experiments` response:
```ts
estimatedDaysRemaining: number | null  // null = not enough data to estimate
dailyEventRate: number
requiredSamples: number
```

---

## Part 2: Autopilot Mode

**What:** One-click "optimize everything" — the system automatically picks the highest-impact test, runs it, applies the winner, then moves to the next test.

**How it works:**
1. User clicks "Auto-Optimize" on the addons page (or per-addon)
2. System builds an **optimization queue** ranked by expected impact:
   - Priority 1: WITH vs WITHOUT for untested addons (biggest potential lift)
   - Priority 2: Dimension tests for winning addons (refine what works)
   - Priority 3: Re-tests for old winners (validate over time)
3. Runs ONE test at a time (no parallel tests — clean data)
4. When a test completes (winner found or no difference):
   - Winner found → auto-apply winner config to store
   - No difference → keep current, mark as tested
   - Move to next test in queue
5. Autopilot continues until queue is empty or user pauses

**State per store:**
```ts
// In store.config
autopilot: {
  enabled: boolean
  currentTestSlot: string | null  // which slot is being tested
  queue: string[]                  // ordered list of "slot:dimension" to test
  completedCount: number
  totalLift: number                // cumulative lift from all winners
  startedAt: string | null
}
```

**Queue generation logic:**
- Scan all addon definitions for untested WITH/WITHOUT
- Then scan all testable dimensions of enabled addons
- Order by: untested WITH/WITHOUT first, then by addon category impact (trust > scarcity > shipping > upsell > social)
- Future: expand beyond addons to checkout buttons, fonts, etc.

**UI:**
- Toggle at top of addons page: "Auto-Optimize" with ON/OFF switch
- When ON: show current test + queue preview ("Testing Trust Badges → Next: Scarcity Timer → ...")
- Cumulative lift badge: "+12.3% overall improvement"
- User can pause/resume anytime
- User can reorder queue by drag-and-drop

**Nightly cron changes:**
- After detecting a winner, check if autopilot is enabled
- If yes → auto-apply winner, start next test in queue
- If no → just mark winner, wait for user action

---

## Part 3: Results History Page

**What:** Separate `/dashboard/results` page showing all completed and active tests across all slots (not just addons).

**Layout:**
- **Timeline feed** (left, 65%): chronological list of all experiments
  - Each card shows: test name, slot, date range, outcome (winner/no-difference/stopped), lift %, confidence
  - Expandable to show variant details + mini preview
  - Filter by: status, slot type, date range
  - Search by test name
- **Summary sidebar** (right, 35%):
  - Total tests run
  - Win rate (% of tests that found a winner)
  - Cumulative lift from all applied winners
  - "Best performing change" highlight
  - Active test status (if any)

**Data:** Query `Experiment` table ordered by `startedAt DESC`. Include per-variant stats from `ExperimentDailySummary`.

**API:** `GET /api/stores/[id]/experiments/history`
```ts
{
  experiments: Array<{
    id, name, slot, status,
    variants: Array<{ id, label, features, stats: { visitors, checkoutRate } }>,
    winnerVariantId, confidence, liftPercent,
    startedAt, endedAt, durationDays
  }>
  summary: {
    totalTests, winRate, cumulativeLift, bestChange: { name, lift }
  }
}
```

---

## Part 4: Post-Winner Decision Flow

**What:** After a test finds a winner, guide the user on what to do next.

**Flow:**
1. Winner detected (by nightly cron or manual check)
2. If autopilot ON → auto-apply winner, start next test, notify user
3. If autopilot OFF → show winner card with options:
   - **"Apply Winner"** — update store config with winning variant's features
   - **"Keep Testing This"** — show available dimensions to test next (e.g., trust badges position, style, text)
   - **"Test Something Else"** — show optimization queue / catalog of testable items
   - **"Revert"** — go back to pre-test config (always saved)

**Winner application:**
- Save winning features to `store.config.addons[key].config`
- Save winner metadata: `lastWinner: { variantId, features, appliedAt, lift }`
- Keep experiment record in DB (for history)

**"Keep Testing This" logic:**
- List all testable dimensions for this addon that haven't been tested yet
- Show expected impact estimate per dimension (from industry data in addon definitions)
- User picks one → starts new 2-variant test (current winner config vs alternative)

---

## Part 5: Edit-Triggers-Test

**What:** When a user manually edits an addon's settings, automatically offer to A/B test the change against the current (winner) config.

**Flow:**
1. User opens Edit view for an addon
2. User changes a setting (e.g., trust badge position from "below price" to "above button")
3. User clicks "Save"
4. System detects the change differs from current config
5. **Modal appears:**
   > "You changed [Trust Badge Position] from [Below Price] to [Above Button].
   > Want to A/B test this change against your current setting?
   > If the new setting wins, we'll apply it automatically."
   >
   > **[Test It]** · **[Just Save]** · **[Cancel]**
6. "Test It" → creates experiment: Variant A = old config (saved winner), Variant B = new config
7. "Just Save" → applies immediately, saves old config as rollback point
8. "Cancel" → discards changes

**Rollback support:**
- Every time config changes (manual or via winner), save previous config:
  ```ts
  // In store.config.addons[key]
  previousConfig: { config: {...}, savedAt: string, reason: 'winner' | 'manual' }
  ```
- User can always "Revert to Previous" from the edit view
- Show what the previous config was and why it was saved (winner vs manual change)

**Auto-save winner:**
- When a test completes with a winner, ALWAYS save the pre-test config as `previousConfig`
- This ensures the user can always go back, even after autopilot applies changes

---


## Part 7: Test Safety — Mid-Test Change Protection

**What:** Prevent users from accidentally corrupting A/B test data by changing cart settings while a test is running.

**Tiered warning system:**

| Change Type | Danger | Action |
|---|---|---|
| Change to the **addon being tested** | HIGH | Hard block — must choose: Pause & Save, Reset & Save, or Cancel |
| Change to a **different addon** (cart-related) | MEDIUM | Soft warning — "This might affect your running test. Continue?" |
| Change to **global cart settings** (layout, colors, checkout button) | MEDIUM | Soft warning |
| Change to **unrelated settings** (store branding, logo) | LOW | Allow silently |

**Hard block modal (same-slot changes):**
When user tries to save a change to the same addon/slot being tested:

> "You have an active A/B test running: [Test Name]
> Changing these settings mid-test will invalidate your results.
>
> **[Pause Test & Save]** — pauses test, preserves data, you can resume later
> **[Reset Test & Save]** — discards test data, saves change, can start fresh
> **[Cancel]** — keep testing, discard your changes"

**Pause & Save behavior:**
- Experiment status → `PAUSED`
- Data preserved up to pause point
- Timeline shows "paused" marker with reason ("Settings changed by user")
- User can resume — but data after resume is tracked separately (pre-pause vs post-pause segments)
- If resumed, Thompson Sampling uses only post-pause data for winner detection (pre-pause data shown in history but not used for decisions)

**Reset & Save behavior:**
- Experiment status → `INVALIDATED`
- All variant assignments cleared
- Daily summaries archived (visible in history as "invalidated")
- New config applied
- User can start a new test manually or autopilot picks it up

**Soft warning (different-slot changes):**
> "You have an active A/B test for [Trust Badges]. Changing [Scarcity Timer] settings could indirectly affect conversion rates.
> **[Save Anyway]** · **[Cancel]**"

No data reset — just awareness. The test continues. A note is added to the experiment timeline: "Other settings changed during test: [what changed]"

**Detection logic:**
```ts
function classifyChangeRisk(changingSlot: string, runningExperiments: Experiment[]): 'high' | 'medium' | 'low' {
  const activeSlots = runningExperiments.map(e => e.slot);
  if (activeSlots.includes(changingSlot)) return 'high';
  // Cart-affecting slots (addons, layout, checkout)
  const cartSlots = ['trustBadges', 'scarcityTimer', 'shippingProtection',
    'freeShippingBar', 'upsellRecommendations', 'socialProof',
    'checkout', 'layout', 'colors'];
  if (cartSlots.includes(changingSlot)) return 'medium';
  return 'low';
}
```

**Experiment timeline events:**
Add a `notes` JSON array to experiments for tracking mid-test events:
```ts
notes: Array<{ timestamp: string, type: 'paused' | 'resumed' | 'settings_changed' | 'invalidated', detail: string }>
```

---

## Architecture Notes

### Slot System (Beyond Addons)
The `slot` field in `Experiment` is a string, not tied to addon keys. Future slots:
- `addon:trustBadges` — addon tests
- `checkout:buttonColor` — checkout button A/B tests
- `layout:cartWidth` — layout tests
- `font:family` — typography tests

Current implementation uses bare addon keys (`trustBadges`). Migration path: prefix with `addon:` when non-addon tests are added.

### Nightly Cron Extensions
The existing nightly cron (`/api/cron/nightly/route.ts`) already handles:
- Thompson Sampling calculation
- Winner detection (95% confidence + >1% lift)
- Safety checks (48h rolling rate)

New responsibilities:
- Auto-apply winners when autopilot is ON
- Start next test in autopilot queue
- Generate time estimates

### No Parallel Tests
Only one test runs per store at a time. This keeps data clean and avoids interaction effects between changes. The autopilot queue enforces sequential execution.

### SaaS Readiness
All state is per-store (via `storeId`). Autopilot config lives in `store.config`. Experiment records are already scoped by `storeId`. No global state.

---

## Success Criteria

1. User sees "~X days remaining" on active tests
2. Auto-Optimize toggle starts sequential testing of all addons
3. Results page shows full history with cumulative lift
4. Winner detection triggers clear next-step options
5. Manual edits offer A/B test against saved winner
6. User can always rollback to previous config
7. Users can create custom variants and run tournament brackets
8. AI generates additional variants when autopilot is ON
9. Tournament bracket UI shows match progress and champion
10. Same-slot edits during active test trigger hard block modal
11. Different-slot edits show soft warning with option to continue
12. Paused tests track pre/post-pause data segments separately
