# Cart Addons Page — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Project:** Eliminai Cart Drawer (C:/Projects/eliminai-cart-drawer)

## Overview

A dedicated Addons page in the Cart Optimizer dashboard where store owners toggle cart features on/off, customize them with live preview, and let the AI engine auto-optimize each feature for maximum conversion. Three modes per addon: Off, Auto-Optimize, Locked.

## User Flow

### Per-Addon Lifecycle

```
OFF → Toggle ON → Edit & Preview → Auto-Optimize or Lock
                                          ↓
                                   Engine runs sequential A/B tests
                                          ↓
                                   Results shown on card
                                          ↓
                                   Winner deployed automatically
```

1. **Toggle ON** — card expands with focused cart preview + edit controls
2. **Configure** — change style, text, position; preview updates live
3. **Auto-Optimize** — engine takes over, runs sequential tests, reports results
4. **OR Lock** — feature stays exactly as configured, never tested
5. **Toggle OFF** — feature removed from cart entirely

## Addon Card States

| State | Appearance | Behavior |
|---|---|---|
| **Off** | Greyed out (opacity 0.7), just name + description + toggle | Feature not injected into cart |
| **On (editing)** | Expanded: focused cart preview + edit controls + Auto-Optimize/Lock buttons | Feature shown to all visitors as configured |
| **Auto-Optimize (active)** | Green "Optimizing" badge, progress indicator (Step X/Y), current test description | Engine testing variations. One addon at a time. |
| **Auto-Optimize (queued)** | "Queued #N" badge, position in queue | Waiting for current optimization to finish |
| **Auto-Optimize (done)** | Green "Optimized" badge, lift percentage, winning config summary, "View history" link | Winner deployed. Card shows results permanently. |
| **Locked** | Blue border, lock icon, blue toggle | Always shown exactly as configured. Appears in every experiment variant. |

## Edit Controls

Each addon has its own editable dimensions. User selections that are marked "never tested" are respected by the engine — it only optimizes the testable dimensions.

### Trust Badges
- **Style** (testable): preset buttons — "Icons + Labels" / "Icons Only" / "Compact Strip"
- **Security text** (testable): free text input, default "Secure Checkout · Money-Back Guarantee"
- **Position** (testable): dropdown — Below checkout / Above checkout / Below cart items
- **Payment icons** (NEVER tested): checkboxes — Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay. User's choice is sacred.

### Scarcity Timer
- **Text template** (testable): e.g. "Cart reserved for {time}" / "Hurry! Items selling fast — {time} left" / "{time} before cart expires"
- **Duration** (testable): 10 min / 15 min / 20 min
- **Style** (testable): Subtle text / Bold banner / Animated pulse
- **Position** (testable): Below header / Above checkout / Floating top

