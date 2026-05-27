# Cart Editor — User Guide

The Cart Editor is the visual control center for the Eliminai cart drawer. Click any region in the live preview, edit the settings on the right, hit **Save**, and the storefront updates within seconds.

This guide walks through every setting available in v1 (May 2026).

---

## Getting started

1. Open the dashboard → **Cart Editor** tab.
2. The right side shows a live preview of your drawer. The left side is the **Element Editor** that opens when you click a region.
3. Hover any region to see a halo; click to open its editor.
4. Edit fields — changes appear in the preview immediately (no save needed for the preview).
5. Click **Save** in the header bar to publish. The badge changes from **Unsaved** → **Saving** → **Saved**.
6. If you navigate away while dirty, you'll get a "discard changes?" confirmation.

### Preview states

The preview-state dropdown at the top of the canvas lets you switch between:

- **Empty** — drawer with no items in cart
- **One item** — minimal cart
- **Full cart** — multiple items with all addons visible

Use these to see your edits in every realistic scenario before saving.

### Desktop vs mobile

Toggle the viewport icon to flip the preview between desktop width and mobile (375px). Use this to verify that your width/height/padding settings work on both.

---

## Element editors

### 1. Header

Controls the top of the drawer.

| Setting | What it does |
|---|---|
| Title | Title text. Supports `{{cart_quantity}}` token. |
| Title alignment | `Side` (left) or `Center`. |
| Show item-count badge | Toggle a numeric badge next to the title. |
| Badge color | Hex color. |
| Close icon | `x`, `chevron`, or `arrow`. |
| Close button | Sub-section: position, icon size, stroke weight, border, colors. |
| Background color | Hex color for the header strip. |
| Border style | `none`, `line`, or `shadow` under the header. |
| Padding | `Compact`, `Comfortable`, or `Roomy`. |
| Height preset | `Slim` or `Tall`. |
| Heading level | `h2` / `h3` / `h4` (semantic). |
| Title font size / weight / color | 14–48px, normal/semibold/bold, hex color. |

### 2. Milestone bar

Controls the free-shipping (or any other) progress bar at the top of the cart.

> **Note:** Milestone *tiers* (the thresholds and reward labels) are managed in the **Addons → Milestone** tab. The Cart Editor controls the bar's appearance only.

### 3. Line items

Controls how each cart line renders.

| Setting | What it does |
|---|---|
| Image size | `S`, `M`, `L`. |
| Image style | `square`, `rounded`, `circle`. |
| Show variant | Toggle variant subtitle (e.g., "Color: Red"). |
| Quantity controls | `±` buttons or numeric input. |
| Compare-at price | Show / hide strikethrough original price. |
| Per-line discount line | Show / hide "−$X discount" below the price. |
| Trash icon position | Inline or below quantity. |

### 4. Empty state

What the cart shows when there are no items.

| Setting | What it does |
|---|---|
| Headline | Main empty-state text. |
| Subhead | Secondary line. |
| Illustration | `bag`, `cart`, or `none`. |
| CTA button label | "Continue shopping" etc. |
| CTA link | Relative path (`/collections/all`) or `https://` URL. |

### 5. Footer

The area below the line items.

| Setting | What it does |
|---|---|
| Subtotal label | "Subtotal", "Total", or custom. |
| Show savings line | Show total discount/savings. |
| Show shipping note | Free-shipping reminder text. |
| Sticky footer | Pin footer when scrolling. |
| Background color | Hex. |

The footer hosts **four addon zones** — Notes / Discount Code / Terms / Express Payments. Each is owned by its addon. Click any of these zones in the preview and you'll be deep-linked to the corresponding Addon editor in the **Addons** tab.

### 6. Checkout button

| Setting | What it does |
|---|---|
| Label | "Checkout", "Continue to checkout", etc. |
| Background color | Hex. |
| Text color | Hex. |
| Border radius | `sharp`, `soft`, `rounded`, or `pill`. |
| Size | `M` or `L`. |
| Show icon | Lock, arrow, or none. |

### 7. Trust line

> **Note:** Trust *providers* (Stripe, PayPal, Visa, etc.) are managed in the **Addons → Trust Line** tab. The Cart Editor controls the line's appearance only.

### 8. Global

App-wide drawer settings.

| Group | Setting | What it does |
|---|---|---|
| Position & size | Side | Left or right of the viewport. |
| | Width (desktop) | 320–800px. |
| | Width (mobile) | 50–100% of viewport. |
| Backdrop | Color, opacity | The dim overlay behind the drawer. |
| Animation | Open animation | `slide`, `fade`, or `scale`. |
| | Duration | 100–600ms. |
| Color palette | bg / surface / text / muted / accent / border / success / danger | Maps to CSS variables. |
| Typography | Font family | Comma-separated stack — alphanumerics, spaces, hyphens, underscores, and quotes only. |
| | Base font size | 10–24px. |
| | Heading scale | 1.0–1.8. |
| Spacing & shape | Spacing | `compact`, `comfortable`, `roomy`. |
| | Corner radius | `sharp`, `soft`, `rounded`. |
| Behavior | Open on add-to-cart | Auto-open when an item is added. |
| | Auto-close on checkout | Close when checkout is clicked. |
| | Lock body scroll | Prevent background scrolling while drawer is open. |
| | Mobile fullscreen | Full viewport on mobile. |
| | Hide on pages | Newline-separated list of URL paths (`/checkout`, `/pages/landing`). |

