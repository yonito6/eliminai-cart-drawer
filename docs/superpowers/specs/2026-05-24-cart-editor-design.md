# Cart Editor — Design Spec

**Date:** 2026-05-24
**Status:** Rev 4 — UpCart parity pass: 4 new addons added (notes, discountCode, termsCheckbox, expressPayments). Sticky-launcher and header-logo deferred.
**Owner:** Yoni

## 1. Problem & goal

Today's cart drawer dashboard has an Addons tab for enabling/disabling addons and an A/B Tests tab, but no place to edit the visuals of the cart itself — header text, checkout button color, milestone copy, totals layout, etc. Merchants can't customize without filing requests or editing code.

**Goal:** a new "Cart Editor" tab where the merchant clicks any element in a live preview, edits every meaningful setting in a right-side panel, and saves the result to push live to all shoppers. Clicking elements that are owned by an Addon (milestone, trust line, notes, discount code, terms, express payments) opens the relevant Addon editor instead of a Cart-Editor-only editor — single source of truth per concept.

**Non-goals (v1):**
- Custom HTML / Custom CSS / JavaScript merchant escape hatch (security review required)
- Sticky cart launcher button on the storefront (the floating pill OUTSIDE the drawer)
- Header logo upload
- Subscribe-and-save inline toggle, quantity-break ladder, charity round-up, tiered free gift unlock, recently-viewed row, sticky pinned upsell carousel
- Theme presets, per-segment overrides, multi-language UI for the editor

## 2. Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Tab scope | New "Cart Editor" tab for visuals. Addons tab stays as the on/off + A/B testing catalog. |
| Interaction model | Two-column fixed split — preview left (~55%), settings panel right (~45%), always visible. |
| Save model | Manual "Save Changes" button. No auto-save. Navigating away with unsaved changes prompts confirm. |
| Viewport | Desktop + Mobile preview toggle at top of preview. |
| Hover/select feedback | Hover halo (dashed purple outline + floating label) + solid ring on selected element. |
| Tree sidebar | None. Preview-state dropdown above the preview ("Cart with items / Empty / Unlocked / Loading") gives access to hidden states. |
| New pricing options | `totalOutsideButton`, `showCrossedOutSubtotal`, `showYouSaved` added as options. Defaults match current cart behavior. |
| Announcement bar | Becomes an Addon (lives in Addons tab, not Cart Editor). |
| Gift note field | Replaced by generic `notes` Addon (see §4.4). |
| Custom CSS | **Out of scope for v1.** Security review required first. Deferred. |
| Sticky cart launcher button | **Out of scope for v1.** Lives outside drawer, separate concern. |
| Header logo upload | **Out of scope for v1.** Headline + close button only in v1. |
| 4 new addons in this spec | `notes`, `discountCode`, `termsCheckbox`, `expressPayments` — built in same pass as Cart Editor. |
| Click-routing for addon-owned elements | Clicking footer's notes/discount/terms/express-pay area in Cart Editor preview → opens the relevant Addon's editor panel directly (deep-link). |
| Ownership of overlapping fields | Addons own: enabled toggles, functional fields (tiers, providers list, char limits, etc.). Cart Editor owns: visual-only style. See §4.3 Ownership map. |

## 3. Architecture

### 3.1 Layout

```
┌──────────────────────────────┬──────────────────────────────┐
│  PREVIEW CANVAS (55%)        │  SETTINGS PANEL (45%)         │
│  ─────────────────           │  ─────────────────            │
│  [Desktop ▾] [Mobile]        │  Default: "Click an element   │
│  Preview state: [Items ▾]    │   in the preview to edit it." │
│                              │                                │
│  Real cart drawer DOM        │  When element selected:        │
│  (same HTML/CSS as           │   - Cart-Editor-owned element  │
│  production v14-complete.js) │     → editor renders inline    │
│  + overlay layer for         │   - Addon-owned element        │
│  hotspots / hover halo /     │     → deep-link to Addon tab    │
│  selection ring              │       with that addon expanded │
│                              │                                │
│                              │  Discard | Save Changes        │
└──────────────────────────────┴──────────────────────────────┘
```

### 3.2 File layout (backend Next.js)

