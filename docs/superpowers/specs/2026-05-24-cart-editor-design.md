# Cart Editor — Design Spec

**Date:** 2026-05-24
**Status:** Design approved, awaiting spec review
**Owner:** Yoni

## 1. Problem & goal

Today's cart drawer dashboard has an Addons tab for enabling/disabling addons and an A/B Tests tab, but no place to edit the visuals of the cart itself — header text, checkout button color, milestone copy, totals layout, etc. Merchants can't customize without filing requests or editing code.

**Goal:** a new "Cart Editor" tab where the merchant clicks any element in a live preview, edits every meaningful setting in a right-side panel, and saves the result to push live to all shoppers.

**Non-goals:** This is not adding new addons (subscribe-save, quantity breaks, charity round-up, etc.). It is deeper settings control over what the cart already has, plus three explicitly requested new options (total outside checkout button, crossed-out compare-at price, "You saved" row).

## 2. Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Tab scope | New "Cart Editor" tab for visuals. Addons tab stays as the on/off + A/B testing catalog. |
| Interaction model | Two-column fixed split — preview left (~55%), settings panel right (~45%), always visible. |
| Save model | Manual "Save Changes" button. No auto-save. Navigating away with unsaved changes prompts confirm. |
| Viewport | Desktop + Mobile preview toggle at top of preview. |
| Hover/select feedback | Hover halo (dashed purple outline + floating label) + solid ring on selected element. |
| Tree sidebar | None. Preview-state dropdown above the preview ("Cart with items / Empty / Unlocked / Loading") gives access to hidden states. |
| New pricing options | Add as options. Defaults match current cart behavior. |
| Announcement bar | Becomes an Addon (lives in Addons tab, not Cart Editor). |
| Gift note field | Add as a Cart Editor option (under Line Item / Footer area). |

## 3. Architecture

### 3.1 Layout

```
┌──────────────────────────────┬──────────────────────────────┐
│  PREVIEW CANVAS (55%)        │  SETTINGS PANEL (45%)         │
│  ─────────────────           │  ─────────────────            │
│  [Desktop ▾] [Mobile]        │  Default: "Click an element   │
│  Preview state: [Items ▾]    │   in the preview to edit it." │
│                              │                                │
│  Real cart drawer DOM        │  When element selected,        │
│  (same HTML/CSS as           │  this panel becomes the        │
│  production v14-complete.js) │  editor for that element.      │
│  + overlay layer for         │                                │
│  hotspots / hover halo /     │  Discard | Save Changes        │
│  selection ring              │                                │
└──────────────────────────────┴──────────────────────────────┘
```

### 3.2 File layout (backend Next.js)

```
backend/src/app/dashboard/cart-editor/
├── page.tsx                          # the tab — top-level layout
├── preview-canvas.tsx                # mounts real cart DOM + overlay
├── overlay/
│   ├── hotspots.ts                   # element → CSS selector → label registry
│   ├── hover-halo.tsx                # dashed outline + label on hover
│   └── selection-ring.tsx            # solid ring on selected
├── element-editors/
│   ├── header-editor.tsx
│   ├── milestone-editor.tsx
│   ├── line-item-editor.tsx
│   ├── empty-state-editor.tsx
│   ├── footer-editor.tsx
│   ├── checkout-button-editor.tsx
│   ├── trust-line-editor.tsx
│   └── global-style-editor.tsx
├── draft-store.ts                    # React Context — draft, savedConfig, isDirty, setField, discard, save
├── schema.ts                         # Zod schema for editorOverrides
└── api-client.ts                     # GET/PUT wrappers
```

### 3.3 Reuse, not reinvent

Preview must render **the same** HTML/CSS as production. Reuse the existing `cart-constants.ts` (REAL_CART_CSS + CONTROL_HTML) plus a new "Cart Editor preview renderer" that walks `editorOverrides` and outputs the cart HTML the way v14-complete.js would in the browser.

No iframe. No mock. Same DOM. The overlay is a sibling div positioned via `getBoundingClientRect()` — it never touches the cart DOM tree.

## 4. Data model

Add a single nullable JSON column to `CartConfig`:

```prisma
model CartConfig {
  // existing fields ...
  editorOverrides Json?  // typed via Zod
}
```