---

## Addon-owned regions

Four cart regions are managed by **addons**, not the Cart Editor:

1. **Notes** — order-notes textarea (click → deep-links to Addons → Notes).
2. **Discount Code** — promo-code input (click → deep-links to Addons → Discount Code).
3. **Terms Checkbox** — required terms acceptance (click → deep-links to Addons → Terms Checkbox).
4. **Express Payments** — Shop Pay / Apple Pay / Google Pay / PayPal buttons (click → deep-links to Addons → Express Checkout Buttons).

When you click these zones in the Cart Editor preview, a banner appears with a link to the matching addon in the Addons tab — the addon page auto-expands to that addon's settings.

This separation exists because addons have their own enable/disable, A/B-test optimization mode, and per-tenant defaults that the Cart Editor doesn't manage.

---

## Saving & conflicts

### Save behavior

- The dashboard sends a `PUT` to `/api/cart-editor/<storeId>/config` with an `If-Match: "ce-<version>"` header.
- The server atomically increments `editorOverridesVersion` and busts the proxy cache.
- The storefront sees the new version on its next config fetch (within ~30s by default).

### Concurrent edits

If a teammate saves while you have unsaved changes:
- A yellow banner appears: **"Cart settings were updated in another tab. Discard mine or Keep mine?"**
- **Discard mine** — your local edits are thrown away; the remote version is loaded.
- **Keep mine** — your local draft is kept; the remote version number is adopted so your next Save doesn't 409.

If you try to Save with a stale version, the server returns `409` and the dashboard shows a conflict modal with the same two options.

### Discard guard

- Unsaved changes trigger a **beforeunload** prompt if you try to navigate away.
- Clicking **Discard** in the header opens a confirmation modal — never a single-click destructive action.

---

## Cross-tab sync

The dashboard uses a `BroadcastChannel` named `cart-editor:<storeId>`. When one tab saves, every other open tab on the same browser receives the new config within ~1s and updates its `savedConfig` automatically (or shows the conflict banner if locally dirty).

---

## Field validation

All input is Zod-validated server-side. Common errors:

- **Invalid hex color** — colors must be `#rgb`, `#rrggbb`. 8-digit (alpha) is rejected.
- **ctaLink rejected** — must be a relative path starting with `/` (but not `//`) or an `https://` URL.
- **fontFamily contains invalid chars** — only `a-z A-Z 0-9 space , - _ ' "` allowed.
- **Width out of range** — desktop 320–800px, mobile 50–100%.

If a field is rejected, the editor highlights it in red and the Save button shows the server's error message in a toast.

---

## Resetting to defaults

There's no global "reset to factory" button in v1. To unset a field, clear it and Save — the server will remove it from `editorOverrides` and the storefront will fall back to the built-in default.

---

## Performance

- Save is debounced — typing in a field doesn't fire a save until you click **Save**.
- The PUT request is rate-limited to 10/minute per store.
- The preview re-renders locally on every keystroke, with no network round-trip.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Edits don't appear on the storefront after Save | Storefront fetched config before your Save. Wait up to 60s for the next refresh, or reload the cart drawer manually. |
| Save returns 409 | Another tab/teammate saved. Use the conflict modal — Keep mine or Discard mine. |
| Save returns 400 with `conflictPath: "addons.…"` | You're trying to set an addon-owned field through the Cart Editor API. These must go through the Addons API. (Should not happen via the UI.) |
| Preview doesn't match storefront | Check that the storefront is fetching from the same store/tenant. The preview is a faithful render but doesn't load your live Shopify cart contents. |
| "Cart settings were updated in another tab" banner appears unexpectedly | A scheduled job or another integration wrote to `editorOverrides`. Refresh to see the new state. |

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-05-24-cart-editor-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-05-26-cart-editor-implementation.md`
- **API:** `backend/src/app/api/cart-editor/[storeId]/config/route.ts`
- **Schema:** `backend/src/lib/cart-editor/schema.ts`
- **Storefront apply function:** `v14-complete.js → CCD.applyEditorOverrides`
- **Tests:**
  - Contract: `tests/contract.test.js` (335 tests)
  - Blast-radius: `tests/blast-radius/cart-editor.test.js` (9 tests)
  - Playwright E2E: `tests/cart-editor-preview.spec.js` (18 tests)
  - Backend unit: `backend/__tests__/cart-editor/` (4 files)
