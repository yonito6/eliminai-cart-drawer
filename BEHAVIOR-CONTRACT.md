# Cart Drawer Behavior Contract

**Last approved: 2026-04-14**
**Approved snapshot: `snapshots/2026-04-14T18-05-approved/`**

This file defines the EXACT behaviors that Yoni has approved. Any code change that violates these contracts is a regression. The contract tests (`tests/contract.test.js`) verify all of these automatically.

## How to use

Before uploading ANY JS to live or demo theme:
```bash
cd C:/Projects/eliminai-cart-drawer && node tests/contract.test.js
```

If ANY test fails → DO NOT UPLOAD. Fix the code first.

---

## Contract 1: Shipping Protection — Always Added

**Rule:** Protection must be added to the cart on EVERY `/cart/add` call, regardless of body format (JSON or form-encoded).

**Implementation details:**
- Fetch interceptor (`window.fetch` override) catches all `/cart/add` POST calls
- For JSON bodies: protection variant is injected into the `items` array
- For form-encoded bodies: a SEPARATE `/cart/add.js` call fires via `origFetch`
- `protectionDone` flag prevents double-adds
- Cart-open handler (`refreshOnOpen`) is a secondary protection add path
- `ensureProtection()` is a tertiary path

**What breaks this:**
- Empty `catch(ex){}` in the interceptor (no form-encoded fallback)
- `protectionDone` set to true without actually adding protection
- `origFetch` not available in the catch scope
- `CFG.protectionDefaultOn` or `CFG.protectionAutoAdd` check missing

**Contract checks:**
- [ ] Interceptor catch block contains `origFetch` call for protection
- [ ] `protectionDone` is set to true in both JSON and form-encoded paths
- [ ] Protection add uses `PROT_VID` constant (not hardcoded ID)
- [ ] Cart-open handler at `refreshOnOpen` also adds protection
- [ ] Toggle handler adds/removes protection correctly
- [ ] `ensureProtection` function exists as tertiary fallback

---

## Contract 2: Gift Add — Form-Encoded Only

**Rule:** Gift items (Eleganto Case, future tier gifts) MUST be added using form-encoded format, never JSON `{items:[]}` array.

**Why:** Shopify's AJAX API silently fails for certain variant IDs when using JSON items array format. Form-encoded (`id=X&quantity=1`) always works.

**Implementation details:**
- `_addOneGift(item)` helper function handles all gift adds
- Uses `Content-Type: application/x-www-form-urlencoded`
- Body format: `id=X&quantity=1&properties%5B_eliminai_gift%5D=true`
- Gifts are added one-at-a-time in a chain (not batched)
- Error tracking per handle via `_giftAddFails`

**What breaks this:**
- Using `JSON.stringify({items: [...]})` for gift adds
- Missing `_eliminai_gift` property (needed for identification)
- Batching multiple gifts in a single request

**Contract checks:**
- [ ] No `JSON.stringify({items: toAdd})` pattern exists for gifts
- [ ] Gift add uses `application/x-www-form-urlencoded`
- [ ] `_eliminai_gift` property is included in gift add body
- [ ] Gifts are chained sequentially (Promise chain)

---

## Contract 3: Excluded Handle Logic

**Rule:** Protection and gift handles are excluded from "real" item count but NOT from total price display.

**Implementation details:**
- `_isExcludedHandle(handle)` returns true for protection and all gift handles
- `getRealCount(cart)` subtracts excluded items from count
- `getAdjustedTotal(cart)` subtracts gift cost from total (since discount makes it $0, this is a safety net)
- Progress bar milestones use `getRealCount`, not `cart.item_count`

**Contract checks:**
- [ ] `_isExcludedHandle` checks both `PROT` and `WATCH_CASE_HANDLE` and `GIFT_HANDLES`
- [ ] `getRealCount` uses `_isExcludedHandle` to filter
- [ ] `getAdjustedTotal` only subtracts gift cost, not protection

