# Cart Addons Page - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build Addons page: toggle 6 cart features, customize with live preview, Auto-Optimize or Lock mode.

**Architecture:** Full-width expandable addon cards. 3-way toggle, inline edit controls, iframe cart preview. Config in Store.config JSON.

**Tech Stack:** Next.js 14, React inline styles, Prisma PostgreSQL, iframe srcdoc preview.

**File Write Constraint:** Use Bash/Node.js scripts only. Edit/Write tools blocked by hook.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| src/lib/addon-definitions.ts | Addon metadata, dimensions, defaults, impact, testable flags |
| src/app/api/stores/[id]/addons/route.ts | GET full addons config, PATCH individual addon |
| src/app/api/stores/[id]/addons/reorder-queue/route.ts | POST reorder optimization queue |
| src/app/api/stores/[id]/addons/apply-recommended/route.ts | POST apply recommended setup |
| src/app/dashboard/addons/page.tsx | Addons page: header, queue, recommended banner, card list |
| src/app/dashboard/addons/addon-preview.tsx | Focused + full cart preview via iframe srcdoc |

### Modified Files
| File | Change |
|------|--------|
| src/app/dashboard/layout.tsx | Add sidebar navigation with Addons tab |

---

## Chunk 1: Addon Definitions + API Layer

### Task 1: Addon Definitions Module

**Files:** Create: src/lib/addon-definitions.ts

Defines all 6 addons with metadata, editable dimensions, defaults, estimated impact.
Each dimension flagged testable: true/false (engine respects never-tested fields).

Exports:
- AddonDimension interface (key, label, type, testable, options, default)
- AddonDefinition interface (key, label, icon, description, estimatedImpact, dimensions, defaultConfig)
- ADDON_DEFINITIONS array:
  1. trustBadges: style(testable), text(testable), position(testable), icons(NEVER tested)
  2. scarcityTimer: textTemplate(testable), duration(testable), style(testable), position(testable)
  3. shippingProtection: price(NEVER), description(testable), defaultOn(testable), style(testable)
  4. freeShippingBar: threshold(NEVER), textTemplate(testable), style(testable), position(testable)
  5. upsellRecommendations: source(NEVER), headline(testable), layout(testable), position(testable)
  6. socialProof: textTemplate(testable), style(testable), position(testable)
- getAddonDefinition(key) helper
- getDefaultAddonsConfig() returns all addons disabled with default configs

Dimension types: select, text, number, checkboxes, toggle.

- [ ] Step 1: Write addon-definitions.ts via Node.js script
- [ ] Step 2: Verify tsc --noEmit passes
- [ ] Step 3: Commit

### Task 2: Addons API - GET + PATCH

**Files:** Create: src/app/api/stores/[id]/addons/route.ts

GET returns: { addons, optimizeQueue, definitions }
PATCH accepts: { addonKey, enabled?, mode?, config? }
- Merges into Store.config JSON
- Off: resets mode, clears optimizeState
- Lock: clears optimizeState
- Auto-optimize: initializes optimizeState with queue position + step counts

- [ ] Step 1: Write route file
- [ ] Step 2: Test GET with curl
- [ ] Step 3: Test PATCH: enable trust badges locked
- [ ] Step 4: Commit

### Task 3: Queue Reorder + Apply Recommended APIs

**Files:** Create reorder-queue/route.ts + apply-recommended/route.ts

Reorder: POST { queue: string[] }, updates positions + statuses
Recommended: POST enables trustBadges+freeShippingBar+scarcityTimer with auto-optimize

- [ ] Step 1: Write reorder-queue route
- [ ] Step 2: Write apply-recommended route
- [ ] Step 3: Test with curl
- [ ] Step 4: Commit

---

## Chunk 2: Dashboard Navigation + Addons Page

### Task 4: Sidebar Navigation

**Files:** Modify: src/app/dashboard/layout.tsx

Add 220px dark sidebar (#111827) with Overview + Addons nav links.
Active highlighting via usePathname(). use client required.

- [ ] Step 1: Write updated layout.tsx
- [ ] Step 2: Verify sidebar at localhost:3020/dashboard
- [ ] Step 3: Commit

### Task 5: Addons Page with Full Card System

**Files:** Create: src/app/dashboard/addons/page.tsx

All-in-one page for MVP. Structure:
1. Header with active/optimizing badges
2. Recommended Setup banner (when no addons enabled)
3. Optimization Queue bar (when queue non-empty)
4. Sorted addon cards: active optimize > queued > locked > on > off

Card collapsed: icon, name, status badge, impact estimate, Edit link, toggle
Card expanded: 2-col grid (preview left, controls right, mode buttons bottom)
Edit controls auto-generated from definitions (select/text/number/checkboxes/toggle)
Never-tested dimensions show warning badge.

State: GET on mount, PATCH on changes, POST for recommended.
Toggle: OFF->ON enables locked+defaults+expands. ON->OFF disables+collapses.
Auto-Optimize: sets mode, queues. Lock: sets mode, blue border.

Store ID: cmnriegez0000jc70ro9nltw2

- [ ] Step 1: Write page.tsx
- [ ] Step 2: Verify page loads
- [ ] Step 3: Test toggles
- [ ] Step 4: Test edit controls
- [ ] Step 5: Test mode buttons
- [ ] Step 6: Test recommended
- [ ] Step 7: Commit

---

## Chunk 3: Cart Preview Integration

### Task 6: Addon Cart Preview

**Files:** Create addon-preview.tsx, extend _build-cart-preview.js

Iframe srcdoc with REAL_CART_CSS + CONTROL_HTML from build script.
Focused mode (default): fixed height, scrolls to addon area.
Full cart mode: Preview Full Cart button expands.

Focus areas: trustBadges 220px, shippingProtection 160px, scarcityTimer 180px,
freeShippingBar 180px, upsellRecommendations 200px, socialProof 160px.

Trust badges fully functional: builds HTML from config.icons/text/style.
NO dashed borders (user requirement). Other addons: placeholder for MVP.

Add placeholders to cart-html-control.html: SCARCITY_TIMER_PLACEHOLDER,
UPSELL_PLACEHOLDER, SOCIAL_PROOF_PLACEHOLDER.

- [ ] Step 1: Add HTML placeholders
- [ ] Step 2: Extend build script
- [ ] Step 3: Run build: node _build-cart-preview.js
- [ ] Step 4: Wire into page.tsx
- [ ] Step 5: Test trust badges preview
- [ ] Step 6: Test full cart toggle
- [ ] Step 7: Commit

---

## Chunk 4: Polish + Deploy

### Task 7: Polish

- [ ] Step 1: 300ms debounced text/number saves
- [ ] Step 2: Smooth expand/collapse
- [ ] Step 3: E2E walkthrough (6 cards, recommended, toggle, edit, lock, optimize, queue)
- [ ] Step 4: Fix issues + commit

### Task 8: Deploy

- [ ] Step 1: npx tsc --noEmit
- [ ] Step 2: railway up --detach
- [ ] Step 3: Verify production
- [ ] Step 4: Tag addons-page-v1
