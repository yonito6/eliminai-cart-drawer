# Cart Editor + 4 New Addons — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Cart Editor tab (click-to-edit live preview + 8 element editors) and ship 4 new addons (notes, discountCode, termsCheckbox, expressPayments) achieving UpCart parity.

**Architecture:** Stage 1 backend (editorOverrides column + API) already merged. This plan covers Stages 2–5 of the rev-4 spec.

**Tech Stack:** Next.js 14, React, Prisma/Postgres, Zod, TailwindCSS, Playwright. Storefront cart in vanilla JS (`extensions/cart-drawer/assets/v14-complete.js`).

**Spec:** `docs/superpowers/specs/2026-05-24-cart-editor-design.md` (rev 4).

---

## File Structure

**Backend (Next.js dashboard) — to create:**
```
backend/src/lib/cart-editor-schema.ts                          # NEW — Zod for editorOverrides (expand from cart-editor/[storeId]/config)
backend/src/app/dashboard/addons/notes-addon-editor.tsx        # NEW
backend/src/app/dashboard/addons/discount-code-addon-editor.tsx # NEW
backend/src/app/dashboard/addons/terms-checkbox-addon-editor.tsx # NEW
backend/src/app/dashboard/addons/express-payments-addon-editor.tsx # NEW
backend/src/app/dashboard/cart-editor/page.tsx                 # NEW — Cart Editor tab entry
backend/src/app/dashboard/cart-editor/preview-canvas.tsx       # NEW
backend/src/app/dashboard/cart-editor/draft-store.tsx          # NEW — React context
backend/src/app/dashboard/cart-editor/overlay/hotspots.ts      # NEW
backend/src/app/dashboard/cart-editor/overlay/hover-halo.tsx   # NEW
backend/src/app/dashboard/cart-editor/overlay/selection-ring.tsx # NEW
backend/src/app/dashboard/cart-editor/element-editors/         # NEW — 8 editors
  ├── header-editor.tsx
  ├── milestone-editor.tsx
  ├── line-item-editor.tsx
  ├── empty-state-editor.tsx
  ├── footer-editor.tsx
  ├── checkout-button-editor.tsx
  ├── trust-line-editor.tsx
  └── global-style-editor.tsx
backend/src/app/dashboard/cart-editor/addon-deep-link.tsx      # NEW
backend/src/app/dashboard/cart-editor/preview-renderer.ts      # NEW — maps overrides → DOM
```

**Backend — to modify:**
```
backend/src/lib/addon-definitions.ts          # +4 addon definitions
backend/src/app/api/cart-editor/[storeId]/config/route.ts  # expand Zod schema
backend/src/app/dashboard/addons/page.tsx     # wire 4 new addon editor components
backend/prisma/schema.prisma                  # (no change — editorOverrides already exists)
```

**Storefront (Shopify extension) — to modify:**
```
extensions/cart-drawer/assets/v14-complete.js   # render new addons + editorOverrides fallback reads
v14-complete.js                                  # root copy (same edits)
```

**Tests — to create/modify:**
```
backend/__tests__/cart-editor.test.ts          # NEW — Zod + draft store + API
tests/contract.test.js                          # +84 contract tests
tests/cart-editor-preview.spec.js               # NEW — Playwright (18 tests)
tests/blast-radius/cart-editor.test.js          # NEW — 9 lock tests
```

---

## Chunk 1 — Stage 2a: Expand editorOverrides Zod schema

### Task 1.1: Extract & expand Zod schema into a reusable lib

**Files:**
- Create: `backend/src/lib/cart-editor-schema.ts`
- Modify: `backend/src/app/api/cart-editor/[storeId]/config/route.ts`