```
backend/src/app/dashboard/cart-editor/
├── page.tsx                          # the tab — top-level layout
├── preview-canvas.tsx                # mounts real cart DOM + overlay
├── overlay/
│   ├── hotspots.ts                   # element → CSS selector → label → routing target
│   ├── hover-halo.tsx                # dashed outline + label on hover
│   └── selection-ring.tsx            # solid ring on selected
├── element-editors/
│   ├── header-editor.tsx
│   ├── milestone-editor.tsx          # visual-only; copy/tier fields deep-link to Addons
│   ├── line-item-editor.tsx
│   ├── empty-state-editor.tsx
│   ├── footer-editor.tsx
│   ├── checkout-button-editor.tsx
│   ├── trust-line-editor.tsx         # visual-only; payment providers deep-link to Addons
│   └── global-style-editor.tsx
├── addon-deep-link.tsx               # renders "Edit in Addons →" CTA + opens Addons tab with addon expanded
├── draft-store.ts                    # React Context — draft, savedConfig, isDirty, setField, discard, save
├── schema.ts                         # Zod schema for editorOverrides
└── api-client.ts                     # GET/PUT wrappers
```

New addon editors (lib `addon-definitions.ts` + UI in existing addons tab):
```
backend/src/app/dashboard/addons/
├── notes-addon-editor.tsx              # NEW
├── discount-code-addon-editor.tsx      # NEW
├── terms-checkbox-addon-editor.tsx     # NEW
└── express-payments-addon-editor.tsx   # NEW
```

### 3.3 Reuse, not reinvent

Preview must render **the same** HTML/CSS as production. Reuse the existing `cart-constants.ts` (REAL_CART_CSS + CONTROL_HTML) plus a new "Cart Editor preview renderer" that walks `editorOverrides` and outputs the cart HTML the way v14-complete.js would in the browser.

No iframe. No mock. Same DOM. The overlay is a sibling div positioned via `getBoundingClientRect()` — it never touches the cart DOM tree.

## 4. Data model

Add two columns to `CartConfig`:

```prisma
model CartConfig {
  // existing fields ...
  editorOverrides         Json?  // typed via Zod; null = render with current defaults
  editorOverridesVersion  Int    @default(0)  // monotonic, bumped on every save; cache key + If-Match
}
```

(Already merged in `claude/cart-editor` branch.)

### 4.1 EditorOverrides shape (Zod-validated)

```ts
type EditorOverrides = {
  schemaVersion: 1;
  header?: {
    title?: string;                                 // supports {{cart_quantity}} token
    titleAlignment?: 'side' | 'center';
    showItemCountBadge?: boolean;
    badgeColor?: string;
    closeIcon?: 'x' | 'chevron' | 'arrow';
    closeButton?: {
      position?: 'left' | 'right';
      iconSize?: 'S' | 'M' | 'L';
      strokeWeight?: 'normal' | 'thick';
      border?: 'none' | 'thin' | 'normal' | 'thick';
      bgColor?: string;
      bgHoverColor?: string;
      iconColor?: string;
      borderColor?: string;
      borderHoverColor?: string;
    };
    bgColor?: string;
    borderStyle?: 'none' | 'line' | 'shadow';
    padding?: 'compact' | 'comfortable' | 'roomy';
    heightPreset?: 'slim' | 'tall';
    headingLevel?: 'h2' | 'h3' | 'h4';            // semantic level for a11y
    titleFontSize?: number;                        // 14–48
    titleFontWeight?: 'normal' | 'semibold' | 'bold';
    titleColor?: string;
  };
  milestoneBar?: {
    // visual-only — tiers/threshold/enabled live in Addon
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
    showCompareAtPrice?: boolean;
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
    showYouSaved?: boolean;
    showCrossedOutSubtotal?: boolean;
    totalOutsideButton?: boolean;
    totalLabel?: string;
    totalSize?: number; totalWeight?: number;
    bgStyle?: 'transparent' | 'surface' | 'accent';
    borderTop?: 'none' | 'line' | 'shadow';
    stickyFooter?: boolean;                        // explicit toggle (default true)
    // NOTE: notes / discountCode / termsCheckbox / expressPayments are Addons.
    //       Cart Editor does NOT mirror their config here.
    //       Clicking those areas in preview deep-links to the Addon editor.
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
    // visual-only — payment provider list lives in Addon
    text?: string; showLockIcon?: boolean;
    paymentIconsVisible?: Record<string, boolean>;  // override-hide per provider
    position?: 'above' | 'below';
    textSize?: number; textColor?: string;
  };
  global?: {
    side?: 'left' | 'right';
    widthDesktop?: number;
    widthMobilePct?: number;
    backdropColor?: string; backdropOpacity?: number;
    openAnim?: 'slide' | 'fade' | 'scale';
    openDurationMs?: number;
    palette?: {
      bg?: string; surface?: string; text?: string; muted?: string;
      accent?: string; border?: string; success?: string; danger?: string;
    };
    fontFamily?: string;
    baseFontSize?: number; headingScale?: number;
    spacing?: 'compact' | 'comfortable' | 'roomy';
    radius?: 'sharp' | 'soft' | 'rounded';
    behavior?: {
      openOnAddToCart?: boolean;             // default true
      autoCloseOnCheckout?: boolean;         // default true
      bodyScrollLock?: boolean;              // default true
      mobileFullscreen?: boolean;            // default false
      hideOnPages?: string[];                // page-path glob patterns
    };
  };
};
```

