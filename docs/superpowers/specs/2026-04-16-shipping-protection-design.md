# Shipping Protection — Full Feature Design

**Date:** 2026-04-16
**Status:** Approved
**Scope:** Auto-create Shopify product, tiered pricing, icon selection, dashboard config, cart JS integration

---

## 1. Overview

Shipping protection is an addon that adds a toggleable protection fee to the cart drawer. When a store owner enables it, the system auto-creates a hidden Shopify product with the configured price. Customers see a toggle in the cart drawer to add/remove protection. The protection product is invisible on the storefront — it only exists for cart operations.

### Key Decisions
- **One product, multiple variants** for tiered pricing (not separate products)
- **Thompson Sampling A/B testing** via existing addon auto-optimize system (deferred — build all addons first, then layer testing)
- **Silent tier swap** when cart value crosses tier thresholds (no visual notification)
- **Update existing product** on config changes (never delete/recreate)

---

## 2. Shopify Product Creation

### Product Structure
| Field | Value |
|-------|-------|
| Title | User-configurable, default "Shipping Protection" |
| Product Type | "Service" |
| Status | ACTIVE |
| Published | NOT published to Online Store sales channel |
| Requires Shipping | false |
| Taxable | false |
| Inventory Tracking | Not tracked |
| Tags | `_eliminai-cart-protection` |
| Image | Selected icon (uploaded via stagedUploadsCreate) |

### Variants
- **Single-price mode**: 1 variant with the configured price
- **Tiered mode**: Up to 10 variants, each with:
  - Title: "Up to $50" / "Up to $100" / "$100+" (auto-generated from tier config)
  - Price: tier price
  - Requires shipping: false
  - Inventory: not tracked

### GraphQL Mutations Used
1. `productCreate` — create the product with first variant
2. `productVariantsBulkCreate` — add additional tier variants
3. `productVariantsBulkUpdate` — update prices/titles on existing variants
4. `productVariantsBulkDelete` — remove variants when tiers are removed
5. `productUpdate` — update title, tags
6. `stagedUploadsCreate` + `productCreateMedia` — upload icon as product image
7. `publishableUnpublish` — remove from Online Store sales channel

### Required Scope
`write_products` — added to shopify.app.toml and SHOPIFY_SCOPES env var. Already deployed as v38.

---

## 3. Dashboard UI

### 3a. Setup State (No Product Yet)

When user enables shipping protection addon and no product exists:

