# Eliminai Cart Drawer — Self-Learning Conversion Engine

## Store & API

- **Store**: eleganto-3011.myshopify.com
- **API Version**: 2025-01
- **Theme**: Impulse
- **Auth**: OAuth Client Credentials from Eliminai app `.env` (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET). NEVER use hardcoded `shpat_` tokens.

### Theme IDs
| Theme | ID | Role |
|---|---|---|
| **Eliminai Cart Drawer Demo** | `158577557755` | **STAGING** - always deploy here |
| Impulse custom claude drawer cart | `158546952443` | LIVE - only deploy when Yoni says "deploy to live" |

## Staging/Live Workflow - MANDATORY

**NEVER upload to the live theme unless Yoni explicitly says to.** Always upload to the Demo/Staging theme.

1. **Develop** - edit files locally, syntax check
2. **Upload to STAGING** (`node upload-v14.js`) - uploads to Demo theme by default
3. **Yoni tests** - previews the demo theme on the store
4. **Yoni approves** - publishes the demo theme as live, then duplicates a new demo theme
5. **Upload to LIVE** - ONLY when Yoni says. Use: `node upload-v14.js --live`

### Version History - Git Tags

**Every upload MUST be preceded by a git commit + tag** so we can always trace and roll back.

- Before uploading, commit all changes with a descriptive message
- Tag format: `v14.XX-description` (e.g., `v14.15-case-qty-guard`)
- To see all versions: `git log --oneline --tags`
- To see what changed: `git diff v14.15..v14.16`
- To roll back: checkout the old tag, upload those files

**If something breaks:**
1. `git log --oneline` - find the last working version
2. `git diff v14.XX..v14.YY` - see exactly what changed
3. `git checkout v14.XX -- v14-complete.js` - restore that file
4. Upload the restored version to staging, verify, then go live

## File Structure

| Local File | Shopify Asset Key | Purpose |
|---|---|---|
| `v14-complete.js` | `assets/custom-cart-drawer.js` | All cart drawer JS logic |
| `v14-css.css` | `assets/custom-cart-drawer.css` | All cart drawer styles |
| `v14-drawer.liquid` | `snippets/cart-drawer.liquid` | Main drawer template + config injection |
| `v14-cart-item.liquid` | `snippets/cart-item.liquid` | Individual cart line item template |
| `v14-cart-ajax.liquid` | `templates/cart.ajax.liquid` | AJAX cart response (item list + data attrs) |
| `settings_schema_new.json` | `config/settings_schema.json` | Theme settings schema (cart drawer section) |
| `upload-v14.js` | — | Node upload script for all 5 files |

## Upload Workflow

1. **Always syntax-check JS before uploading**: `node -c v14-complete.js`
2. **Upload all files**: `node upload-v14.js`
3. The upload script uses Shopify Admin REST API PUT to update theme assets

## Key Architecture

### Config System
- `window.CCD_CONFIG` (aliased as `CFG`) — injected by Liquid from theme settings in `v14-drawer.liquid`
- All settings are configurable in Shopify theme editor under "Cart Drawer" sections
- Settings include: protection, gift/case, progress bar, scarcity, colors, text, behavior toggles

### Cart Refresh Flow
1. User action (add/remove/qty change) → fetch `/cart/change.js` or `/cart/add.js`
2. Response → fetch `/cart.js` for full cart
3. `CCD.refresh(cart)` — fetches `cart.ajax` template, morphs DOM, then runs:
   - `checkProtection()` — auto-add/remove shipping protection
   - `checkWatchCase()` — auto-add gift case when watch count >= goal
   - `enforceGiftItem()` — format gift item (hide qty, add badge, float price right)
   - `applyScarcity()` — compute + render "Only 1 left" badge (sticky per session)
   - `lockScarcityQty()` — disable + button on scarcity item
   - `updateProgress()` — milestone bar (shipping + promo goals)
   - `syncMilestoneAnimations()` — sync pulse animations

### Scarcity System (Sticky Logic)
- Target configurable: 1st, 2nd, 3rd, Last, or Random unique item
- Default: 2nd unique item (psychology: desire → urgency → reward)
- **Sticky**: once assigned, stays on that item even if other items are removed
- Only recomputes when the scarcity item itself is removed from cart
- Session-persisted via `sessionStorage('ccd_scarcity_vid')`
- Blocks adding more of the scarcity item via fetch/XHR interceptor
- Skips items with qty > 1 and same-product duplicates