Why one nested JSON column:
- Additive — new fields require no schema migration
- Maps cleanly to the editor section model
- Doesn't touch existing addon / A/B test data
- Read by v14-complete.js via the existing `/apps/eliminai/config` proxy

### 4.1 Shape (Zod-validated)

```ts
type EditorOverrides = {
  header?: {
    title?: string;
    showItemCountBadge?: boolean;
    badgeColor?: string;
    closeIcon?: 'x' | 'chevron' | 'arrow';
    bgColor?: string;
    borderStyle?: 'none' | 'line' | 'shadow';
    padding?: 'compact' | 'comfortable' | 'roomy';
  };
  milestoneBar?: {
    enabled?: boolean;
    tiers?: Array<{ threshold: number; rewardLabel: string; rewardIcon: string }>;
    preUnlockTemplate?: string;
    unlockedTemplate?: string;
    celebrationAnim?: boolean;
    fillColor?: string; trackColor?: string; height?: number;
    position?: 'top' | 'underHeader' | 'aboveCheckout';
    textSize?: number; textWeight?: number;
  };
  lineItem?: {
    imageSize?: 'S' | 'M' | 'L';
    imageShape?: 'square' | 'rounded' | 'circle';
    showVariant?: boolean; showSku?: boolean;
    qtyControl?: 'minusPlus' | 'stepper' | 'dropdown';
    removeStyle?: 'x' | 'trash' | 'text';
    showCompareAtPrice?: boolean;   // NEW
    showSavingsBadge?: boolean;
    separator?: 'line' | 'spacing' | 'card';
    titleSize?: number; titleWeight?: number;
  };
  emptyState?: {
    heading?: string; subtext?: string;
    icon?: string;
    ctaLabel?: string; ctaLink?: string;
    ctaInheritsCheckoutStyle?: boolean;
  };
  footer?: {
    showSubtotal?: boolean;
    showShippingNote?: boolean;
    showTaxNote?: boolean;
    showYouSaved?: boolean;             // NEW
    showCrossedOutSubtotal?: boolean;   // NEW
    totalOutsideButton?: boolean;       // NEW
    totalLabel?: string;
    totalSize?: number; totalWeight?: number;
    bgStyle?: 'transparent' | 'surface' | 'accent';
    borderTop?: 'none' | 'line' | 'shadow';
    showGiftNote?: boolean;             // gift note field toggle
  };
  checkoutButton?: {
    label?: string;
    bgColor?: string; bgHoverColor?: string; textColor?: string;
    radius?: 'sharp' | 'soft' | 'rounded' | 'pill';
    height?: 'S' | 'M' | 'L' | 'XL';
    fontWeight?: number; letterSpacing?: number;
    icon?: 'none' | 'arrow' | 'lock' | 'cart';
    fullWidth?: boolean;
    loadingAnim?: 'spinner' | 'dots' | 'shimmer';
  };
  trustLine?: {
    enabled?: boolean;
    text?: string; showLockIcon?: boolean;
    paymentIcons?: Record<string, boolean>;
    position?: 'above' | 'below';
    textSize?: number; textColor?: string;
  };
  global?: {
    side?: 'left' | 'right';
    widthDesktop?: number;  // 320–800px
    widthMobilePct?: number; // 50–100
    backdropColor?: string; backdropOpacity?: number; // 0–1
    openAnim?: 'slide' | 'fade' | 'scale';
    openDurationMs?: number; // 100–600
    palette?: {
      bg?: string; surface?: string; text?: string; muted?: string;
      accent?: string; border?: string; success?: string; danger?: string;
    };
    fontFamily?: string;
    baseFontSize?: number; headingScale?: number;
    spacing?: 'compact' | 'comfortable' | 'roomy';
    radius?: 'sharp' | 'soft' | 'rounded';
    customCss?: string;
  };
};
```

### 4.2 Render contract

Every field is **optional**. v14-complete.js renders each part with:

```js
var headerTitle = (cfg.editorOverrides?.header?.title) || 'Your Cart';
```

When `editorOverrides` is `null`, `undefined`, or `{}`, the cart renders identically to today. This is the regression guarantee.

## 5. Click-to-edit mechanic