- [ ] **Step 1.1.1** — Write `backend/src/lib/cart-editor-schema.ts` with the full Zod schema from spec §4.1 (header/milestoneBar/lineItem/emptyState/footer/checkoutButton/trustLine/global) including all new fields: header.closeButton subgroup, header.heightPreset, header.headingLevel, footer.stickyFooter, global.behavior subgroup. Export `EditorOverridesSchema` and `type EditorOverrides`.
- [ ] **Step 1.1.2** — Replace inline Zod in `route.ts` with import from the new lib.
- [ ] **Step 1.1.3** — Add 16 unit tests in `backend/__tests__/cart-editor.test.ts` for the schema (rejects invalid hex, accepts 3/6/8-digit, drawer width bounds, ctaLink http rejection, fontFamily char allowlist, unknown-key stripping, partial overrides, empty object, schemaVersion migration).
- [ ] **Step 1.1.4** — `npm test -- cart-editor` → all pass.
- [ ] **Step 1.1.5** — Commit: `feat(cart-editor): expanded Zod schema with header/footer/global behavior fields + 16 unit tests`.

---

## Chunk 2 — Stage 2b: Add 4 new addon definitions

### Task 2.1: Add `notes` addon

**Files:**
- Modify: `backend/src/lib/addon-definitions.ts`

- [ ] **Step 2.1.1** — Append a new entry to `ADDON_DEFINITIONS`:
  ```ts
  {
    key: 'notes',
    label: 'Order Notes',
    icon: '📝',
    description: 'Let shoppers add a note to their order',
    estimatedImpact: 'AOV neutral, conversion +1–2%',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'label', label: 'Field label', type: 'text', testable: false, default: 'Add a note to your order' },
      { key: 'placeholder', label: 'Placeholder', type: 'text', testable: false, default: '' },
      { key: 'maxChars', label: 'Max characters (0 = unlimited)', type: 'number', testable: false, default: 250, min: 0, max: 1000 },
      { key: 'position', label: 'Position in footer', type: 'select', testable: true, options: [
        { value: 'top', label: 'Top of footer' }, { value: 'bottom', label: 'Bottom of footer' }
      ], default: 'bottom' },
    ],
    defaultConfig: { enabled: false, label: 'Add a note to your order', placeholder: '', maxChars: 250, position: 'bottom' },
  },
  ```
- [ ] **Step 2.1.2** — `npm test -- addon-definitions` → addon registry test passes (count increased by 1).
- [ ] **Step 2.1.3** — Commit: `feat(addons): add notes addon definition`.

### Task 2.2: Add `discountCode` addon

- [ ] **Step 2.2.1** — Append to `ADDON_DEFINITIONS`:
  ```ts
  {
    key: 'discountCode',
    label: 'Discount Code Field',
    icon: '🏷️',
    description: 'Inline discount code input in cart',
    estimatedImpact: 'Conversion +2–5% (when used with promos)',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'placeholder', label: 'Input placeholder', type: 'text', testable: false, default: 'Discount code' },
      { key: 'applyButtonLabel', label: 'Apply button label', type: 'text', testable: false, default: 'Apply' },
      { key: 'position', label: 'Position', type: 'select', testable: true, options: [
        { value: 'top', label: 'Top of footer' }, { value: 'bottom', label: 'Bottom of footer' }
      ], default: 'bottom' },
      { key: 'showAppliedBadge', label: 'Show applied-discount badge', type: 'toggle', testable: false, default: true },
    ],
    defaultConfig: { enabled: false, placeholder: 'Discount code', applyButtonLabel: 'Apply', position: 'bottom', showAppliedBadge: true },
  },
  ```
- [ ] **Step 2.2.2** — Commit.

### Task 2.3: Add `termsCheckbox` addon

- [ ] **Step 2.3.1** — Append to `ADDON_DEFINITIONS`:
  ```ts
  {
    key: 'termsCheckbox',
    label: 'Terms & Conditions',
    icon: '☑️',
    description: 'Required agreement checkbox above checkout',
    estimatedImpact: 'Legal compliance; minor conversion impact',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'labelHtml', label: 'Checkbox label (supports <a>)', type: 'text', testable: false, default: 'I agree to the <a href="/policies/terms-of-service">Terms of Service</a>' },
      { key: 'errorMessage', label: 'Error if unchecked', type: 'text', testable: false, default: 'Please agree to the terms before continuing' },
      { key: 'blockCheckoutIfUnchecked', label: 'Block checkout if unchecked', type: 'toggle', testable: false, default: true },
    ],
    defaultConfig: { enabled: false, labelHtml: 'I agree to the <a href="/policies/terms-of-service">Terms of Service</a>', errorMessage: 'Please agree to the terms before continuing', blockCheckoutIfUnchecked: true },
  },
  ```