### Gift Case System
- Auto-adds when watch count >= WATCH_GOAL (default 3)
- Auto-removes when watch count drops below goal
- Gift item formatted: hidden qty, "Bonus gift" badge below price, right-aligned
- `caseDismissed` flag in sessionStorage if user manually removes

### Mobile Handling
- Base width: `max-width: 380px`
- Desktop (≥769px): `max-width: 440px`
- Galaxy-class (< 385px viewport): `calc(100vw - 16px)`

### Checkout Button
- CSS-only loading state (no innerHTML changes — preserves form submit)
- `::before` spinner replaces hidden lock icon
- `pageshow` event resets on back-button (bfcache)

### Shipping Protection Toggle
- Starts ON with `ccd-toggle--instant` class (no slide animation)
- Class removed after 500ms to enable future animation on user interaction

## Bash/Liquid Gotchas
- **NEVER use bash heredocs with Liquid syntax** — `{{ }}` and `{% %}` conflict with bash. Use node scripts instead.
- Use `String.fromCharCode(36)` for `$` in `node -e` to avoid template literal issues
- Always quote file paths in bash commands

## Theme Settings Schema
The cart drawer settings are in `settings_schema_new.json` under these groups:
- Cart Drawer – Shipping Protection
- Cart Drawer – Progress Bar
- Cart Drawer – Gift Case
- Cart Drawer – Scarcity
- Cart Drawer – Advanced

---

## Shopify App Architecture — MANDATORY

This cart drawer is a **standalone Shopify app** (separate from Eliminai support app).
All settings live in the app, NOT in theme settings.

### Why Separate App
- Different product, different billing, different Shopify permissions
- Cart drawer needs minimal scopes (read_themes or none with Theme App Extension)
- Support app has different scopes (orders, customers, emails)
- Customers might want one without the other
- Separate App Store listing

### Developer App
- Create a NEW app in Shopify Partners (not reuse Eliminai support app)
- App name: "Eliminai Cart Optimizer" (or similar)
- Required scopes: read_products (for upsell product picker)
- Theme App Extension replaces manual theme file editing

### How It Works

**1. Theme App Extension (app embed block)**
- Lives in extensions/ directory of the app
- Merchant toggles it ON in theme editor — no manual code editing
- Injects cart drawer JS/CSS into every storefront page
- Replaces current manual upload workflow for production merchants
- Dev/testing: we still use upload-v14.js for our own store

**2. App Panel (embedded in Shopify admin)**
- React/Next.js page rendered inside Shopify admin via App Bridge
- This is where merchants configure EVERYTHING:
  - Cart drawer design (colors, layout, text)
  - Scarcity settings (type, text, target item)
  - Checkout button text/icons/emojis
  - Upsell rules (trigger product -> upsell product)
  - Progress bar thresholds and messaging
  - Gift/bonus incentive rules
  - Trust elements
  - A/B test dashboard (live results, winning variants, revenue impact)
  - Seasonal/holiday theme selector
- NO settings in Shopify theme editor (except the on/off toggle for the embed block)