### 4.2 Render contract

Every field is **optional**. v14-complete.js renders each part with a default fallback. When `editorOverrides` is `null`, `undefined`, or `{}`, the cart renders identically to today.

### 4.3 Ownership map (Addon settings vs Cart Editor overrides)

| Concept | Owner | Field path |
|---|---|---|
| Free-shipping milestone enabled toggle | Addons | `addons.milestone.enabled` |
| Milestone tiers (threshold, reward label, icon) | Addons | `addons.milestone.tiers[]` |
| Milestone copy templates | Cart Editor | `editorOverrides.milestoneBar.preUnlockTemplate / unlockedTemplate` |
| Milestone visual style | Cart Editor | `editorOverrides.milestoneBar.{fillColor, trackColor, height, textSize, position}` |
| Trust line enabled | Addons | `addons.trustLine.enabled` |
| Payment providers list (which exist) | Addons | `addons.trustLine.providers[]` |
| Per-icon visible override + text + lock + position | Cart Editor | `editorOverrides.trustLine.*` |
| **Notes addon enabled + label + placeholder + maxChars** | Addons | `addons.notes.*` |
| **Discount code addon enabled + placeholder + applyButtonLabel** | Addons | `addons.discountCode.*` |
| **Terms checkbox addon enabled + labelHtml + errorMessage + required** | Addons | `addons.termsCheckbox.*` |
| **Express payments enabled + providers + position + layout** | Addons | `addons.expressPayments.*` |

**Validation rule (server-side):** PUT `/api/cart-editor/config` returns 400 if the body contains any Addon-owned path. Zod strips unknown keys; an explicit pre-validation check names conflicts in the error message.

**Read-side merge in v14-complete.js:** Addon-owned fields render directly from `cfg.addons.*`. Cart Editor visual fields layer on top via CSS variable injection. If an addon is disabled, Cart Editor's visual settings for that area render nothing (Addon visibility wins).

**Cart Editor UI behavior when an addon is disabled:** Cart Editor visual fields stay editable. Preview shows nothing (matches shopper reality). Inline notice: "This addon is currently disabled in the Addons tab. [Go to Addons]"

### 4.4 The 4 new Addons (added in this pass)

#### 4.4.1 `notes` addon

```ts
type NotesAddonConfig = {
  enabled: boolean;            // default false
  label: string;               // default "Add a note to your order"
  placeholder: string;         // default ""
  maxChars: number;            // 0–1000; default 250; 0 = unlimited
  position: 'top' | 'bottom'; // within footer; default 'bottom'
  // Visual fields editable in Cart Editor footer section:
  // bgColor, borderColor, fontSize, labelColor (handled via editorOverrides.footer or CSS vars)
};
```

Renders in cart DOM as `<div class="ccd-notes-row">` with a `<textarea name="cart_attributes[note]">`. Value flows to Shopify cart note via existing cart API.

#### 4.4.2 `discountCode` addon