- [ ] **Step 2.3.2** — Add server-side sanitizer `sanitizeLabelHtml()` in `addon-definitions.ts` exported helper: strips all tags except `<a>` with `href|target|rel` attrs; rejects `javascript:` and `data:` href values; max 500 chars.
- [ ] **Step 2.3.3** — Unit test in `cart-editor.test.ts`: 3 XSS-rejection cases (`<script>`, `<a href="javascript:">`, `<img onerror>`).
- [ ] **Step 2.3.4** — Commit.

### Task 2.4: Add `expressPayments` addon

- [ ] **Step 2.4.1** — Append to `ADDON_DEFINITIONS`:
  ```ts
  {
    key: 'expressPayments',
    label: 'Express Checkout Buttons',
    icon: '⚡',
    description: 'Show Shop Pay, Apple Pay, PayPal, etc. directly in cart',
    estimatedImpact: 'Conversion +8–15%',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'providers', label: 'Show providers', type: 'checkboxes', testable: false, checkboxOptions: [
        { value: 'shopPay', label: 'Shop Pay' },
        { value: 'googlePay', label: 'Google Pay' },
        { value: 'paypal', label: 'PayPal' },
        { value: 'applePay', label: 'Apple Pay' },
        { value: 'amazonPay', label: 'Amazon Pay' },
        { value: 'metaPay', label: 'Meta Pay' },
      ], default: { shopPay: true, googlePay: true, paypal: true, applePay: true, amazonPay: false, metaPay: false } },
      { key: 'position', label: 'Position relative to checkout button', type: 'select', testable: true, options: [
        { value: 'above', label: 'Above checkout button' }, { value: 'below', label: 'Below checkout button' }
      ], default: 'above' },
      { key: 'layout', label: 'Layout', type: 'select', testable: true, options: [
        { value: 'stacked', label: 'Stacked (full-width buttons)' }, { value: 'row', label: 'Row (compact)' }
      ], default: 'stacked' },
      { key: 'separatorLabel', label: 'Separator label (empty = none)', type: 'text', testable: false, default: 'or' },
    ],
    defaultConfig: { enabled: true, providers: { shopPay: true, googlePay: true, paypal: true, applePay: true, amazonPay: false, metaPay: false }, position: 'above', layout: 'stacked', separatorLabel: 'or' },
  },
  ```
- [ ] **Step 2.4.2** — Commit.

### Task 2.5: Verify addons via proxy

- [ ] **Step 2.5.1** — Open `/api/proxy/config` and confirm all 4 new keys appear under `addons` with default config when no override exists.
- [ ] **Step 2.5.2** — Commit any wiring fixes if needed.

---

## Chunk 3 — Stage 2c: 4 Addon Editor UI components

Pattern: each editor follows the existing `scarcity-timer-editor.tsx` shape (303 lines): form fields, save button, dirty tracker, persist to `/api/stores/[id]/addons` POST endpoint.

### Task 3.1: `notes-addon-editor.tsx`

- [ ] **Step 3.1.1** — Create file with: label text input, placeholder text input, maxChars number input (0–1000), position select (top/bottom). Save handler calls existing addon-config persist API.
- [ ] **Step 3.1.2** — Wire into `dashboard/addons/page.tsx`: when `selectedAddon.key === 'notes'`, render `<NotesAddonEditor />`.
- [ ] **Step 3.1.3** — Manual test: toggle on/off in dashboard, save, reload — settings persist.
- [ ] **Step 3.1.4** — Commit.

### Task 3.2: `discount-code-addon-editor.tsx`

- [ ] **Step 3.2.1** — Create with: placeholder, applyButtonLabel, position select, showAppliedBadge toggle.
- [ ] **Step 3.2.2** — Wire into page.tsx.
- [ ] **Step 3.2.3** — Commit.