```
┌─────────────────────────────────────────────┐
│  Shipping Protection                        │
│                                             │
│  Product Name: [Shipping Protection    ]    │
│                                             │
│  Icon:                                      │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌──────┐   │
│  │📦🛡│ │ 🛡✓│ │🛡🔒│ │ ☂ │ │🤚🛡│ │Upload│   │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └──────┘   │
│                                             │
│  Pricing: ○ Single Price  ○ Tiered          │
│                                             │
│  Price: [$4.99]                             │
│                                             │
│  ☑ Default on (pre-checked when cart opens) │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │     Create Protection Product        │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 3b. Tiered Pricing Mode

When "Tiered" is selected:

```
┌─────────────────────────────────────────────┐
│  Tiers (max 10):                            │
│                                             │
│  ┌─ Tier 1 ──────────────────────────── ✕ ┐ │
│  │  $[1.99] for carts up to $[50.00]      │ │
│  └────────────────────────────────────────┘ │
│  ┌─ Tier 2 ──────────────────────────── ✕ ┐ │
│  │  $[3.99] for carts up to $[100.00]     │ │
│  └────────────────────────────────────────┘ │
│  ┌─ Tier 3 (final) ──────────────────────┐ │
│  │  $[5.99] for carts above $100.00       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  [+ Add Tier]                               │
└─────────────────────────────────────────────┘
```

- Last tier auto-labels as "for carts above $[previous max]" — no upper limit input
- Remove button (✕) on all tiers except the last one (must always have at least 1)
- Tiers must be in ascending order of maxCartValue — auto-sort on save

### 3c. Active State (Product Exists)

Same inputs but:
- Green status dot: "● Active on Shopify"
- Changes auto-save to local config
- "Sync to Shopify" button appears when local config differs from Shopify product
- Sync updates: prices, variants (add/remove), title, icon image

### 3d. Confirmation Modal

On "Create Protection Product" click (same design as gift discount confirmation):

```
┌─────────────────────────────────────────────┐
│  Create Shipping Protection Product         │
│                                             │
│  We'll create a hidden product in your      │
│  Shopify store:                             │
│                                             │
│  • Name: "Shipping Protection"              │
│  • Price: $4.99 (or tiered pricing summary) │
│  • Not visible to customers browsing        │
│  • Used only inside the cart drawer          │
│                                             │
│  This product will appear in your Shopify   │
│  admin under Products but won't show on     │
│  your online store.                         │
│                                             │
│      [Cancel]     [Create Product]          │
└─────────────────────────────────────────────┘
```

### 3e. Icon Selector

5 built-in SVG icons displayed as clickable cards (click-to-toggle, no checkboxes):
1. **Box + Shield** — package with shield checkmark (default)
2. **Shield Checkmark** — simple shield with check
3. **Shield Lock** — shield with padlock
4. **Umbrella** — coverage/protection metaphor
5. **Hand + Shield** — hand holding a shield

Plus a 6th card: **"Upload Custom"** — opens file picker for PNG/SVG.

Selected icon shown with purple border highlight. Same interaction pattern as existing addon UI (cubic-bezier transitions, no grayed-out items).

---

## 4. Cart Drawer JS Changes

### 4a. Config Shape

Current:
```javascript
var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};
var PROT = _sp.handle || CFG.protectionHandle || 'shipping-protection-1';
var PROT_VID = parseInt(_sp.variantId || CFG.protectionVariantId) || 0;
```

New (backwards compatible):
```javascript
var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};
var PROT = _sp.handle || CFG.protectionHandle || 'shipping-protection-1';
// Tiers array: [{ vid, price, maxValue }] sorted by maxValue ascending
// maxValue is in cents, null = unlimited (final tier)
var PROT_TIERS = _sp.tiers || [];
// Fallback: if no tiers, use single VID (backwards compat)
var PROT_VID_SINGLE = parseInt(_sp.variantId || CFG.protectionVariantId) || 0;
if (PROT_TIERS.length === 0 && PROT_VID_SINGLE) {
  PROT_TIERS = [{ vid: PROT_VID_SINGLE, price: parseInt(_sp.price || CFG.protectionPrice) || 499, maxValue: null }];
}
```

### 4b. Tier Lookup Function

```javascript
function getProtTier(cartValueCents) {
  // cartValueCents = cart subtotal EXCLUDING protection item
  for (var i = 0; i < PROT_TIERS.length; i++) {
    if (PROT_TIERS[i].maxValue === null || cartValueCents <= PROT_TIERS[i].maxValue) {
      return PROT_TIERS[i];
    }
  }
  // Fallback to last tier
  return PROT_TIERS[PROT_TIERS.length - 1] || null;
}
```

### 4c. Silent Tier Swap

In `refresh()` and `refreshLight()`, after fetching cart:

```javascript
// Check if protection is in cart and on correct tier
var protItem = cart.items.find(i => i.handle === PROT);
if (protItem && PROT_TIERS.length > 1) {
  var cartValueExProt = getAdjustedTotal(cart); // excludes protection and gifts
  var correctTier = getProtTier(cartValueExProt);
  if (correctTier && protItem.variant_id !== correctTier.vid) {
    // Wrong tier — silent swap
    await origFetch('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) });
    await origFetch('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTier.vid, quantity: 1 }] }) });
    // Re-fetch cart for accurate rendering
    var res = await origFetch('/cart.js');
    cart = await res.json();
  }
}
```

### 4d. What Stays Identical (Zero Changes)

- `protectionDone` flag lifecycle
- `_userToggledOff` flag and all its checks
- Fetch interceptor piggybacking logic (uses `getProtTier()` instead of `PROT_VID`)
- `ensureProtection()` fallback (uses `getProtTier()`)
- Toggle disable-during-API pattern
- `_isExcludedHandle` checks
- `getRealCount` / `getAdjustedTotal` behavior
- Cart-open inline handler flow
- Race condition handling (`protectionDone && !hasProt` → retry)

### 4e. Toggle Price Display

Toggle area shows current tier price:
```javascript
// In toggle HTML render:
var currentTier = getProtTier(getAdjustedTotal(cart));
var displayPrice = currentTier ? (currentTier.price / 100).toFixed(2) : '0.00';
// Update the price element
document.querySelector('[data-prot-price]').textContent = '$' + displayPrice;
```

### 4f. Icon in Toggle

Currently the toggle has an inline SVG. Change to:
```javascript
var protIconHtml = _sp.iconUrl
  ? '<img src="' + _sp.iconUrl + '" style="width:20px;height:20px" alt="" />'
  : '<svg ...><!-- default box+shield icon --></svg>';
```

---

## 5. API Routes

### POST `/api/stores/[id]/protection/create`

**Input:**
```json
{
  "title": "Shipping Protection",
  "iconId": "box-shield",
  "customIconBase64": null,
  "pricingMode": "tiered",
  "singlePrice": null,
  "tiers": [
    { "price": 199, "maxCartValue": 5000 },
    { "price": 399, "maxCartValue": 10000 },
    { "price": 599, "maxCartValue": null }
  ],
  "defaultOn": true
}
```

**Actions:**
1. Create Shopify product via `productCreate` mutation
2. Upload icon image via `stagedUploadsCreate` + `productCreateMedia`
3. Create additional variants via `productVariantsBulkCreate` (if tiered)
4. Unpublish from Online Store via `publishableUnpublish`
5. Save to store config:
```json
{
  "addons": {
    "shippingProtection": {
      "enabled": true,
      "config": {
        "productId": "gid://shopify/Product/123",
        "handle": "shipping-protection",
        "iconId": "box-shield",
        "iconUrl": "https://cdn.shopify.com/...",
        "defaultOn": true,
        "pricingMode": "single|tiered",
        "price": 499,
        "tiers": [
          { "variantId": 111, "price": 199, "maxCartValue": 5000 },
          { "variantId": 222, "price": 399, "maxCartValue": 10000 },
          { "variantId": 333, "price": 599, "maxCartValue": null }
        ]
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "product": { "id": "...", "handle": "shipping-protection", "variants": [...] }
}
```

### PUT `/api/stores/[id]/protection/update`

**Input:** Same shape as create, plus `productId` to identify existing product.

**Actions:**
1. Update product title via `productUpdate` if changed
2. Update variant prices via `productVariantsBulkUpdate`
3. Add new variants via `productVariantsBulkCreate` if tiers added
4. Remove variants via `productVariantsBulkDelete` if tiers removed
5. Update product image if icon changed
6. Update store config

### GET `/api/stores/[id]/protection/status`

**Response:**
```json
{
  "exists": true,
  "productId": "gid://shopify/Product/123",
  "handle": "shipping-protection",
  "status": "ACTIVE",
  "tiers": [...]
}
```

### POST `/api/stores/[id]/upload`

**Input:** Multipart form with image file (PNG/SVG, max 2MB)

**Actions:**
1. Upload to Shopify via `stagedUploadsCreate`
2. Return CDN URL

**Response:**
```json
{
  "url": "https://cdn.shopify.com/s/files/..."
}
```

---

## 6. Contract Tests (New)

Added to `tests/contract.test.js`:

| # | Test Name | Assertion |
|---|-----------|-----------|
| 30 | `getProtTier` function exists | Must have tier lookup that iterates PROT_TIERS |
| 31 | Tier lookup returns correct variant by cart value | Must compare cartValue to maxValue |
| 32 | Silent swap when tier changes | Must check `protItem.variant_id !== correctTier.vid` and swap |
| 33 | Single-tier fallback to PROT_VID | PROT_TIERS built from single VID when no tiers configured |
| 34 | Toggle price reads from current tier | Must update `[data-prot-price]` with tier price |
| 35 | Icon URL from config | Must support `_sp.iconUrl` for custom icons |
| 36 | Protection product API creates non-physical product | Route must set requiresShipping: false |
| 37 | Protection product API unpublishes from Online Store | Route must call publishableUnpublish |

---

## 7. Data Flow Summary

```
Dashboard Config → Store DB → App Proxy /config → Cart JS
     │                                                │
     │  "Create Product"                              │
     ▼                                                │
Shopify Admin API                                     │
  - productCreate                                     │
  - variantsBulkCreate                                │
  - stagedUploadsCreate                               │
  - publishableUnpublish                              │
     │                                                │
     ▼                                                ▼
Shopify Product                              Cart Drawer Toggle
(hidden, service type)                       - Shows icon + price
  - handle saved to config                   - getProtTier(cartValue)
  - variant IDs saved to config              - Silent swap on value change
                                             - Toggle add/remove
                                             - Interceptor piggybacking
```

---


---

## 8. PROT_VID Migration Table

Every PROT_VID reference updated to getProtTier(cartValue).vid. Use getAdjustedTotal(cart) for cart value (excludes protection and gifts).

| Location | Current | New |
|----------|---------|-----|
| Toggle-on add (~L927) | id: PROT_VID | id: getProtTier(getAdjustedTotal(cart)).vid |
| ensureProtection (~L984) | id: PROT_VID | id: getProtTier(getAdjustedTotal(cart)).vid |
| Interceptor JSON (~L1024) | id: PROT_VID | id: getProtTier(pendingCartValue).vid |
| Interceptor form-encoded (~L1050) | id: PROT_VID | id: getProtTier(0).vid (cheapest, swap corrects) |
| Response handler (~L1129) | id: PROT_VID | id: getProtTier(getAdjustedTotal(cart)).vid |
| Response handler qty>1 (~L1140) | PROT_VID | protItem.variant_id (actual VID) |
| Cart-open inline (~L2136) | id: PROT_VID | id: getProtTier(getAdjustedTotal(cart)).vid |

---

## 9. Config Field Names

Short names everywhere (JS and stored config). No mapping layer:
Stored: { "tiers": [{ "vid": 123, "price": 199, "maxValue": 5000 }] }
JS reads: PROT_TIERS = _sp.tiers || [];

---

## 10. Contract Test Migration

| Contract # | Change |
|-----------|--------|
| 1 (interceptor) | Assert getProtTier called, not raw PROT_VID |
| 5 (cart-open) | Assert getProtTier result used |
| 8 (PROT_VID everywhere) | Assert getProtTier 3+ occurrences |
| 12 (constant) | Assert PROT_VID_SINGLE AND PROT_TIERS exist |
| 14 (cart-open adds) | Assert getProtTier before add |

---

## 11. Error Handling

- productCreate fails: error, nothing to clean up
- productCreateMedia fails: save without image, show warning
- variantsBulkCreate fails: save partial, user retries sync
- publishableUnpublish fails: log warning, show visibility notice
- Update failures: local config NOT updated, sync button stays
- Deleted variants: /protection/status detects on dashboard load, shows warning


---

## 12. Scope & Non-Goals

**In scope:**
- Shopify product auto-creation with icon upload
- Single and tiered pricing (up to 10 tiers)
- 5 built-in icons + custom upload
- Dashboard config UI with confirmation modal
- Cart JS tier lookup and silent swap
- Product update on config changes
- Contract tests for all new behavior

**Not in scope (deferred):**
- A/B testing modes (Manual/Semi/Full Auto) — build after all addons exist
- Display style options — removed per user request
- Cross-store learning for protection attach rates
- Protection claims/refund workflow
- Analytics dashboard for attach rate metrics