### 5.1 Hotspot registry

```ts
const HOTSPOTS = [
  { id: 'header',         selector: '.ccd-header',       label: 'Header' },
  { id: 'milestoneBar',   selector: '#ccd-progress',     label: 'Free Shipping Bar' },
  { id: 'lineItem',       selector: '.cart__item',       label: 'Line Item' },
  { id: 'emptyState',     selector: '.ccd-empty',        label: 'Empty State' },
  { id: 'footer',         selector: '.ccd-footer-totals',label: 'Totals' },
  { id: 'checkoutButton', selector: '.ccd-checkout-btn', label: 'Checkout Button' },
  { id: 'trustLine',      selector: '.ccd-trust',        label: 'Trust Line' },
  { id: 'global',         selector: '.ccd-drawer-bg',    label: 'Cart Style' },
];
```

### 5.2 Overlay rendering

- `mousemove` over preview → `document.elementsFromPoint(x,y)` → first match in hotspot registry → render hover halo (dashed purple outline + floating label) positioned via `getBoundingClientRect()`
- `click` → dispatch `selectElement(id)` → right panel swaps editor → selection ring rendered (solid purple)
- Click outside any hotspot → deselect
- `ResizeObserver` on preview container → recompute positions on layout change
- Preview-state dropdown change (Items / Empty / Unlocked / Loading) → cart DOM rebuilds → hotspot lookups re-run

### 5.3 Why an overlay, not direct listeners

- Cart DOM stays byte-identical to production (no event-handler pollution)
- Overlay is removable in one line if we ever need to disable editor mode
- Same approach used by Figma, Webflow — proven pattern

## 6. Save flow

### 6.1 Edit → preview update (instant, no network)

```
[User edits a field in right panel]
        │
        ▼
[draftStore.setField(path, value)]
        │ draft = {...draft, [path]: value}; isDirty = true
        ▼
[preview-canvas re-renders cart DOM using draft]  ◄── < 50 ms
```

### 6.2 Save → push live

```
[Save Changes click]
        │
        ▼
[Zod validate draft.editorOverrides]
        │ on fail → toast + auto-open offending element editor
        │ on pass → continue
        ▼
[PUT /api/cart-editor/config  body: { editorOverrides: draft }]
        │
        ▼
[Backend: prisma.cartConfig.update({ data: { editorOverrides, updatedAt: now } })]
        │
        ▼
[Cache invalidation: bump in-memory + edge config cache key for this store]
        │
        ▼
[Response 200 → draftStore: savedConfig = draft, isDirty = false]
        │
        ▼
[Toast: "Saved. Live in shoppers' carts on next open."]
```

### 6.3 Discard

`draftStore.discard()` → `draft = savedConfig; isDirty = false`. No network call.

### 6.4 Navigation guard

If `isDirty === true` and user clicks another tab / closes browser → confirm modal "You have unsaved changes — discard?" (matches existing dashboard pattern used by rich-text-editor and scarcity-timer-editor).

### 6.5 Validation rules

- Hex colors: `/^#[0-9a-f]{6}$/i`
- Drawer width desktop: 320–800
- Drawer width mobile: 50–100
- Backdrop opacity: 0–1
- Open duration: 100–600 ms
- Base font size: 10–24
- Heading scale: 1.0–1.8
- All strings: max 200 chars (header title, button label, milestone templates)
- Custom CSS: max 5000 chars, server-side strip of `<script>` / `javascript:` patterns
- Unknown keys: stripped silently by Zod

## 7. Error handling

| Failure | Handling |
|---|---|
| Save API 500 | Toast "Save failed — please retry". Draft preserved. isDirty stays true. |
| Save API network error | Same as above. No silent loss. |
| Validation rejection | Toast names the field. Editor auto-opens that element. Draft preserved. |
| Preview render crash | React error boundary around preview only. Shows "Preview unavailable — settings still save correctly." Right panel stays usable. |
| Cart DOM resize during edit | ResizeObserver recomputes overlay positions on next frame. |
| Concurrent save from another tab | `updatedAt` mismatch on PUT → 409 conflict → toast "Cart settings changed elsewhere — refresh to see latest." |

## 8. Testing strategy

