# Cart Editor — Design Spec

**Date:** 2026-05-24
**Status:** Design approved, spec revised after first review (rev 2)
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
| Custom CSS | **Out of scope for v1.** Security review required first (csstree AST allow-list). Deferred to a separate spec. |
| Ownership of overlapping fields | Addons own: milestone tiers/thresholds (drives logic), trust-line/payment icons set (drives Shopify payment data), all addon `enabled` toggles. Cart Editor owns: visual-only style (colors, sizes, text templates, layout positions). See §4.3 Ownership map. |

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

Add two columns to `CartConfig`:

```prisma
model CartConfig {
  // existing fields ...
  editorOverrides         Json?  // typed via Zod; null = render with current defaults
  editorOverridesVersion  Int    @default(0)  // monotonic, bumped on every save; cache key + If-Match
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
  schemaVersion: 1;  // bumped on breaking shape changes; backend migrates older versions on read
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
    // customCss intentionally omitted in v1 — see §2. Deferred for security review.
  };
};
```

### 4.3 Ownership map (Addon settings vs Cart Editor overrides)

The Addons tab and the Cart Editor must never write to overlapping fields. Each row below is owned by exactly one tab. The other tab MAY read the value (for preview) but MUST NOT mutate it.

| Concept | Owner | Field path |
|---|---|---|
| Free-shipping milestone enabled toggle | Addons | `addons.milestone.enabled` |
| Milestone tiers (threshold, reward label, icon) | Addons | `addons.milestone.tiers[]` |
| Milestone copy templates (preUnlock / unlocked) | Cart Editor | `editorOverrides.milestoneBar.preUnlockTemplate` / `unlockedTemplate` |
| Milestone visual style (fill, track, height, text size, position) | Cart Editor | `editorOverrides.milestoneBar.{fillColor,trackColor,height,textSize,textWeight,position}` |
| Milestone celebration animation toggle | Cart Editor | `editorOverrides.milestoneBar.celebrationAnim` |
| Trust line enabled toggle | Addons | `addons.trustLine.enabled` |
| Trust line payment provider icons (which providers exist) | Addons | `addons.trustLine.providers[]` |
| Trust line per-icon show/hide override + text + lock + position | Cart Editor | `editorOverrides.trustLine.{paymentIcons,text,showLockIcon,position,textSize,textColor}` |
| Gift note addon (enable, char limit, validation) | Addons | `addons.giftNote.*` |
| Gift note visual position/label override | Cart Editor | `editorOverrides.footer.showGiftNote` (visibility only) |

**Validation rule (server-side):** PUT `/api/cart-editor/config` rejects with 400 if the body contains any path explicitly listed as Addon-owned. The Zod schema for `editorOverrides` does not declare those keys, so they get stripped before save, AND an explicit pre-validation check returns an error message naming the conflict. This prevents silent corruption.

**Read-side merge in v14-complete.js:**
- Milestone *tiers* always come from `addons.milestone.tiers` (Addons is source of truth)
- Milestone *copy* uses `editorOverrides.milestoneBar.preUnlockTemplate` if set, else the addon default
- Milestone *visual style* uses `editorOverrides.milestoneBar.{fillColor,...}` if set, else CSS defaults
- If Addons disables milestone (`addons.milestone.enabled = false`), Cart Editor's milestone settings render nothing (Addon ownership wins on visibility of the whole feature)

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
  { id: 'lineItem',       selector: '.ccd-item',         label: 'Line Item' },
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
[Backend: prisma.cartConfig.update({ data: { editorOverrides, editorOverridesVersion: prev+1, updatedAt: now } })]
        │
        ▼
[Cache invalidation: bump in-memory + edge config cache key for this store; new ETag/version on /apps/eliminai/config]
        │
        ▼
[Response 200 → { editorOverridesVersion, editorOverrides } → draftStore: savedConfig = draft, isDirty = false]
        │
        ▼
[Broadcast: BroadcastChannel('cart-editor:' + storeId).postMessage({ kind:'saved', version, editorOverrides })
            also localStorage event 'cart-editor:<storeId>:lastSaveVersion' = version (cross-tab fallback)]
        │
        ▼