### Task 3.3: `terms-checkbox-addon-editor.tsx`

- [ ] **Step 3.3.1** — Create with: labelHtml textarea (with warning helper about allowed `<a>` tags), errorMessage input, blockCheckoutIfUnchecked toggle. On save, call sanitizer and show warning if sanitization stripped content.
- [ ] **Step 3.3.2** — Wire into page.tsx.
- [ ] **Step 3.3.3** — Commit.

### Task 3.4: `express-payments-addon-editor.tsx`

- [ ] **Step 3.4.1** — Create with: 6 provider toggles (with provider icons), position select, layout select, separatorLabel input. Show live preview of selected providers as button mockups.
- [ ] **Step 3.4.2** — Wire into page.tsx.
- [ ] **Step 3.4.3** — Commit.

---

## Chunk 4 — Stage 3: v14-complete.js renders new addons + editorOverrides fallback reads

### Task 4.1: Render notes row

**Files:**
- Modify: `extensions/cart-drawer/assets/v14-complete.js`
- Modify: `v14-complete.js` (root copy)

- [ ] **Step 4.1.1** — Find footer render function. Add conditional render: if `cfg.addons?.notes?.enabled`, insert `<div class="ccd-notes-row ccd-notes-row--${position}"><label>${label}</label><textarea name="cart[note]" maxlength="${maxChars||1000}" placeholder="${placeholder}"></textarea></div>`.
- [ ] **Step 4.1.2** — Wire textarea → `fetch('/cart/update.js', { method: 'POST', body: { attributes: { note: value } } })` on blur (debounced 500ms).
- [ ] **Step 4.1.3** — On cart open, read `cart.note` and pre-fill.
- [ ] **Step 4.1.4** — Add 3 contract tests in `tests/contract.test.js`: rendered when enabled, hidden when disabled, position class applied.
- [ ] **Step 4.1.5** — Run `node tests/contract.test.js` → green.
- [ ] **Step 4.1.6** — Commit.

### Task 4.2: Render discount code row

- [ ] **Step 4.2.1** — Insert `<form class="ccd-discount-row ccd-discount-row--${position}" onsubmit="return false"><input type="text" placeholder="${placeholder}"><button type="submit">${applyButtonLabel}</button></form>`.
- [ ] **Step 4.2.2** — Wire submit handler: `fetch('/discount/' + encodeURIComponent(code), { method: 'POST' })` then trigger cart refresh. If `cart.discount_codes[]` non-empty, render applied badges with X to remove.
- [ ] **Step 4.2.3** — 4 contract tests (enabled, disabled, applied-badge visible, applied-badge hidden).
- [ ] **Step 4.2.4** — Commit.

### Task 4.3: Render terms checkbox + intercept checkout

- [ ] **Step 4.3.1** — Insert `<label class="ccd-terms-row"><input type="checkbox" id="ccd-terms"> <span>${sanitizedLabelHtml}</span></label>` directly above the checkout button.
- [ ] **Step 4.3.2** — Modify checkout button click handler: if `cfg.addons.termsCheckbox.enabled && cfg.addons.termsCheckbox.blockCheckoutIfUnchecked && !checked`, preventDefault + show errorMessage below checkbox + scroll-into-view.
- [ ] **Step 4.3.3** — 4 contract tests (enabled, disabled, blocks when unchecked, allows when checked).
- [ ] **Step 4.3.4** — Commit.

### Task 4.4: Render express payments + CSS-var injection

- [ ] **Step 4.4.1** — Find where Shopify's native express checkout markup renders. If selectors are stable, attach `data-shopify-express-pay="<provider>"` data attributes via DOM walk on cart open. If unstable, render OWN container using Shopify's `Shopify.PaymentButton` API fallback.
- [ ] **Step 4.4.2** — Inject CSS variables on cart root:
  ```js
  function setExpressVars(providers){
    const root = document.querySelector('#CCD-Drawer');
    if (!root) return;
    ['shopPay','googlePay','paypal','applePay','amazonPay','metaPay'].forEach(p => {
      root.style.setProperty('--ccd-show-'+p, providers[p] ? 'flex' : 'none');
    });
  }
  ```