Five layers, gating every commit. ALL must pass before merge.

### 8.1 Contract tests (static analysis of v14-complete.js)

Add to `tests/contract.test.js` — one test per editorOverrides field, verifying:
- The field is read from `cfg.editorOverrides?.<path>`
- The default-fallback value still exists in the code
- Missing/null editorOverrides falls back to current behavior

Estimate: ~60 new contract tests.

### 8.2 Regression tests (existing cart must not break)

ALL 245 existing contract tests + 124 behavior-shield tests + 30 bug-regression tests must keep passing. Specifically locked:
- Empty cart hides upsells (recent fix)
- ATC + qty operations preserve discount math
- Free shipping progress recalc on remove
- Checkout button label without total (current default)
- All 14 mandatory cart rules from project memory
- No collision with addon settings (`editorOverrides` is a separate key from `addons`)

### 8.3 Editor unit tests (`backend/__tests__/cart-editor.test.ts`)

```
describe('draft store')
  test setField updates path and marks dirty
  test discard reverts to savedConfig
  test save clears dirty
  test concurrent setField on different paths merges correctly

describe('Zod schema')
  test rejects invalid hex
  test rejects drawer width 100
  test rejects drawer width 1200
  test strips unknown keys
  test allows partial overrides (header only)
  test allows empty object

describe('PUT /api/cart-editor/config')
  test writes editorOverrides only
  test bumps updatedAt for cache busting
  test does not touch addons or abTests fields
  test 409 on stale updatedAt
  test 401 on no session
  test sanitizes customCss (strips <script>)
```

Estimate: ~25 new editor tests.

### 8.4 Preview integration tests (`tests/cart-editor-preview.spec.js` via Playwright)

```
test click Header → right panel shows Header editor
test change header.title → preview text updates in <500ms (no network)
test Save → reload → preview shows persisted value
test navigate away with isDirty → confirm modal appears
test preview state dropdown → empty state DOM mounts → click empty CTA → editor opens
test desktop ↔ mobile viewport toggle → cart width changes
test hover halo follows cursor as user moves mouse
test selection ring stays after click, disappears on click-outside
```

Estimate: ~10 Playwright tests.

### 8.5 Blast-radius lock tests

Per CLAUDE.md blast-radius-shield rule. Verifying:
- v14-complete.js with `editorOverrides = null` → byte-identical drawer HTML to current
- v14-complete.js with `editorOverrides = {}` → byte-identical drawer HTML to current
- Adding `editorOverrides = { footer: { totalOutsideButton: true } }` → only footer/button DOM changes, nothing else moves
- All addon code paths still inject correctly

### 8.6 CI gate

Pre-commit + pre-deploy:
1. `npm test` — full suite (~450 tests after additions)
2. `tsc --noEmit`
3. `node tests/contract.test.js` — static analysis on v14-complete.js
4. Playwright suite on cart-editor-preview

## 9. Rollout plan

Stage 1 — Backend + data model (no UI yet)
- Add `editorOverrides` column + Zod schema + GET/PUT API
- Deploy with API behind a feature flag (`CART_EDITOR_API_ENABLED`)
- Contract tests + unit tests passing

Stage 2 — v14-complete.js reads overrides
- Add fallback reads for every field
- Contract tests verify all fields wired
- Deploy to extension CDN
- Smoke test: set `editorOverrides = null` in DB → cart byte-identical to before

Stage 3 — Editor UI
- Build preview-canvas + overlay + element-editors
- Draft store + Save/Discard
- Playwright suite passing
- Ship Cart Editor tab in dashboard

Stage 4 — Documentation + competitor parity check
- Internal docs on each setting
- Confirm parity with Rebuy / SLIDECART / UpCart for any settings we missed

## 10. Out of scope (deferred to later phases)

- Subscribe-and-save inline toggle
- Quantity-break ladder
- Charity round-up
- Tiered free gift unlock
- Recently viewed products row
- Sticky upsell carousel pinned above checkout button
- Multi-language UI for the editor itself
- Theme presets (save/load named configurations)
- Per-customer-segment overrides

## 11. Open questions

None at design time. Implementation may surface micro-decisions; those will be resolved in the plan phase.

---

End of design spec.