[Toast: "Saved. Live in shoppers' carts on next open."]
```

### 6.2.1 Cache busting on the shopper-side proxy

`/apps/eliminai/config` (the proxy v14-complete.js polls/reads) must serve the latest `editorOverrides` after a save. Three layers:

1. **Database-derived version.** Each save bumps `CartConfig.editorOverridesVersion` (integer). The proxy response includes this version in its JSON body and in an `ETag: "ce-<version>"` header.
2. **CDN/edge cache key.** The Next.js route uses `revalidateTag('cart-config:' + storeId)` after PUT. Proxy response sets `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=60` and lists `ce-<version>` as part of the cache key via the `Vary` strategy on the storeId.
3. **Runtime invalidation in v14-complete.js.** On every cart open the script compares the response version with the cached one in `sessionStorage` (`ccd:cfgVersion`). If they differ, it discards cached HTML and re-renders. Implementation note: the polling cadence is unchanged — opens are the natural sync point.

This satisfies `feedback_dashboard_config_must_render.md` (proxy config flows through to live DOM, never stale).

### 6.2.2 Cross-tab dashboard sync after save

If a merchant has two dashboard tabs open and saves in tab A, tab B must reflect the new state without manual refresh (satisfies `feedback_preview_instant_update.md`).

- **Primary channel:** `BroadcastChannel('cart-editor:' + storeId)`. On `saved` message, every listening tab refetches `editorOverrides` and updates `draftStore.savedConfig`. If the listening tab has its own `isDirty === true`, it does NOT clobber the user's draft — it shows a non-blocking banner: "Settings updated in another tab. [Discard mine & reload] [Keep my changes]".
- **Fallback channel:** `localStorage` event `cart-editor:<storeId>:lastSaveVersion` (covers browsers/contexts without BroadcastChannel — same merge rules).
- **Stale draft on save:** the PUT carries the `If-Match: ce-<version>` header (the version the user started editing from). Server compares with current; on mismatch returns 409 — see §7.

### 6.3 Discard

`draftStore.discard()` → `draft = savedConfig; isDirty = false`. No network call.

### 6.4 Navigation guard

If `isDirty === true` and user clicks another tab / closes browser → confirm modal "You have unsaved changes — discard?" (matches existing dashboard pattern used by rich-text-editor and scarcity-timer-editor).

### 6.5 Validation rules

- `schemaVersion` required, must equal current (1) — older versions are migrated server-side before validation
- Hex colors: `/^#[0-9a-f]{6}$/i`
- Drawer width desktop: 320–800
- Drawer width mobile (percent): 50–100
- Backdrop opacity: 0–1
- Open duration: 100–600 ms
- Base font size: 10–24
- Heading scale: 1.0–1.8
- All strings: max 200 chars (header title, button label, milestone templates)
- `emptyState.ctaLink`: must parse as a relative path (`/...`) OR an absolute URL with `https:` protocol only (`http:` and `javascript:` rejected). Max 500 chars.
- `fontFamily`: max 100 chars, allowed character set `[a-zA-Z0-9 ,\-_'"]` (rejects script-injection vectors and CSS expression syntax)
- Per-element color overrides: when a Cart Editor element-level color is unset, it inherits from `global.palette`. Conflict resolution at render time: element-specific > palette > CSS default. The schema does not prevent setting both — by design, since per-element override is a real use case.
- Unknown keys: stripped silently by Zod
- Custom CSS: **not accepted** in v1 (see §2 decisions). Server returns 400 if the body contains a `global.customCss` key.

### 6.6 Rate limiting and auth

- PUT `/api/cart-editor/config`: authenticated session required (existing dashboard middleware)
- Rate limit per `storeId`: 10 saves per minute, 60 per hour (in-memory + edge KV). Exceeding returns 429 with `Retry-After`. Save button shows a countdown when throttled.
- GET `/api/cart-editor/config`: rate limit 60/min/storeId (much higher — used for cross-tab refresh + page mount).

## 7. Error handling

| Failure | Handling |
|---|---|
| Save API 500 | Toast "Save failed — please retry". Draft preserved. isDirty stays true. |
| Save API network error | Same as above. No silent loss. |
| Validation rejection | Toast names the field. Editor auto-opens that element. Draft preserved. |
| Preview render crash | React error boundary around preview only. Shows "Preview unavailable — settings still save correctly." Right panel stays usable. |
| Cart DOM resize during edit | ResizeObserver recomputes overlay positions on next frame. |
| Concurrent save from another tab | `If-Match: ce-<version>` header mismatch on PUT → 409 conflict → modal: "Cart settings changed in another tab. [Discard mine & reload latest] [Keep my changes (creates new version on save)]". The "Keep" path re-issues PUT with the latest `editorOverridesVersion` and the user's draft (last-write-wins, but user explicitly chose it). |
| Rate limit exceeded | 429 with Retry-After. Toast shows countdown. Draft preserved. |
| `schemaVersion` from older client | Server-side migration runs before Zod validation. If migration fails, return 400 with explicit reason. |

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
  test BroadcastChannel 'saved' message updates savedConfig when not dirty
  test BroadcastChannel 'saved' shows banner when local isDirty (does not clobber)
  test localStorage fallback when BroadcastChannel unavailable

describe('Zod schema')
  test rejects invalid hex
  test rejects drawer width 319 (below min)
  test rejects drawer width 1200 (above max)
  test accepts drawer width 100 ONLY for widthMobilePct (percent)
  test rejects widthDesktop = 100 (below 320 min)
  test rejects emptyState.ctaLink = 'javascript:alert(1)'
  test rejects emptyState.ctaLink = 'http://example.com' (http not allowed)
  test accepts emptyState.ctaLink = '/collections/all'
  test accepts emptyState.ctaLink = 'https://example.com/page'
  test rejects fontFamily with parens or semicolons
  test strips unknown keys
  test allows partial overrides (header only)
  test allows empty object {} (with schemaVersion: 1)
  test rejects body containing global.customCss (out of scope)
  test rejects body containing Addon-owned paths (e.g. addons.milestone.tiers)
  test missing schemaVersion → server-side defaulted then validated