```ts
type DiscountCodeAddonConfig = {
  enabled: boolean;                  // default false
  placeholder: string;               // default "Discount code"
  applyButtonLabel: string;          // default "Apply"
  position: 'top' | 'bottom';        // within footer; default 'bottom'
  showAppliedBadge: boolean;         // default true
};
```

Renders `<form class="ccd-discount-row">` with input + apply button. Apply triggers POST to `/discount/<code>` (Shopify standard). Applied discounts show as badges with remove ⓧ.

#### 4.4.3 `termsCheckbox` addon

```ts
type TermsCheckboxAddonConfig = {
  enabled: boolean;                  // default false
  labelHtml: string;                 // default 'I agree to the <a href="/policies/terms-of-service">Terms</a>'
                                     // Sanitized: only <a href target rel> tags allowed; max 500 chars
  errorMessage: string;              // default "Please agree to the terms"
  required: true;                    // hardcoded — addon exists for required agreements only
  blockCheckoutIfUnchecked: boolean; // default true; if false, just warns
  position: 'aboveCheckoutButton';   // only valid position; hardcoded
};
```

Renders `<label class="ccd-terms-row"><input type="checkbox">...labelHtml...</label>`. When unchecked + `blockCheckoutIfUnchecked`, checkout button click is intercepted, `errorMessage` shows below, scroll-to-checkbox.

**Security:** `labelHtml` is sanitized server-side (DOMPurify-equivalent) — only `<a>` tags with `href`, `target`, `rel` attributes; `javascript:` and `data:` hrefs rejected.

#### 4.4.4 `expressPayments` addon

```ts
type ExpressPaymentsAddonConfig = {
  enabled: boolean;                  // default true (Shopify already shows these by default)
  providers: {                       // CSS show/hide flags; native Shopify express checkout still runs
    shopPay: boolean;                // default true
    googlePay: boolean;              // default true
    paypal: boolean;                 // default true
    applePay: boolean;               // default true
    amazonPay: boolean;              // default false
    metaPay: boolean;                // default false
  };
  position: 'above' | 'below';       // relative to checkout button; default 'above'
  layout: 'stacked' | 'row';         // default 'stacked'
  separatorLabel: string;            // default "or"; '' to hide
};
```

**Mechanism:** native Shopify express-checkout markup stays. Our v14-complete.js sets CSS variables:

```js
root.style.setProperty('--ccd-show-shop-pay', cfg.addons.expressPayments.providers.shopPay ? 'flex' : 'none');
// ...repeat per provider
```

```css
[data-shopify-express-pay="shopPay"] { display: var(--ccd-show-shop-pay, flex); }
/* etc. — one rule per provider */
```

Hidden buttons don't break the underlying Shopify express checkout — they're just visually removed. Visible buttons still trigger Shopify's real express checkout flow.

If we cannot reliably target Shopify's native express markup (selector changes across themes), the fallback is to render our OWN express button container that calls Shopify's express checkout JS API directly. This branch is documented in the implementation plan.

### 4.5 Click-to-edit deep-linking

When the user clicks a footer region whose underlying feature is an Addon (notes / discount / terms / express-pay), the Cart Editor right panel renders an `<AddonDeepLink>` component:

```
┌──────────────────────────────────┐
│  📦 Notes Addon                   │
│                                    │
│  This feature lives in the        │
│  Addons tab.                       │
│                                    │
│  [ Edit Notes Settings →  ]       │
└──────────────────────────────────┘
```