---

## Contract 4: Protection Toggle Behavior

**Rule:** Toggle appears already ON when cart opens (no slide animation). Only transitions on user interaction.

**Implementation details:**
- `CCD.setToggleNoTransition(true)` called immediately on cart open
- CSS class `ccd-toggle--instant` prevents animation
- Class is removed on first user click (enabling transitions for future toggles)
- `toggling` flag prevents concurrent toggle operations
- Checkbox is disabled during API calls

**Contract checks:**
- [ ] `setToggleNoTransition` function exists
- [ ] `ccd-toggle--instant` class is applied
- [ ] Toggle handler disables checkbox during fetch
- [ ] `toggling` flag guards concurrent operations

---

## Contract 5: Cart Open Flow

**Rule:** Single cart fetch → protection check → refresh. No double-fetch race.

**Implementation details:**
- `refreshOnOpen()` does ONE `/cart.js` fetch
- If protection needed: adds it, then fetches `/cart.js` again, then `CCD.refresh()`
- If protection exists: sets `protectionDone = true`, calls `CCD.refresh()`
- **Race condition handling:** If `protectionDone` is true but protection not in cart (interceptor add still in-flight), waits 600ms then retries. If still missing after retry, adds protection directly.
- `CCD.refresh()` at the end calls `checkWatchCase()` for gift sync

**What breaks this:**
- Removing the in-flight retry causes intermittent protection disappearance (2026-04-14 bug)
- The race happens because theme JS opens the cart drawer before the interceptor's `/cart/add` completes

**Contract checks:**
- [ ] `refreshOnOpen` fetches `/cart.js` exactly once before protection check
- [ ] Protection add path ends with `CCD.refresh()`
- [ ] No-protection path also calls `CCD.refresh()`
- [ ] In-flight race condition detected (`protectionDone && !hasProt`) and retried

---

## Contract 6: protectionDone Lifecycle

**Rule:** `protectionDone` starts false, becomes true on first protection add, resets on cart close or empty cart.

**Reset points:**
- Cart drawer closes (MutationObserver detects class removal)
- Cart becomes empty (`rc === 0` in refresh)

**Set points:**
- Interceptor JSON path (line ~662)
- Interceptor form-encoded fallback (catch block)
- Cart-open inline handler (line ~1704)
- `ensureProtection()` (line ~606)

**Contract checks:**
- [ ] `protectionDone = false` appears in cart-close observer
- [ ] `protectionDone = false` appears in empty-cart branch of refresh
- [ ] `protectionDone = true` appears in at least 3 locations (interceptor JSON, interceptor catch, cart-open)

---

## Contract 7: Gift Tier System

**Rule:** Gifts are awarded based on milestone score (real item count). Highest-tier-only when `HIGHEST_TIER_ONLY` is true.

**Implementation details:**
- `checkWatchCase(cart)` evaluates all tiers
- `score` = `getRealCount(cart)` (excludes protection and gifts)
- `shouldHave` map computed from tier goals vs score
- Gifts not in `shouldHave` are removed; missing ones are added
- `caseDismissed` prevents re-adding if user dismissed

**Contract checks:**
- [ ] `checkWatchCase` uses `getRealCount` for score (not `item_count`)
- [ ] `shouldHave` respects `HIGHEST_TIER_ONLY` flag
- [ ] Remove happens before add (remove chain → add chain)
- [ ] `watchCaseBusy` prevents concurrent gift operations

---

## Approved Variant IDs

| Product | Variant ID | Handle |
|---------|-----------|--------|
| Shipping Protection | 47779174023419 | shipping-protection-1 |
| Eleganto Case | 46941745742075 | eleganto-premium-watch-organizer |

## Approved Discount

| Name | Type | Condition |
|------|------|-----------|
| Eliminai Gift — Eleganto Case | DiscountAutomaticBasic | 100% off eleganto-premium-watch-organizer, no min, combines with all |
