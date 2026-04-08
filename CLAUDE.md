# Shopify Cart Drawer — Project Instructions

## Store & API

- **Store**: eleganto-3011.myshopify.com
- **Theme ID**: 158546952443
- **Access Token**: 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
- **API Version**: 2025-01
- **Theme**: Impulse

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