- [ ] **Step 4.4.3** — Add CSS rules to `cart-constants.ts` REAL_CART_CSS:
  ```css
  [data-shopify-express-pay="shopPay"] { display: var(--ccd-show-shopPay, flex); }
  [data-shopify-express-pay="googlePay"] { display: var(--ccd-show-googlePay, flex); }
  [data-shopify-express-pay="paypal"] { display: var(--ccd-show-paypal, flex); }
  [data-shopify-express-pay="applePay"] { display: var(--ccd-show-applePay, flex); }
  [data-shopify-express-pay="amazonPay"] { display: var(--ccd-show-amazonPay, flex); }
  [data-shopify-express-pay="metaPay"] { display: var(--ccd-show-metaPay, flex); }
  .ccd-express-pay--row { display: flex; gap: 8px; }
  .ccd-express-pay--stacked > * { display: block; width: 100%; margin-bottom: 8px; }
  .ccd-express-pay--above { order: -1; }
  ```
- [ ] **Step 4.4.4** — 8 contract tests (enabled, disabled, each of 6 providers toggle hides exactly that one).
- [ ] **Step 4.4.5** — Commit.

### Task 4.5: editorOverrides fallback reads — header

- [ ] **Step 4.5.1** — In v14-complete.js header render, replace hardcoded title with `(cfg.editorOverrides?.header?.title || 'Your Cart').replace(/\{\{cart_quantity\}\}/g, String(cart.item_count))`.
- [ ] **Step 4.5.2** — Apply: titleAlignment → text-align style, bgColor → background-color, padding → height var, headingLevel → tag name (h2/h3/h4), titleFontSize/Weight/Color.
- [ ] **Step 4.5.3** — Apply closeButton.* fields: bgColor, bgHoverColor, iconColor, iconSize → size class, strokeWeight → stroke-width attr, border + borderColor + borderHoverColor.
- [ ] **Step 4.5.4** — 12 contract tests (one per field).
- [ ] **Step 4.5.5** — Commit.

### Task 4.6: editorOverrides fallback reads — line item

- [ ] **Step 4.6.1** — Apply: imageSize → class S/M/L, imageShape → border-radius, showVariant/showSku → conditional render, qtyControl → swap component, removeStyle → swap component, showCompareAtPrice → render `<s class="ccd-compare">`, showSavingsBadge → render badge.
- [ ] **Step 4.6.2** — 8 contract tests.
- [ ] **Step 4.6.3** — Commit.

### Task 4.7: editorOverrides fallback reads — empty state

- [ ] **Step 4.7.1** — Apply: heading, subtext, icon, ctaLabel, ctaLink, ctaInheritsCheckoutStyle (apply same classes as checkout button when true).
- [ ] **Step 4.7.2** — 6 contract tests.
- [ ] **Step 4.7.3** — Commit.

### Task 4.8: editorOverrides fallback reads — footer

- [ ] **Step 4.8.1** — Apply: showSubtotal/Shipping/Tax/YouSaved/CrossedOutSubtotal/totalOutsideButton (mutually exclusive with default inside-button rendering), totalLabel, totalSize/Weight, bgStyle, borderTop, stickyFooter (toggle CSS position:sticky).
- [ ] **Step 4.8.2** — 11 contract tests.
- [ ] **Step 4.8.3** — Commit.

### Task 4.9: editorOverrides fallback reads — checkout button

- [ ] **Step 4.9.1** — Apply all checkoutButton fields. The `totalOutsideButton: true` case removes `<span class="ccd-checkout-total">` from inside the button and inserts a separate `<div class="ccd-total-outside">` above/below.
- [ ] **Step 4.9.2** — 10 contract tests.
- [ ] **Step 4.9.3** — Commit.

### Task 4.10: editorOverrides fallback reads — trust line, milestone visual, global