**3. App Proxy (config delivery + event collection)**
- Store routes: store.com/apps/eliminai-cart/*
- GET /apps/eliminai-cart/config — returns cart drawer config (settings, active variants, upsell rules)
- POST /apps/eliminai-cart/events — receives tracking events (batched)
- Same-origin, zero CORS, free, HMAC-signed by Shopify

**4. Backend (Railway — shared or separate)**
- Can share Railway instance with Eliminai support app (separate routes)
- Or deploy as separate service if needed for scaling
- Stores: merchant settings, experiment data, event logs, bandit calculations
- Serves variant assignments and config via App Proxy

### Migration Path
- Phase 1 (NOW): Manual upload to our own store, theme settings, no app
- Phase 2: Build Shopify app scaffold, Theme App Extension, basic panel
- Phase 3: Move settings from theme to app panel, App Proxy for config
- Phase 4: A/B testing engine, event collection, dashboard
- Phase 5: App Store submission, billing, onboarding flow

## VISION: Self-Learning Cart Drawer

The Eliminai Cart Drawer is not just a cart — it is a **self-learning conversion engine** that A/B tests every element, measures real checkout behavior, and automatically shifts to the highest-converting combinations. It gets smarter every single day.

**Nobody in the Shopify ecosystem does this.** Existing cart apps are static — the merchant picks settings and hopes for the best. Our cart learns what actually makes people click checkout.

### What Gets Tested (A/B Test Dimensions)

Every testable element is a **dimension**. The system tests one or more dimensions simultaneously using multi-armed bandit algorithms (not traditional A/B — bandits automatically shift traffic to winners while still exploring).

#### 1. Scarcity Tactics
- "Only 1 left!" (current)
- "Only X left in stock" (with real or pseudo inventory numbers)
- Countdown timer ("Reserved for 10:00 minutes")
- "Selling fast — 3 sold in the last hour"
- "Last one at this price"
- Social proof: "12 people viewing this right now"
- No scarcity at all (control)
- **Test**: which scarcity type, text, icon, and target item position drive the most checkouts

#### 2. Checkout Button
- Text variations: "Secure Checkout", "Complete Purchase", "Buy Now", "Proceed to Checkout", "Claim Your Order"
- With/without lock icon
- With/without price total on button
- Emoji variations: lock, checkmark, cart, credit card, none
- Button color (if theme allows)
- **Test**: which combination of text + icon + emoji gets the most clicks

#### 3. Upsells & Cross-sells
- **Triggered upsells**: when customer adds product X, suggest product Y
- Product-specific upsell rules (configurable per product or collection)
- Upsell formats: inline card, popup, bottom banner, "Frequently bought together"
- Upsell pricing: show savings ("Save $X when added"), percentage off, "Complete the set"
- **Test**: which upsell product, format, and messaging converts best for each trigger product
- Track: upsell impression > upsell add-to-cart > checkout conversion (full funnel)

#### 4. Progress Bar & Milestones
- Threshold amounts for free shipping / bonus gift
- Message text ("Add X more for FREE shipping" vs "You are $X away from free shipping")
- Celebration animation when milestone hit
- With/without progress bar entirely
- **Test**: which thresholds and messages maximize AOV (average order value)

#### 5. Gift/Bonus Incentives
- Gift unlock threshold (2 watches? 3? $100 spend?)
- Gift messaging ("Bonus gift unlocked!" vs "Free watch organizer added")
- Gift positioning (top vs bottom of cart)
- **Test**: which gift threshold and messaging maximizes items-per-order

#### 6. Trust Elements
- Trust badge text and icons
- "30-day money back guarantee" vs "Free returns" vs "Trusted by 10,000+ customers"
- Secure payment icons
- **Test**: which trust elements reduce cart abandonment

#### 7. Cart Layout & UX
- Item image size
- Show/hide variant names
- Quantity selector style
- Remove button position
- **Test**: which layout reduces friction and increases checkout rate

### How It Works — Architecture

#### Event Tracking (Client-Side)
Every visitor session is assigned to test variants. The JS tracks:

| Event | Data |
|---|---|
| cart_open | timestamp, items in cart, cart value |
| item_added | product handle, variant, price, upsell or organic |
| item_removed | product handle, variant |
| upsell_shown | upsell product, trigger product, format |
| upsell_accepted | upsell product, trigger product |
| upsell_dismissed | upsell product, trigger product |
| scarcity_shown | scarcity type, text, target item |
| checkout_clicked | cart value, item count, active test variants |
| checkout_completed | via Shopify thank-you page pixel or webhook |

Events are batched and sent to the backend every 30 seconds or on checkout click.

#### Multi-Armed Bandit Algorithm (Thompson Sampling)
Traditional A/B testing wastes traffic on losing variants until statistical significance is reached. **Thompson Sampling** (Bayesian bandit) is better:

1. Each variant starts with a prior belief (Beta distribution)
2. Every checkout (success) or cart abandonment (failure) updates the belief
3. Traffic is automatically allocated proportional to each variant probability of being the best
4. Winners get more traffic naturally, losers fade out
5. New variants can be added anytime — the system adapts

**Key advantage**: No manual "call the test" step. The system continuously optimizes. After enough data, 90%+ traffic goes to the winner while 10% keeps exploring.

#### Daily Learning Cycle
1. **Midnight aggregation**: Summarize the day events per variant
2. **Update beliefs**: Recalculate Beta distributions for each dimension
3. **Rebalance traffic**: Adjust variant weights based on updated beliefs
4. **Promote winners**: If a variant has >95% probability of being best with 1000+ observations, lock it as default
5. **Retire losers**: If a variant has <5% probability of being best, stop showing it
6. **Generate report**: Daily email/dashboard with wins, losses, revenue impact

#### Data Storage — Backend
The cart drawer JS is client-side only. We need a lightweight backend for:
- Storing event data
- Running bandit calculations
- Serving variant assignments
- Dashboard/reporting

**Options (in order of preference):**
1. **Eliminai API endpoint** — add /api/cart-experiments/ routes to the existing Railway app. Zero new infra.
2. **Cloudflare Worker** — edge-deployed, fast, cheap. Good if we want to keep it separate.
3. **Shopify metafields + App Proxy** — no external infra but slow and limited.

**Recommended: Option 1** — the Eliminai app already runs on Railway, has a database, and handles Shopify webhooks.

#### Variant Assignment
When the cart drawer loads:
1. Check sessionStorage for existing variant assignment
2. If none, call backend: GET /api/cart-experiments/assign?store=xxx
3. Backend returns variant assignment based on current bandit weights (session_id + variants for scarcity, checkout_text, upsell_format, etc.)
4. Store in sessionStorage for the session
5. Cart JS applies the assigned variants

#### Upsell Rules Engine
Merchants configure upsell rules in the theme editor or a dashboard:
- WHEN customer adds [Product/Collection X]
- SHOW [Product Y] as upsell
- WITH format [inline/popup/banner]
- WITH message ["Complete the look" / "Pairs perfectly with..." / "Save $X"]

The system A/B tests which upsell product, format, and message converts best per trigger.

Over time, the engine learns: "When someone adds a black watch, showing the leather strap as an inline card with Complete the look converts 3x better than showing the watch case as a popup."

### Database Schema (for Eliminai app)

**CartExperiment**: id, tenantId, dimension, variantKey, variantConfig (JSON), alphaSuccesses (Beta alpha), betaFailures (Beta beta), observations, isActive, isWinner, createdAt, updatedAt

**CartEvent**: id, tenantId, sessionId, eventType, eventData (JSON), variantAssignment (JSON), cartValue (cents), itemCount, createdAt

**CartUpsellRule**: id, tenantId, triggerType, triggerValue, upsellProductHandle, upsellVariantId, format, message, isActive, priority, createdAt

**DailyExperimentReport**: id, tenantId, date, dimension, variantKey, impressions, conversions, conversionRate, revenue, confidence

### Revenue Impact Tracking
The ultimate metric is **revenue per session** (not just clicks):
- Conversion rate (sessions to checkouts)
- AOV (average order value)
- Revenue per session = conversion rate x AOV
- Upsell revenue attributed

A variant that converts slightly less but drives higher AOV can still win.

### Multi-Tenant SaaS Ready
Every experiment, event, and rule is scoped to tenantId. When this becomes a Shopify app:
- Each store gets its own experiments
- Cross-store learning (anonymized): "Countdown timers convert 23% better across 500 stores"
- New stores start with warm-start priors from aggregate data

### Implementation Phases

#### Phase 1: Event Tracking Foundation
- Add event tracking to cart JS (all events listed above)
- Batch and send to /api/cart-experiments/events
- Store in database. No A/B testing yet — just collect baseline data.

#### Phase 2: Scarcity A/B Testing
- Implement Thompson Sampling for scarcity dimension
- Variant assignment endpoint
- Cart JS applies assigned scarcity variant
- Daily aggregation job + simple dashboard

#### Phase 3: Checkout Button A/B Testing
- Add checkout button as a test dimension
- Test text, icons, emojis
- Track checkout click-through rate

#### Phase 4: Upsell Engine
- Upsell rules configuration
- Product-triggered upsells in cart drawer
- A/B test upsell products, formats, messages
- Full funnel tracking (shown > accepted > checked out)

#### Phase 5: Full Self-Learning
- All dimensions active simultaneously
- Multi-dimensional bandit (test combinations)
- Revenue-optimized, daily reports, auto-promote/retire

#### Phase 6: Cross-Store Intelligence
- Aggregate anonymized data across all stores
- Warm-start priors for new stores
- Industry benchmarks and recommendations
- The moat: more stores = more data = better optimization = more stores

### Competitive Landscape
- **ReConvert / AfterSell**: Post-purchase upsells only, no cart A/B testing
- **CartHook**: Pre-purchase offers but no self-learning
- **Rebuy**: Smart cart with recommendations but manual A/B testing
- **Bold Upsell**: Rule-based upsells, no optimization
- **None of them** have a self-learning multi-armed bandit that optimizes every cart element automatically

### The Moat
1. **Data flywheel**: More stores > more data > better priors > faster optimization > more stores
2. **Cross-store learning**: Every store learnings improve every other store
3. **Compounding returns**: The system gets smarter every day. Competitors need months to catch up.
4. **Full-stack integration**: We run the support AI too — correlate cart behavior with post-purchase support (returns, complaints) for true LTV optimization

---

## Git Workflow — MANDATORY (Prevents Lost Work)

### 2026-04-10 INCIDENT: Stashed work silently lost
A previous session stashed 954 lines of trust badges UI work, then a new session built 21 tasks of autopilot/timeline code on the OLD base without checking for stashes. The stashed work was invisible and effectively lost until manually recovered. **This must NEVER happen again.**

### Session Start Checklist — BEFORE ANY CODE CHANGE
Every new Claude session that will modify code MUST run these checks FIRST:

```bash
# 1. Check for stashed work (MOST COMMON cause of lost changes)
git stash list

# 2. Check for uncommitted changes
git status

# 3. Check for unmerged branches
git branch --no-merged master
```

**If stashes exist**: Pop or apply them BEFORE starting new work. If the stash conflicts with your planned work, tell Yoni and resolve together — NEVER just ignore stashes.

**If uncommitted changes exist**: Commit them or confirm with Yoni they should be discarded.

**If unmerged branches exist**: Merge them first or ask Yoni.

### NEVER Use git stash — Use Branches Instead

**`git stash` is BANNED in this project.** Stashes are invisible, unnamed, and easily forgotten. Use branches instead:

```bash
# WRONG — stash is invisible and will be forgotten
git stash

# RIGHT — branch is visible and named
git checkout -b wip/trust-badges-ui
git add -A && git commit -m "WIP: trust badges editing UI (in progress)"
git checkout master
```

Branches show up in `git branch`, `git log --all`, and deploy scripts. Stashes don't.

### Feature Branch Workflow

When implementing a new feature that touches files another feature may have changed:

1. **Create a feature branch** from master:
   ```bash
   git checkout -b feat/autopilot-timeline
   ```

2. **Do ALL work on the branch** — commit frequently

3. **Before merging to master**, check what's changed on master since you branched:
   ```bash
   git log master --oneline --not HEAD  # commits on master you don't have
   git diff master -- src/app/dashboard/addons/  # files that diverged
   ```

4. **Merge with review**:
   ```bash
   git checkout master
   git merge feat/autopilot-timeline
   # If conflicts: resolve carefully, NEVER just take "ours" or "theirs" blindly
   # After merge: run tsc + dev server to verify nothing broke
   ```

5. **After successful merge**: delete the branch
   ```bash
   git branch -d feat/autopilot-timeline
   ```

### Merge Conflict Rules

When resolving merge conflicts:

1. **NEVER blindly accept one side.** Always read BOTH sides and understand what each adds.
2. **If both sides ADD code** (new functions, new UI sections, new imports) — keep BOTH.
3. **If both sides MODIFY the same code differently** — ask Yoni which behavior wins.
4. **After every merge**: run `npx tsc --noEmit` and check the dev server. Type errors = broken merge.
5. **If a file changed significantly on both sides**: do the merge in a temporary file first, verify it compiles, THEN replace the original.

### Pre-Commit Safety Check

Before committing changes to files that are actively being developed (especially `page.tsx`, `addon-preview.tsx`):

```bash
# Verify no one else's work is pending
git stash list                    # must be empty
git branch --no-merged master     # should be empty or known
git diff --stat HEAD              # review what you're about to commit
```

### Multi-Session Handoff

When ending a session with unfinished work:
- **COMMIT to a named branch** (never stash)
- **Tell Yoni the branch name** and what's in it
- **Next session**: the branch will be visible and easy to merge

## Mistake Journal — Cart Drawer

- 2026-04-10: Previous session stashed 954 lines of trust badges UI work (addon-preview.tsx, page.tsx, cart-constants.ts, addon-definitions.ts), then new session built autopilot code on old base. Stash was invisible — checked git status (clean), git log (no mention), git diff (nothing). NEVER USE GIT STASH — use named branches instead. ALWAYS run `git stash list` at session start.
- 2026-04-10: 3-way merge of 1700+ line JSX file produced 5 conflicts. Agent resolved them but left duplicate code blocks and unclosed JSX tags. ALWAYS run `npx tsc --noEmit` after any merge and fix ALL errors before committing.
- 2026-04-10: `load()` useCallback had empty dependency array `[]` — captured STORE_ID as undefined and never re-ran. ALL useCallback/useEffect that reference STORE_ID MUST include it in their dependency array.