describe('PUT /api/cart-editor/config')
  test writes editorOverrides only
  test bumps editorOverridesVersion by exactly 1
  test does not touch addons or abTests fields
  test 409 on stale If-Match header (mismatch with current editorOverridesVersion)
  test 401 on no session
  test 429 after 10 saves in 60s
  test response includes new editorOverridesVersion
  test triggers revalidateTag('cart-config:'+storeId)
  test ETag header is "ce-<version>"

describe('GET /apps/eliminai/config (shopper proxy)')
  test returns editorOverridesVersion in body and ETag header
  test serves stale-while-revalidate within s-maxage
  test after PUT, next GET reflects new editorOverrides (no stale cache)
```

Estimate: ~38 new editor tests.

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
test cross-tab sync: tab A saves header title → tab B's savedConfig updates within 1s (no isDirty)
test cross-tab conflict: tab B has isDirty → tab A saves → tab B shows banner with discard/keep options
test cache bust: PUT save → shopper-side /apps/eliminai/config returns new editorOverridesVersion within 2s
test ownership: PUT body with addons.milestone.tiers → 400 with explicit conflict message
```

Estimate: ~14 Playwright tests.

### 8.5 Blast-radius lock tests

Per CLAUDE.md blast-radius-shield rule. The drawer cannot be **byte-identical** after we add fallback reads — we must add code paths and (for newly editable elements like `showCrossedOutSubtotal`) empty wrapper elements that render nothing when the toggle is false. The assertion is therefore **structural equivalence**, not byte equality:

- v14-complete.js with `editorOverrides = null` → drawer is **structurally equivalent** to current production: same visible text, same visible elements, same computed styles. New empty placeholder elements (e.g. `<div class="ccd-savings-row" hidden>`) are allowed.
- v14-complete.js with `editorOverrides = {}` → same as above.
- DOM diff helper (`tests/helpers/structural-equiv.js`) ignores: hidden elements (`hidden` attribute or `display:none`), data-attributes added for editor instrumentation, whitespace-only text node changes.
- Adding `editorOverrides = { footer: { totalOutsideButton: true } }` → only footer/button visible DOM changes; visible text/computed styles of all other elements unchanged.
- All addon code paths still inject correctly and Cart Editor overrides do NOT modify Addon-owned values (see §4.3 Ownership map).
- Production smoke: snapshot the current live cart HTML before Stage 2 deploy, replay against the new v14-complete.js with `editorOverrides = null`, assert structural equivalence.

### 8.6 CI gate

Pre-commit + pre-deploy:
1. `npm test` — full suite. Existing baseline (245 contract + 124 behavior-shield + 30 bug-regression = 399) + new additions (~60 contract + ~38 unit + ~10 Playwright + ~6 blast-radius locks + ~8 ownership/cache-bust = ~122) → total target **~521 tests**.
2. `tsc --noEmit`
3. `node tests/contract.test.js` — static analysis on v14-complete.js
4. Playwright suite on cart-editor-preview
5. Structural-equivalence snapshot diff against pre-deploy production drawer HTML

## 9. Rollout plan

Stage 1 — Backend + data model (no UI yet)
- Add `editorOverrides` + `editorOverridesVersion` columns + Zod schema + GET/PUT API
- Implement ownership-map validation (rejects Addon-owned paths)
- Implement rate limiting + `If-Match` concurrency + ETag cache layer
- Deploy with API behind a feature flag (`CART_EDITOR_API_ENABLED`)
- Contract tests + unit tests passing

Stage 2 — v14-complete.js reads overrides
- Add fallback reads for every field
- Add `editorOverridesVersion` check in sessionStorage to invalidate cached HTML on version bump
- Contract tests verify all fields wired
- Deploy to extension CDN
- Smoke test: set `editorOverrides = null` in DB → cart structurally equivalent to pre-deploy snapshot (see §8.5)

Stage 3 — Editor UI
- Build preview-canvas + overlay + element-editors
- Draft store + Save/Discard
- BroadcastChannel + localStorage cross-tab sync wired
- Playwright suite passing (including cross-tab + cache-bust tests)
- Ship Cart Editor tab in dashboard

Stage 4 — Documentation + competitor parity check
- Internal docs on each setting
- Confirm parity with Rebuy / SLIDECART / UpCart for any settings we missed

## 10. Out of scope (deferred to later phases)

- **Custom CSS escape hatch** — needs a CSS AST allow-list (csstree) and threat-model review before we expose merchant-controlled CSS to live shopper traffic (`expression()`, `behavior:url()`, `@import`, `url(javascript:)` and many more vectors). Deferred to a dedicated spec.
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
