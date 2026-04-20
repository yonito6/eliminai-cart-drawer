# Cart Drawer Bug Report — 2026-04-18

## Rollback Snapshots
- **Pre-fix**: `snapshots/v14-pre-fix-20260418-0117.js`
- **Post-syntax-fix**: `snapshots/v14-syntax-fixed-20260418.js`
- **Final verified**: `snapshots/v14-all-fixes-verified-20260418.js`

---

## BUGS FIXED (5 total)

### Bug 1: CSS string syntax error (line 105)
- **Symptom**: Entire CCD failed to load — `window.CCD` was undefined
- **Root cause**: Extra quote in CSS string — `''.ccd-gift-item {` instead of `'.ccd-gift-item {`
- **Impact**: CRITICAL — $0 checkout, no cart drawer at all
- **Fix**: Removed extra leading quote

### Bug 2: Broken string literal with newline (line 159)
- **Symptom**: JS parse error, CCD wouldn't initialize
- **Root cause**: CartDrawer hide CSS rule had a literal newline character inside a string (not `\n`, an actual LF byte)
- **Impact**: CRITICAL — same as Bug 1, no CCD at all
- **Fix**: Replaced literal newline with `\n` escape sequence

### Bug 3: GIFT_TIERS.forEach crash (line 278)
- **Symptom**: `TypeError: Cannot read properties of undefined (reading 'forEach')` on every page load
- **Root cause**: `GIFT_TIERS` is declared with `var` on line 284, but used on line 278. `var` hoisting makes the name exist but with value `undefined` at line 278.
- **Impact**: CRITICAL — CCD IIFE crashed, nothing worked after this line
- **Fix**: Changed `GIFT_TIERS.forEach(...)` to `REWARD_TIERS.forEach(...)` (REWARD_TIERS is defined at line 246). Also removed premature `WATCH_CASE_VID` check on line 281 (same hoisting issue).

### Bug 4: Discount badges showing on non-discounted items (line ~514)
- **Symptom**: "1+1 FREE" badge appeared on ALL items that had discount allocations, even when the discount amount was $0
- **Root cause**: `_renderDiscountBadges` checked only for `title` presence, not for `amount > 0`. Shopify attaches a discount allocation with `amount: 0` to items where the discount exists but doesn't apply.
- **Impact**: MEDIUM — misleading badges, customers think item is free when it's not
- **Fix**: Added `if (!da.amount || parseInt(da.amount, 10) <= 0) continue;` after the title check

### Bug 5: hasDiscount flag includes $0 discounts (line ~547)
- **Symptom**: Items showed strikethrough pricing and "Free" label even when not actually discounted
- **Root cause**: `var hasDiscount = item.discounts && item.discounts.length > 0` counted ALL discount allocations including $0 ones
- **Impact**: MEDIUM — visual confusion, wrong pricing display
- **Fix**: Changed to `item.discounts.some(function(d) { return d.amount > 0; })`

---

## VERIFIED WORKING (comprehensive tests)

| Test Case | Result | Notes |
|-----------|--------|-------|
| CCD loads on all pages | PASS | Cart, product, collection pages |
| Single item + correct total | PASS | $59.99 item = $59.99 |
| 2 items + 1+1 FREE discount | PASS | Cheapest item shows "Free" with badge |
| 3 items + gift auto-add | PASS | Eleganto Case auto-added as "Bonus gift" |
| Quantity increase (+) | PASS | Updates total, triggers gift tiers |
| Quantity decrease (-) | PASS | Updates total, removes gifts when below tier |
| Remove item (trash icon) | PASS | Removed cleanly, total recalculated |
| Empty cart state | PASS | Shows "Your cart is empty" + Continue Shopping |
| Protection toggle OFF | PASS | Removes $4.99, total updates |
| Protection toggle ON | PASS | Adds $4.99, total updates |
| Close + reopen drawer | PASS | Shows correct items and total |
| Rapid clicks (+ × 3 fast) | PASS | Queue handled correctly, final qty correct |
| Gift tier auto-add (3 unique items) | PASS | Eleganto Case appears with "Bonus gift" label |
| Gift tier auto-add (high spend) | PASS | Golden Love Heart Necklace added at higher tier |
| Gift auto-remove (drop below tier) | PASS | Gift removed when qty decreased |
| Add-to-cart on product page | PASS | Drawer auto-opens after adding |
| Cart icon opens drawer | PASS | Works on all page types |
| Discount row shows correct amount | PASS | Shows non-gift discount total |
| Gift discount hidden from row | PASS | By design (gifts show as "Free" separately) |
| Badge only on truly discounted items | PASS | $0 allocations filtered out |
| Strikethrough only on free items | PASS | Non-free items show regular price |
| "Only 1 left!" scarcity badge | PASS | Shows when inventory = 1 |
| Progress bar milestones | PASS | Updates correctly per tier |
| "You have unlocked all rewards!" | PASS | Shows when all tiers reached |

## NOT BUGS (investigated but correct behavior)

1. **"1+2 discount doesn't work"** — Both "1+1 FREE" and "1+2 FREE" are Shopify automatic discounts. Shopify picks which one to apply based on cart contents. Only ONE automatic discount can be active at a time. With 3 items, Shopify may apply "1+1 FREE" (making 1 item free) instead of "1+2 FREE" depending on the discount configuration. This is Shopify discount configuration, not a cart drawer bug.

2. **Dolphin appears as two line items** — When Shopify applies a discount to some units of a product but not all, it splits the line item into two: one with the discount and one without. This is standard Shopify behavior.

3. **Theme's CartForm error on collection page** — `TypeError: Cannot read properties of undefined (reading 'classList')` comes from Impulse theme's own cart code (`theme.js CartForm.cartMarkup`), not from CCD.

4. **Heart Necklace "Only 1 left" add failure** — This product has inventory=1. When stock is 0 (depleted by testing), adding fails with description "Only 1 left". This is a Shopify inventory limit, not a cart drawer bug.

## KNOWN LIMITATION

- `CCD.refresh()` called without a cart argument crashes with `Cannot read properties of undefined (reading 'items')`. This is not user-facing (internal API only), but could be hardened with a guard: `if (!cart) { fetch('/cart.js')... }`.

---

## Files Changed
- `v14-complete.js` — 5 bug fixes applied
- Uploaded to LIVE theme (145950245115) and DEMO theme (158622155003)
- Extension copy updated: `extensions/cart-drawer/assets/v14-complete.js`

## Patch Scripts (for reproducibility)
- `patch-fix-final.js` — Fixes bugs 1 & 2 (syntax)
- `patch-fix-gift-tiers.js` — Fixes bug 3 (GIFT_TIERS hoisting)
- `patch-fix-badges.js` — Fixes bugs 4 & 5 (discount badges)