- [ ] **Step 4.10.1** — Trust line visual fields (text, lock, paymentIconsVisible map, position, size/color).
- [ ] **Step 4.10.2** — Milestone visual fields (preUnlock/unlocked templates, celebrationAnim, fill/track colors, height, position, textSize/Weight).
- [ ] **Step 4.10.3** — Global fields (side, widthDesktop, widthMobilePct, backdropColor/Opacity, openAnim/openDurationMs, palette via CSS vars, fontFamily, baseFontSize, headingScale, spacing, radius, behavior.openOnAddToCart/autoCloseOnCheckout/bodyScrollLock/mobileFullscreen/hideOnPages).
- [ ] **Step 4.10.4** — 25 contract tests.
- [ ] **Step 4.10.5** — Commit.

### Task 4.11: Run full contract suite

- [ ] **Step 4.11.1** — `node tests/contract.test.js` → expect 245 (baseline) + 84 (new) = 329+ passing.
- [ ] **Step 4.11.2** — If any fail, fix root cause (do NOT skip).
- [ ] **Step 4.11.3** — Commit "test(cart-editor): all 84 new contract tests green".

---

## Chunk 5 — Stage 4: Cart Editor tab UI

### Task 5.1: Tab skeleton + draft store

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/page.tsx`, `draft-store.tsx`, `api-client.ts`
- Modify: dashboard nav (locate from existing addons/page.tsx pattern)

- [ ] **Step 5.1.1** — `page.tsx`: two-column layout (Tailwind grid), preview state dropdown above preview, viewport toggle (Desktop/Mobile), Discard/Save buttons in panel header.
- [ ] **Step 5.1.2** — `draft-store.tsx`: React Context exposing `{draft, savedConfig, isDirty, setField(path, value), discard(), save(), selectedElementId, selectElement(id)}`. Uses lodash/set for nested path updates (or simple recursive setter). Persist `draft` to sessionStorage keyed by storeId.
- [ ] **Step 5.1.3** — `api-client.ts`: `getEditorOverrides(storeId)` + `putEditorOverrides(storeId, overrides, version)` (sends `If-Match: ce-<version>` header).
- [ ] **Step 5.1.4** — Add nav item "Cart Editor" between "Addons" and "A/B Tests".
- [ ] **Step 5.1.5** — Commit.

### Task 5.2: Preview canvas + renderer

- [ ] **Step 5.2.1** — `preview-canvas.tsx`: renders REAL_CART_CSS via `<style>` + CONTROL_HTML adapted via `preview-renderer.ts`. Mounts the full drawer DOM in a non-iframe container.
- [ ] **Step 5.2.2** — `preview-renderer.ts`: pure function `renderPreview({ overrides, addons, previewState }) → htmlString`. Walks the draft and emits the same HTML v14-complete.js would emit.
- [ ] **Step 5.2.3** — Preview state dropdown: 'items' (default mock cart with 3 items), 'empty', 'unlocked' (over milestone threshold), 'loading'.
- [ ] **Step 5.2.4** — Viewport toggle: applies `max-width: 480px` for Mobile, `max-width: 540px` for Desktop.
- [ ] **Step 5.2.5** — Commit.

### Task 5.3: Hover halo + selection ring overlay

- [ ] **Step 5.3.1** — `overlay/hotspots.ts`: export `HOTSPOTS` const from spec §5.1 (12 entries with `id`, `selector`, `label`, `target`).
- [ ] **Step 5.3.2** — `overlay/hover-halo.tsx`: listens to mousemove on preview container, finds first hotspot via `document.elementsFromPoint`, renders absolutely-positioned div using `getBoundingClientRect()` with dashed purple outline + floating label.
- [ ] **Step 5.3.3** — `overlay/selection-ring.tsx`: solid purple ring on `draft.selectedElementId`. ResizeObserver recomputes on layout change.
- [ ] **Step 5.3.4** — Click handler: `draft.selectElement(hotspot.id)`.
- [ ] **Step 5.3.5** — Click outside any hotspot → `selectElement(null)`.
- [ ] **Step 5.3.6** — Commit.

### Task 5.4: 8 Element editors

Each editor is a single `.tsx` file with form controls bound to draft store via `setField('header.title', value)`. Pattern reused for all 8.

- [ ] **Step 5.4.1** — `header-editor.tsx`: title text, headingLevel select, titleAlignment radio, titleFontSize slider 14–48, titleFontWeight select, titleColor color, bgColor, borderStyle select, padding select, heightPreset radio, closeButton sub-form (position, iconSize, strokeWeight, border, all colors, hover colors). Commit.
- [ ] **Step 5.4.2** — `milestone-editor.tsx`: visual fields (preUnlock/unlocked templates, celebrationAnim toggle, fillColor, trackColor, height slider, position select, textSize, textWeight). At top: deep-link banner "Edit tiers in Addons →" (uses `addon-deep-link.tsx`). Commit.
- [ ] **Step 5.4.3** — `line-item-editor.tsx`: imageSize select, imageShape select, showVariant/showSku toggles, qtyControl select, removeStyle select, showCompareAtPrice toggle, showSavingsBadge toggle, separator select, titleSize slider, titleWeight slider. Commit.
- [ ] **Step 5.4.4** — `empty-state-editor.tsx`: heading text, subtext textarea, icon select (or upload), ctaLabel text, ctaLink text (validate /... or https://...), ctaInheritsCheckoutStyle toggle. Commit.
- [ ] **Step 5.4.5** — `footer-editor.tsx`: showSubtotal/Shipping/Tax/YouSaved/CrossedOutSubtotal toggles, totalOutsideButton toggle (with preview-of-effect hint), totalLabel text, totalSize/Weight sliders, bgStyle select, borderTop select, stickyFooter toggle. Commit.
- [ ] **Step 5.4.6** — `checkout-button-editor.tsx`: label text, bgColor + bgHoverColor + textColor, radius select, height select, fontWeight slider, letterSpacing slider, icon select, fullWidth toggle, loadingAnim select. Commit.
- [ ] **Step 5.4.7** — `trust-line-editor.tsx`: text, showLockIcon toggle, paymentIconsVisible per-provider toggles (read provider list from addons.trustLine.providers), position select, textSize, textColor. Deep-link banner "Add/remove providers in Addons →". Commit.
- [ ] **Step 5.4.8** — `global-style-editor.tsx`: side radio, widthDesktop slider 320–800, widthMobilePct slider 50–100, backdropColor + Opacity slider, openAnim select, openDurationMs slider, palette (8 colors), fontFamily text, baseFontSize, headingScale, spacing select, radius select, behavior sub-form (openOnAddToCart, autoCloseOnCheckout, bodyScrollLock, mobileFullscreen toggles, hideOnPages text-array). Commit.

### Task 5.5: Addon deep-link component

- [ ] **Step 5.5.1** — `addon-deep-link.tsx`: takes `addonKey` prop, renders card with addon name + "Edit in Addons →" button. On click: `router.push('/dashboard/addons?expand=' + addonKey)` after saving draft to sessionStorage.
- [ ] **Step 5.5.2** — Modify `dashboard/addons/page.tsx` to read `?expand=<key>` and auto-open that addon's editor on mount.
- [ ] **Step 5.5.3** — Wire 4 footer hotspots (notes, discount, terms, express) → render `<AddonDeepLink addonKey={...} />` instead of inline editor when clicked.
- [ ] **Step 5.5.4** — Commit.

### Task 5.6: Save/Discard flow + cross-tab sync

- [ ] **Step 5.6.1** — Save button calls `putEditorOverrides`. On success: toast + `BroadcastChannel('cart-editor:'+storeId).postMessage({kind:'saved', version, overrides})`. On 409: modal "settings changed in another tab" with [Discard & reload] / [Keep mine].
- [ ] **Step 5.6.2** — Discard: `draft.discard()` (reverts to savedConfig). Confirm modal if isDirty.
- [ ] **Step 5.6.3** — `beforeunload` listener when isDirty. Intra-app nav guard via Next.js `useRouter` event.
- [ ] **Step 5.6.4** — Listen on BroadcastChannel: if not dirty, refetch and update savedConfig. If dirty, show banner "Settings updated in another tab. [Discard mine] [Keep mine]".
- [ ] **Step 5.6.5** — Commit.

---

## Chunk 6 — Stage 4 tests + Stage 5 docs

### Task 6.1: Playwright suite

**Files:**
- Create: `tests/cart-editor-preview.spec.js`

- [ ] **Step 6.1.1** — Write 18 Playwright tests per spec §8.4:
  - click Header → right panel shows Header editor
  - change header.title → preview text updates < 500ms (no network)
  - Save → reload → preview shows persisted value
  - navigate away with isDirty → confirm modal
  - preview state dropdown → empty → click empty CTA → editor opens
  - desktop↔mobile viewport toggle changes width
  - hover halo follows cursor
  - selection ring stays after click, clears on outside-click
  - cross-tab: tab A saves → tab B savedConfig updates within 1s
  - cross-tab conflict: tab B dirty → tab A saves → banner shows
  - cache bust: PUT save → proxy returns new version within 2s
  - ownership: PUT with addons.milestone.tiers → 400 conflict
  - click Notes area → routes to Addons?expand=notes
  - click Discount area → routes to Addons?expand=discountCode
  - click Terms area → routes to Addons?expand=termsCheckbox
  - click Express area → routes to Addons?expand=expressPayments
  - toggle expressPayments.providers.paypal off → preview hides PayPal
  - terms unchecked + blockCheckoutIfUnchecked + checkout click → error shown, no nav
- [ ] **Step 6.1.2** — `npx playwright test cart-editor-preview` → all 18 pass.
- [ ] **Step 6.1.3** — Commit.

### Task 6.2: Blast-radius lock tests

**Files:**
- Create: `tests/blast-radius/cart-editor.test.js`
- Create: `tests/helpers/structural-equiv.js` if not already present

- [ ] **Step 6.2.1** — Write 9 lock tests per spec §8.5.
- [ ] **Step 6.2.2** — `node tests/blast-radius/cart-editor.test.js` → 9 pass.
- [ ] **Step 6.2.3** — Commit.

### Task 6.3: Final test gate

- [ ] **Step 6.3.1** — Run full suite. Target: **≥579 passing** (399 baseline + 180 new).
- [ ] **Step 6.3.2** — `tsc --noEmit` clean.
- [ ] **Step 6.3.3** — Commit (if any fixes).

### Task 6.4: Docs + parity audit

- [ ] **Step 6.4.1** — Create `docs/cart-editor-user-guide.md` describing each setting with screenshot placeholder.
- [ ] **Step 6.4.2** — Audit UpCart docs once more for any setting missed. Add to backlog if found.
- [ ] **Step 6.4.3** — Update memory file `project_eliminai_cart_drawer.md` with new feature list.
- [ ] **Step 6.4.4** — Commit.

### Task 6.5: Deploy to Railway

- [ ] **Step 6.5.1** — Confirm `CART_EDITOR_API_ENABLED=true` in Railway env.
- [ ] **Step 6.5.2** — Deploy: `railway up --detach` from `backend/`.
- [ ] **Step 6.5.3** — Verify production: `/api/cart-editor/<storeId>/config` returns 200 with editorOverrides. Open `/dashboard/cart-editor` in browser, click an element, change a setting, save, reload — persists.
- [ ] **Step 6.5.4** — Upload extension assets to DEMO theme only (per `feedback_cart_drawer_demo_only.md`).
- [ ] **Step 6.5.5** — Smoke test on demo storefront — open cart drawer, verify nothing broke, toggle a new addon, see it appear.
- [ ] **Step 6.5.6** — Final commit + tag `cart-editor-v1`.

---

## Definition of Done

- All 6 chunks committed
- 579+ tests passing (`npm test`)
- TypeScript clean (`tsc --noEmit`)
- Cart Editor tab visible in dashboard navigation
- All 8 element editors functional
- All 4 new addons appear in Addons tab with working editors
- Click-to-edit works for inline editors + deep-link for 4 addon-owned regions
- Demo storefront cart renders correctly with default settings (no regression)
- `editorOverrides = null` produces structurally-equivalent cart vs pre-Stage-2 production
- Deployed to Railway production
- Demo theme has updated extension assets