Click → router navigates to `/dashboard/addons?expand=notes` (Addons tab opens with the relevant addon's editor already expanded). Cart Editor draft state is preserved (sessionStorage).

The same deep-link pattern applies to milestone (clicking the milestone bar with intent to change tiers — visual fields edit inline, tier/threshold deep-link).

## 5. Click-to-edit mechanic

### 5.1 Hotspot registry

```ts
const HOTSPOTS = [
  { id: 'header',         selector: '.ccd-header',         label: 'Header',           target: 'inline' },
  { id: 'milestoneBar',   selector: '#ccd-progress',       label: 'Free Shipping Bar',target: 'inline+deepLink' },
  { id: 'lineItem',       selector: '.ccd-item',           label: 'Line Item',        target: 'inline' },
  { id: 'emptyState',     selector: '.ccd-empty',          label: 'Empty State',      target: 'inline' },
  { id: 'footerNotes',    selector: '.ccd-notes-row',      label: 'Notes',            target: 'deepLink:notes' },
  { id: 'footerDiscount', selector: '.ccd-discount-row',   label: 'Discount Code',    target: 'deepLink:discountCode' },
  { id: 'footerTerms',    selector: '.ccd-terms-row',      label: 'Terms Checkbox',   target: 'deepLink:termsCheckbox' },
  { id: 'footerExpress',  selector: '.ccd-express-pay',    label: 'Express Payments', target: 'deepLink:expressPayments' },
  { id: 'footerTotals',   selector: '.ccd-footer-totals',  label: 'Totals',           target: 'inline' },
  { id: 'checkoutButton', selector: '.ccd-checkout-btn',   label: 'Checkout Button',  target: 'inline' },
  { id: 'trustLine',      selector: '.ccd-trust',          label: 'Trust Line',       target: 'inline+deepLink' },
  { id: 'global',         selector: '.ccd-drawer-bg',      label: 'Cart Style',       target: 'inline' },
];
```

### 5.2 Overlay rendering

Unchanged from rev 3 — `mousemove` → `elementsFromPoint` → hover halo; `click` → selectElement → right panel.

### 5.3 Why an overlay, not direct listeners

Cart DOM stays byte-identical to production. Overlay is removable. Same pattern Figma/Webflow use.

## 6. Save flow

Unchanged from rev 3 except: Notes/Discount/Terms/ExpressPay save through the Addons API (`PUT /api/addons/<key>/config`), not the Cart Editor API. Each addon has its own If-Match/version (already part of the addon framework).

§§ 6.1–6.6 (save, cache bust, cross-tab sync, discard, navigation guard, validation, rate limit) carry over from rev 3.

## 7. Error handling

Carries over from rev 3 unchanged. New addon validation errors follow the existing addon error pattern (per-addon Zod with 400 + field name).

## 8. Testing strategy

### 8.1 Contract tests (static analysis of v14-complete.js)

~60 new contract tests for `editorOverrides` fields (rev 3 count). Plus ~24 new contract tests across the 4 new addons (6 per addon: enabled-off-hides-element, enabled-on-shows, default values, CSS-var injection, provider toggle, integration with cart).

**§8.1 total: 84 new contract tests.**

### 8.2 Regression tests

ALL 245 existing contract + 124 behavior-shield + 30 bug-regression tests keep passing. New locks:
- Empty cart hides notes/discount/terms/express rows (consistency with existing addon-hide-on-empty rule)
- All 14 mandatory cart rules from project memory
- Native Shopify express checkout still triggers when provider toggle = true

### 8.3 Editor unit tests

```
describe('draft store')                        // 8 tests (carry-over)
describe('Zod schema — editorOverrides')        // 16 tests (carry-over)
describe('Zod schema — notes addon')            // 5 tests (enabled, label, maxChars range, position, defaults)
describe('Zod schema — discountCode addon')     // 4 tests
describe('Zod schema — termsCheckbox addon')    // 6 tests (labelHtml sanitization is critical — 3 of the 6 cover XSS vectors)
describe('Zod schema — expressPayments addon')  // 5 tests
describe('PUT /api/cart-editor/config')         // 10 tests (carry-over)
describe('PUT /api/addons/notes/config')        // 3 tests
describe('PUT /api/addons/discountCode/config') // 3 tests
describe('PUT /api/addons/termsCheckbox/config')// 3 tests (XSS-rejection test included)
describe('PUT /api/addons/expressPayments/config')// 3 tests
describe('GET /apps/eliminai/config — addons')  // 3 tests (new addon fields appear in proxy response)
```

**§8.3 total: 8 + 16 + 5 + 4 + 6 + 5 + 10 + 3 + 3 + 3 + 3 + 3 = 69 new editor/addon unit tests.**

### 8.4 Preview integration tests (Playwright)

Carry over 12 from rev 3, plus:
- Click Notes area in preview → deep-link to Addons tab opens with Notes expanded
- Same for Discount / Terms / Express
- Toggle expressPayments.providers.paypal off → preview hides PayPal button
- Terms unchecked + `blockCheckoutIfUnchecked: true` + click checkout → error message shows, no navigation

**§8.4 total: 12 + 4 (deep-link routes) + 2 (express toggle + terms block) = 18 new Playwright tests.**

### 8.5 Blast-radius lock tests

Carry over 6 from rev 3, plus:
- `editorOverrides = null` AND all 4 new addons `enabled: false` → cart structurally equivalent to pre-Stage-2 production
- Enabling expressPayments alone (no editorOverrides) → only express-pay area mutates; header/items/footer/checkout button regions remain structurally equivalent
- Enabling termsCheckbox + clicking checkout when unchecked → preventDefault verified (checkout flow does NOT execute Shopify checkout redirect)

**§8.5 total: 6 + 3 = 9 new blast-radius locks.**

### 8.6 CI gate

| Layer | Section | Count |
|---|---|---|
| Baseline contract | `tests/contract.test.js` | 245 |
| Baseline behavior-shield | `tests/behavior-shield.test.js` | 124 |
| Baseline bug-regression | `tests/bug-regression.test.js` | 30 |
| **Baseline total** | | **399** |
| New contract (editor + 4 addons) | §8.1 | 84 |
| New editor + addon unit tests | §8.3 | 69 |
| New Playwright | §8.4 | 18 |
| New blast-radius locks | §8.5 | 9 |
| **New additions total** | | **180** |
| **Grand total target** | | **579** |

Gate steps (pre-commit + pre-deploy):
1. `npm test` — full suite. MUST report ≥ 579 passing tests.
2. `tsc --noEmit`
3. `node tests/contract.test.js`
4. Playwright suite on cart-editor-preview (18 tests)
5. Structural-equivalence snapshot diff against pre-deploy production drawer HTML.

## 9. Rollout plan

**Stage 1 — Backend + data model** ✅ DONE (`claude/cart-editor` branch merged)
- `editorOverrides` + `editorOverridesVersion` columns
- Zod schema (will be expanded by this rev)
- GET/PUT `/api/cart-editor/config` gated behind `CART_EDITOR_API_ENABLED`

**Stage 2 — Expand schema + new addons**
- Expand Zod for header/footer/global additions in EditorOverrides
- Add 4 new addon definitions to `addon-definitions.ts` (notes, discountCode, termsCheckbox, expressPayments)
- Add 4 new addon editor components in `dashboard/addons/`
- Add per-addon GET/PUT API endpoints (or reuse the generic addon API if one exists)
- Contract + unit tests passing (§8.1 + §8.3)

**Stage 3 — v14-complete.js renders everything**
- Fallback reads for every `editorOverrides` field
- Render `<div class="ccd-notes-row">`, `<form class="ccd-discount-row">`, `<label class="ccd-terms-row">`, `<div class="ccd-express-pay">` when their addons are enabled
- CSS-variable injection for expressPayments provider toggles
- Terms checkbox interception of checkout click
- Discount code POST to `/discount/<code>`
- Notes textarea → `cart_attributes[note]`
- Smoke test: `editorOverrides = null` AND all 4 new addons off → structurally equivalent to pre-Stage-2 production

**Stage 4 — Editor UI**
- Build preview-canvas + overlay + 8 element editors
- Draft store + Save/Discard
- Deep-link routing to Addons tab for milestone/trust/notes/discount/terms/express
- Playwright suite passing
- Ship Cart Editor tab

**Stage 5 — Docs + parity verification**
- Internal docs per setting
- Final UpCart parity audit

## 10. Out of scope (deferred)

- Custom HTML / CSS / JS escape hatch
- Sticky cart launcher button (storefront floating pill)
- Header logo upload
- Subscribe-and-save, quantity-break ladder, charity round-up, tiered gift unlock, recently-viewed, sticky upsell carousel
- Multi-language editor UI
- Theme presets (save/load named configs)
- Per-customer-segment overrides
- Subscription upgrade module

## 11. Open questions

None at design time. The expressPayments CSS-targeting fallback (if Shopify selectors prove unreliable) is documented as a known branch in §4.4.4 and will be resolved in the implementation plan.

---

End of design spec — rev 4.