### Shipping Protection
- **Price** (never tested — store's actual price): numeric input
- **Description text** (testable): free text input
- **Toggle default state** (testable): ON by default vs OFF by default
- **Style** (testable): Compact row / Detailed with icons

### Free Shipping Bar
- **Threshold** (never tested — store's actual threshold): currency input
- **Text template** (testable): e.g. "Add {amount} more for FREE shipping" / "You're {amount} away from free shipping!"
- **Style** (testable): Thin bar / Full progress bar with milestones
- **Position** (testable): Header area / Above items / Below items

### Upsell Recommendations
- **Product source** (never tested): Shopify recommendations / Manual picks / AI-selected
- **Headline** (testable): "You might also like" / "Complete the look" / "Customers also bought"
- **Layout** (testable): Single product card / Horizontal scroll / Stacked list
- **Position** (testable): Below items / Above footer / After checkout button

### Social Proof
- **Text template** (testable): "{count} people viewing" / "{count} sold today" / "Trending — {count} in carts right now"
- **Style** (testable): Subtle text / Badge with animation / Toast notification
- **Position** (testable): Header area / Above checkout / Floating

## Auto-Optimize Engine

### Sequential Test Strategy
When an addon enters Auto-Optimize, the engine runs one A/B test at a time:

1. **Step 1 — Prove It**: Show feature vs hide feature. Does it help conversion at all?
   - If it hurts → recommend turning OFF, notify user
   - If neutral → skip to step 2 (keep it, try improving)
   - If positive → lock in "always show", proceed to optimize
2. **Step 2+ — Optimize Dimensions**: Test one dimension at a time. Order by estimated impact.
   - Each test: 2-3 variants of that dimension, all else constant
   - Winner locked in, move to next dimension
3. **Final Step**: Deploy winning combination. Report total lift.

### Queue Management
- Only ONE addon actively optimizes at a time (clean statistical signal)
- Queue ordered by estimated impact (highest first)
- User can **drag to reorder** the queue
- Queue visible on the page: "1. Trust Badges (testing now) → 2. Scarcity Timer → 3. Social Proof"

### Rules
- User-selected "never tested" fields are always respected
- Locked addons appear in EVERY experiment variant as constants
- Each test step requires statistical significance (95% confidence, minimum 100 visitors per variant) before advancing
- If a test is inconclusive after maxDays, pick the simpler option and move on

## Optimization Results Display

When an addon finishes all optimization steps, the card shows:

```
Trust Badges  ✓ Optimized                                    +4.1% checkout rate
Best config: Icons Only · Below checkout · "Trusted by 10,000+ customers"
Tested over 14 days · 2,847 visitors · 4 tests completed        [View history →]
```

**"View history"** expands to show each test step:
- Step 1: Show vs Hide → Show won (+3.2%, p=0.02)
- Step 2: Position → Below checkout won (+0.5%)
- Step 3: Style → Icons Only won (+0.3%)
- Step 4: Text → "Trusted by 10,000+" won (+0.1%)

## Estimated Impact Badges

Before a user enables a feature, show data-driven estimates on each addon card:

- "Trust Badges — **typically +2-10% conversion**"
- "Scarcity Timer — **typically +2-8% conversion**"
- "Free Shipping Bar — **typically +10-20% AOV**"

Sources:
- **Phase 1 (MVP)**: Industry benchmark data (hardcoded from research)
- **Phase 2**: Cross-store aggregate data (anonymized results from all stores using this feature)
- Badge updates as real data accumulates, becoming our competitive moat

## Conflict Detection

Some addons compete for attention or visual space. When potentially conflicting addons are both enabled:

**Urgency conflict**: Scarcity Timer + Social Proof (both create urgency)
**Footer crowding**: Trust Badges + Shipping Protection + Free Shipping Bar (all below checkout)

When detected, show a subtle info banner:
> "Trust Badges and Shipping Protection both appear below checkout. The optimizer will test whether they work better together or if one should move."

After individual optimization completes for all conflicting addons, the engine automatically runs a **combination test** — all permutations of showing/hiding the conflicting pair to determine if both help or one cancels the other.

## Recommended Setup

For new stores or stores with no addons enabled, show a CTA at the top of the page:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ Recommended Setup                                           │
│  Based on data from 50+ stores, this combination averages       │
│  +12% conversion: Trust Badges + Free Shipping Bar +            │
│  Scarcity Timer                                                 │
│                                                                 │
│  [Apply Recommended Setup]                                      │
└─────────────────────────────────────────────────────────────────┘
```

Clicking "Apply Recommended Setup":
1. Enables the recommended addons with best-performing defaults
2. Sets all to Auto-Optimize mode
3. Queues them in optimal order
4. User can still edit any of them before optimization starts

The recommendation updates as cross-store data accumulates.

## Cart Preview

### Focused Preview (default in edit panel)
- Shows only the area around the feature being edited
- Trust Badges → checkout button + trust area
- Scarcity Timer → header area + timer
- Shipping Protection → footer protection row
- Uses iframe + real CSS/HTML from live store (same approach as cart-preview.tsx)
- No debug overlays — looks exactly like the real cart

### Full Cart Preview (expandable)
- "Preview Full Cart" button below the focused preview
- Opens the complete cart drawer with the feature visible in context
- Same iframe approach, full cart HTML

### Live Updates
- Preview re-renders when user changes any edit control (style, text, position, icons)
- Debounced (300ms) to avoid flicker during typing

## Data Model

### Store config JSON — `addons` field

```json
{
  "addons": {
    "trustBadges": {
      "enabled": true,
      "mode": "auto-optimize",
      "config": {
        "style": "icons-labels",
        "text": "Secure Checkout · Money-Back Guarantee",
        "icons": ["visa", "mastercard", "amex", "paypal"],
        "position": "below-checkout"
      },
      "optimizeState": {
        "status": "active",
        "queuePosition": 1,
        "currentStep": 2,
        "totalSteps": 4,
        "currentDimension": "position",
        "completedSteps": [
          { "dimension": "show-hide", "winner": "show", "lift": 3.2, "confidence": 0.97, "visitors": 1420 }
        ]
      },
      "results": null
    },
    "scarcityTimer": {
      "enabled": true,
      "mode": "auto-optimize",
      "config": {
        "textTemplate": "Cart reserved for {time}",
        "duration": 15,
        "style": "subtle-text",
        "position": "below-header"
      },
      "optimizeState": {
        "status": "queued",
        "queuePosition": 2
      },
      "results": null
    },
    "shippingProtection": {
      "enabled": true,
      "mode": "locked",
      "config": {
        "price": 4.99,
        "description": "Against Damage, Loss & Theft",
        "defaultOn": true,
        "style": "compact"
      },
      "optimizeState": null,
      "results": null
    },
    "freeShippingBar": {
      "enabled": false,
      "mode": "off",
      "config": {
        "threshold": 75,
        "textTemplate": "Add {amount} more for FREE shipping",
        "style": "full-progress",
        "position": "header"
      },
      "optimizeState": null,
      "results": null
    },
    "upsellRecommendations": {
      "enabled": false,
      "mode": "off",
      "config": {
        "source": "shopify-recommendations",
        "headline": "You might also like",
        "layout": "horizontal-scroll",
        "position": "below-items"
      },
      "optimizeState": null,
      "results": null
    },
    "socialProof": {
      "enabled": false,
      "mode": "off",
      "config": {
        "textTemplate": "{count} people viewing right now",
        "style": "subtle-text",
        "position": "header"
      },
      "optimizeState": null,
      "results": null
    }
  },
  "optimizeQueue": ["trustBadges", "scarcityTimer"],
  "estimatedImpact": {
    "trustBadges": "+2-10% conversion",
    "scarcityTimer": "+2-8% conversion",
    "freeShippingBar": "+10-20% AOV",
    "shippingProtection": "+15-25% attach rate",
    "upsellRecommendations": "+10-25% AOV",
    "socialProof": "+1-5% conversion"
  },
  "conflicts": [
    { "addons": ["scarcityTimer", "socialProof"], "reason": "urgency-overlap", "message": "Both create urgency — optimizer will test if they work better together or compete." },
    { "addons": ["trustBadges", "shippingProtection", "freeShippingBar"], "reason": "footer-crowding", "message": "Multiple elements below checkout — optimizer will test spacing and ordering." }
  ]
}
```

### Experiment Integration

When the engine creates an A/B test for an addon dimension, it uses the existing Experiment model:
- `slot`: `"addon-optimize"` (distinct from manual experiments)
- `variants`: auto-generated by the engine (e.g., position variants)
- Locked addons injected as constants in all variants
- Results feed back into the addon's `optimizeState.completedSteps`

## Page Structure

### Navigation
New tab in dashboard sidebar: **Addons** (alongside Overview and Experiments)

### Layout
```
┌─ Cart Addons ─────────────────────────────────────────────────┐
│ Toggle features on/off · Edit · Optimize automatically        │
│                                              [3 active] [1 ⚡]│
├───────────────────────────────────────────────────────────────┤
│ ⚡ Recommended Setup (only if no addons enabled yet)          │
│ Based on 50+ stores... [Apply Recommended Setup]              │
├───────────────────────────────────────────────────────────────┤
│ Optimization Queue: 1. Trust Badges (now) → 2. Scarcity Timer│
│                                              [drag to reorder]│
├───────────────────────────────────────────────────────────────┤
│ 🛡 Trust Badges ────────────────────────────── [ON toggle]    │
│ ┌─ Focused Preview ─┐  ┌─ Customize ────────────────────┐    │
│ │ [checkout btn]     │  │ Style: [Icons+Labels] [Only] ..│    │
│ │ [30-day returns]   │  │ Text: [________________]       │    │
│ │ [trust badges]     │  │ Icons: ☑Visa ☑MC ☑Amex ☐Apple │    │
│ │                    │  │ Position: [Below checkout ▾]    │    │
│ │ [Preview Full Cart]│  │                                │    │
│ └────────────────────┘  │ [Auto-Optimize] [Lock]         │    │
│                         └────────────────────────────────┘    │
├───────────────────────────────────────────────────────────────┤
│ ⏱ Scarcity Timer  Optimizing · Step 1/4    [Edit] [ON toggle]│
├───────────────────────────────────────────────────────────────┤
│ 🔒 Shipping Protection  Locked             [Edit] [ON toggle]│
├───────────────────────────────────────────────────────────────┤
│ 📦 Free Shipping Bar   +10-20% AOV                [OFF toggle]│
├───────────────────────────────────────────────────────────────┤
│ 🎁 Upsell Recs         +10-25% AOV                [OFF toggle]│
├───────────────────────────────────────────────────────────────┤
│ 👥 Social Proof         +1-5% conversion           [OFF toggle]│
└───────────────────────────────────────────────────────────────┘
```

### Card Ordering
1. Currently optimizing (active)
2. Queued for optimization
3. Locked
4. On (not optimizing)
5. Off (with estimated impact badges to encourage enabling)

## API Endpoints

### GET /api/stores/:id/addons
Returns full addons config for the store.

### PATCH /api/stores/:id/addons/:addonKey
Update addon config. Body:
```json
{
  "enabled": true,
  "mode": "auto-optimize",
  "config": { "style": "icons-only", "text": "...", ... }
}
```

### POST /api/stores/:id/addons/reorder-queue
Reorder optimization queue. Body:
```json
{ "queue": ["scarcityTimer", "trustBadges"] }
```

### POST /api/stores/:id/addons/apply-recommended
Apply recommended setup (enables + configures + queues recommended addons).

### GET /api/stores/:id/addons/:addonKey/history
Returns optimization test history for a specific addon.

## Implementation Phases

### Phase 1 — MVP (build now)
- Addons page with all 6 addons
- Toggle on/off with card expand/collapse
- Edit controls per addon with focused cart preview
- "Preview Full Cart" button
- Lock mode (feature always on, never tested)
- Auto-Optimize button (creates experiments via existing engine)
- Optimization queue display (read-only order for now)
- Store config JSON update
- API endpoints for addon CRUD

### Phase 2 — Intelligence
- Drag-to-reorder queue
- Optimization results display with lift % and history
- Estimated impact badges (hardcoded industry data)
- Conflict detection banners
- Combination testing after individual optimization

### Phase 3 — Cross-Store Learning
- Recommended Setup based on aggregate data
- Dynamic estimated impact from real cross-store results
- Warm-start priors for new stores (faster optimization)
- Impact badges update with real data

## Files to Create/Modify

### New Files
- `src/app/dashboard/addons/page.tsx` — Addons page
- `src/app/dashboard/addons/addon-card.tsx` — Individual addon card component
- `src/app/dashboard/addons/addon-preview.tsx` — Focused + full cart preview
- `src/app/dashboard/addons/addon-editor.tsx` — Edit controls per addon type
- `src/app/api/stores/[id]/addons/route.ts` — GET/PATCH addon config
- `src/app/api/stores/[id]/addons/reorder-queue/route.ts` — Queue reorder
- `src/app/api/stores/[id]/addons/apply-recommended/route.ts` — Recommended setup
- `src/app/api/stores/[id]/addons/[key]/history/route.ts` — Test history
- `src/lib/addon-definitions.ts` — Addon metadata (dimensions, defaults, estimated impact)

### Modified Files
- `src/app/dashboard/layout.tsx` — Add Addons tab to sidebar/nav
- `prisma/schema.prisma` — No schema change needed (addons stored as JSON in Store.config)
- `v14-complete.js` — Read addon config to decide which features to inject (already partially done for trust badges)
- `src/lib/variant-assign.ts` — Respect locked addons as constants in experiment variants
- `cart-html-control.html` + `cart-html-trust-badges.html` — Add placeholder comments for all addon injection points
