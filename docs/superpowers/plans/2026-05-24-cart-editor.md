# Cart Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "Cart Editor" dashboard tab that lets merchants click any element in a live cart preview and edit it in a right-side panel, with manual save, cross-tab sync, and zero-regression rollout via structural-equivalence locks.

**Architecture:** Two new columns on `Store` (`editorOverrides Json?`, `editorOverridesVersion Int`) drive a Zod-validated GET/PUT dashboard API. `v14-complete.js` reads every editor field with a fallback to current defaults so `editorOverrides = null` is structurally equivalent to today. The Next.js dashboard renders the production cart DOM directly (same `cart-constants.ts` + `v14-complete.js` paths) with a sibling overlay div for hotspots / hover halo / selection ring. Save bumps an integer version that flows through to the shopper proxy as an ETag for cache busting. BroadcastChannel + localStorage handle cross-tab sync.

**Tech Stack:** Next.js 14 (App Router), Prisma + Postgres, Zod, React Context for draft state, Playwright for preview tests, Vitest/Node test runner for unit + contract + blast-radius lock tests. Reuses existing `src/lib/rate-limit.ts` (RateLimiter) and `src/lib/prisma.ts`.

**Spec:** `docs/superpowers/specs/2026-05-24-cart-editor-design.md`

---

## Reconciliation notes (resolved during plan-writing)

1. **No `CartConfig` model exists.** Cart configuration lives in `Store.config` (Json) and `Store.demoConfig` (Json). The spec's `CartConfig` references in §4 are this plan's `Store` model. New columns go directly on `Store`.
2. **Proxy path:** the spec uses the Shopify-facing URL `/apps/eliminai/config`. The Next.js route handler is at `src/app/api/proxy/config/route.ts`. Both names refer to the same endpoint; Shopify's app-proxy rewrites the public URL to the route handler.
3. **Cache strategy change:** the proxy currently returns `Cache-Control: no-store, no-cache, must-revalidate`. Stage 2 changes this to `public, max-age=0, s-maxage=300, stale-while-revalidate=60` with an `ETag` so CDN edge caching works. The behavior change is gated behind `editorOverridesVersion` so old shoppers always get current content via the ETag bump.
4. **Auth on dashboard API:** existing dashboard routes (`/api/stores/[id]/addons/route.ts`, `/api/stores/[id]/protection/*`, `/api/stores/[id]/theme-settings`, etc.) gate by `storeId` path param **with no session middleware** — they trust the caller to know the storeId. Cart Editor follows the same convention: `PUT /api/cart-editor/[storeId]/config` with no session check. This is a known codebase-wide auth pattern, not a Cart-Editor-specific decision. A future hardening pass (adding NextAuth or Shopify App Bridge session verification across ALL `/api/stores/*` and `/api/cart-editor/*` routes) is out of scope for this plan and should be tracked separately.

5. **Test-count delta vs spec §8.3:** spec §8.3 lists 16 Zod schema tests; this plan adds a 17th (`rejects addon-owned paths`) that lives in the schema test file because it tests the schema's `superRefine` ownership-map check. This brings the chunk-1 contribution to **17 schema + 2 GET + 10 PUT = 29 new tests**, and the spec §8.6 grand total from 514 → 515. The 17→16 discrepancy is bookkeeping only — count this as +1 against §8.6.

---

## Chunk 1: Stage 1 — Backend foundation (schema, Zod, API, ownership, rate limits, If-Match)

### Task 1.1: Add `editorOverrides` columns to `Store` model

**Files:**
- Modify: `backend/prisma/schema.prisma:40-59` (Store model)

- [ ] **Step 1: Add columns to the Store model**

Add inside `model Store { ... }`:
```prisma
  editorOverrides         Json?
  editorOverridesVersion  Int       @default(0)
```

Place them right after `featureFlags Json @default("{}")` so related JSON fields stay grouped.

- [ ] **Step 2: Run prisma generate + push**

```bash
cd backend && npx prisma generate && npx prisma db push
```

Expected: schema sync prints "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(cart-editor): add editorOverrides + editorOverridesVersion to Store"
```

---

### Task 1.2: Write Zod schema for editorOverrides

**Files:**
- Create: `backend/src/lib/cart-editor/schema.ts`
- Test: `backend/__tests__/cart-editor/schema.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/cart-editor/schema.test.ts` with 16 tests covering each rule in spec §6.5 and §4.3:

```ts
import { describe, it, expect } from 'vitest';
import { editorOverridesSchema, addonOwnedPaths } from '@/lib/cart-editor/schema';

describe('editorOverrides Zod schema', () => {
  it('accepts an empty object and defaults schemaVersion to 1', () => {
    const r = editorOverridesSchema.parse({});
    expect(r.schemaVersion).toBe(1);
  });
  it('accepts schemaVersion: 1 explicitly', () => {
    expect(editorOverridesSchema.parse({ schemaVersion: 1 }).schemaVersion).toBe(1);
  });
  it('rejects schemaVersion > 1', () => {
    expect(() => editorOverridesSchema.parse({ schemaVersion: 2 })).toThrow();
  });
  it('accepts 3-digit, 6-digit, and 8-digit hex; normalizes to 6-digit', () => {
    const r = editorOverridesSchema.parse({
      header: { badgeColor: '#fff' },
      checkoutButton: { bgColor: '#abcdef' },
      global: { palette: { accent: '#11223344' } },
    });
    expect(r.header!.badgeColor).toBe('#ffffff');
    expect(r.checkoutButton!.bgColor).toBe('#abcdef');
    expect(r.global!.palette!.accent).toBe('#112233'); // alpha stripped after normalize
  });
  it('rejects non-hex color', () => {
    expect(() => editorOverridesSchema.parse({ header: { badgeColor: 'red' } })).toThrow();
  });
  it('rejects drawer width 319 (below min)', () => {
    expect(() => editorOverridesSchema.parse({ global: { widthDesktop: 319 } })).toThrow();
  });
  it('rejects drawer width 1200 (above max)', () => {
    expect(() => editorOverridesSchema.parse({ global: { widthDesktop: 1200 } })).toThrow();
  });
  it('accepts widthMobilePct = 100', () => {
    editorOverridesSchema.parse({ global: { widthMobilePct: 100 } });
  });
  it('rejects emptyState.ctaLink = javascript:', () => {
    expect(() => editorOverridesSchema.parse({ emptyState: { ctaLink: 'javascript:alert(1)' } })).toThrow();
  });
  it('rejects emptyState.ctaLink = http://', () => {
    expect(() => editorOverridesSchema.parse({ emptyState: { ctaLink: 'http://x.com' } })).toThrow();
  });
  it('accepts emptyState.ctaLink = relative path', () => {
    editorOverridesSchema.parse({ emptyState: { ctaLink: '/collections/all' } });
  });
  it('accepts emptyState.ctaLink = https URL', () => {
    editorOverridesSchema.parse({ emptyState: { ctaLink: 'https://example.com/p' } });
  });
  it('rejects fontFamily with parens', () => {
    expect(() => editorOverridesSchema.parse({ global: { fontFamily: 'Times) expression(alert(1)' } })).toThrow();
  });
  it('strips unknown keys', () => {
    const r = editorOverridesSchema.parse({ header: { bogus: 1, title: 'OK' } } as any);
    expect((r.header as any).bogus).toBeUndefined();
    expect(r.header!.title).toBe('OK');
  });
  it('allows partial overrides (header only)', () => {
    const r = editorOverridesSchema.parse({ header: { title: 'X' } });
    expect(r.milestoneBar).toBeUndefined();
  });
  it('rejects body containing global.customCss', () => {
    expect(() => editorOverridesSchema.parse({ global: { customCss: '.x{}' } } as any)).toThrow();
  });
  it('rejects addon-owned paths via addonOwnedPaths guard', () => {
    expect(addonOwnedPaths.has('addons.milestone.tiers')).toBe(true);
    expect(addonOwnedPaths.has('addons.trustLine.providers')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
cd backend && npx vitest run __tests__/cart-editor/schema.test.ts
```

Expected: all 17 tests fail with "Cannot find module '@/lib/cart-editor/schema'".

- [ ] **Step 3: Implement schema**

Create `backend/src/lib/cart-editor/schema.ts`:

```ts
import { z } from 'zod';

// Hex color: 3, 6, or 8 digits. Normalizes to 6-digit.
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  .transform((s) => {
    const h = s.slice(1).toLowerCase();
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    if (h.length === 8) return '#' + h.slice(0, 6);
    return '#' + h;
  });

const safeString = (max: number) => z.string().max(max);

const ctaLink = z.string().max(500).refine(
  (v) => v.startsWith('/') || /^https:\/\//.test(v),
  { message: 'ctaLink must be a relative path or https URL' }
);

const fontFamily = z.string().max(100).regex(/^[a-zA-Z0-9 ,\-_'"]+$/);

const headerSchema = z.object({
  title: safeString(200).optional(),
  showItemCountBadge: z.boolean().optional(),
  badgeColor: hexColor.optional(),
  closeIcon: z.enum(['x', 'chevron', 'arrow']).optional(),
  bgColor: hexColor.optional(),
  borderStyle: z.enum(['none', 'line', 'shadow']).optional(),
  padding: z.enum(['compact', 'comfortable', 'roomy']).optional(),
}).strict();

const milestoneBarSchema = z.object({
  // tiers + enabled are addon-owned — NOT declared here
  preUnlockTemplate: safeString(200).optional(),
  unlockedTemplate: safeString(200).optional(),
  celebrationAnim: z.boolean().optional(),
  fillColor: hexColor.optional(),
  trackColor: hexColor.optional(),
  height: z.number().int().min(2).max(40).optional(),
  position: z.enum(['top', 'underHeader', 'aboveCheckout']).optional(),
  textSize: z.number().min(8).max(32).optional(),
  textWeight: z.number().int().min(100).max(900).optional(),
}).strict();

const lineItemSchema = z.object({
  imageSize: z.enum(['S', 'M', 'L']).optional(),
  imageShape: z.enum(['square', 'rounded', 'circle']).optional(),
  showVariant: z.boolean().optional(),
  showSku: z.boolean().optional(),
  qtyControl: z.enum(['minusPlus', 'stepper', 'dropdown']).optional(),
  removeStyle: z.enum(['x', 'trash', 'text']).optional(),
  showCompareAtPrice: z.boolean().optional(),
  showSavingsBadge: z.boolean().optional(),
  separator: z.enum(['line', 'spacing', 'card']).optional(),
  titleSize: z.number().min(8).max(32).optional(),
  titleWeight: z.number().int().min(100).max(900).optional(),
}).strict();

const emptyStateSchema = z.object({
  heading: safeString(200).optional(),
  subtext: safeString(200).optional(),
  icon: safeString(200).optional(),
  ctaLabel: safeString(200).optional(),
  ctaLink: ctaLink.optional(),
  ctaInheritsCheckoutStyle: z.boolean().optional(),
}).strict();

const footerSchema = z.object({
  showSubtotal: z.boolean().optional(),
  showShippingNote: z.boolean().optional(),
  showTaxNote: z.boolean().optional(),
  showYouSaved: z.boolean().optional(),
  showCrossedOutSubtotal: z.boolean().optional(),
  totalOutsideButton: z.boolean().optional(),
  totalLabel: safeString(200).optional(),
  totalSize: z.number().min(8).max(48).optional(),
  totalWeight: z.number().int().min(100).max(900).optional(),
  bgStyle: z.enum(['transparent', 'surface', 'accent']).optional(),
  borderTop: z.enum(['none', 'line', 'shadow']).optional(),
  showGiftNote: z.boolean().optional(),
}).strict();

const checkoutButtonSchema = z.object({
  label: safeString(200).optional(),
  bgColor: hexColor.optional(),
  bgHoverColor: hexColor.optional(),
  textColor: hexColor.optional(),
  radius: z.enum(['sharp', 'soft', 'rounded', 'pill']).optional(),
  height: z.enum(['S', 'M', 'L', 'XL']).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  letterSpacing: z.number().min(-2).max(10).optional(),
  icon: z.enum(['none', 'arrow', 'lock', 'cart']).optional(),
  fullWidth: z.boolean().optional(),
  loadingAnim: z.enum(['spinner', 'dots', 'shimmer']).optional(),
}).strict();

const trustLineSchema = z.object({
  // enabled + providers list are addon-owned
  text: safeString(200).optional(),
  showLockIcon: z.boolean().optional(),
  paymentIcons: z.record(z.string().max(40), z.boolean()).optional(),
  position: z.enum(['above', 'below']).optional(),
  textSize: z.number().min(8).max(24).optional(),
  textColor: hexColor.optional(),
}).strict();

const paletteSchema = z.object({
  bg: hexColor.optional(),
  surface: hexColor.optional(),
  text: hexColor.optional(),
  muted: hexColor.optional(),
  accent: hexColor.optional(),
  border: hexColor.optional(),
  success: hexColor.optional(),
  danger: hexColor.optional(),
}).strict();

const globalSchema = z.object({
  side: z.enum(['left', 'right']).optional(),
  widthDesktop: z.number().int().min(320).max(800).optional(),
  widthMobilePct: z.number().int().min(50).max(100).optional(),
  backdropColor: hexColor.optional(),
  backdropOpacity: z.number().min(0).max(1).optional(),
  openAnim: z.enum(['slide', 'fade', 'scale']).optional(),
  openDurationMs: z.number().int().min(100).max(600).optional(),
  palette: paletteSchema.optional(),
  fontFamily: fontFamily.optional(),
  baseFontSize: z.number().int().min(10).max(24).optional(),
  headingScale: z.number().min(1.0).max(1.8).optional(),
  spacing: z.enum(['compact', 'comfortable', 'roomy']).optional(),
  radius: z.enum(['sharp', 'soft', 'rounded']).optional(),
  // customCss intentionally NOT declared — .strict() rejects it
}).strict();

export const editorOverridesSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  header: headerSchema.optional(),
  milestoneBar: milestoneBarSchema.optional(),
  lineItem: lineItemSchema.optional(),
  emptyState: emptyStateSchema.optional(),
  footer: footerSchema.optional(),
  checkoutButton: checkoutButtonSchema.optional(),
  trustLine: trustLineSchema.optional(),
  global: globalSchema.optional(),
}).strict();

export type EditorOverrides = z.infer<typeof editorOverridesSchema>;

// Paths owned by the Addons tab — Cart Editor PUT must reject if body contains any of these
export const addonOwnedPaths = new Set<string>([
  'addons.milestone.enabled',
  'addons.milestone.tiers',
  'addons.trustLine.enabled',
  'addons.trustLine.providers',
  'addons.giftNote.enabled',
  'addons.giftNote.charLimit',
  'addons.giftNote.validation',
]);

/** Recursively walks a body and returns first addon-owned path found, or null. */
export function findAddonOwnedConflict(body: unknown, prefix = ''): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (addonOwnedPaths.has(path)) return path;
    if (v && typeof v === 'object') {
      const inner = findAddonOwnedConflict(v, path);
      if (inner) return inner;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
cd backend && npx vitest run __tests__/cart-editor/schema.test.ts
```

Expected: 17/17 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cart-editor/schema.ts backend/__tests__/cart-editor/schema.test.ts
git commit -m "feat(cart-editor): Zod schema + addon-owned path detection"
```

---

### Task 1.3: GET endpoint

**Files:**
- Create: `backend/src/app/api/cart-editor/[storeId]/config/route.ts`
- Test: `backend/__tests__/cart-editor/get-config.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/cart-editor/[storeId]/config/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

describe('GET /api/cart-editor/[storeId]/config', () => {
  let storeId: string;
  beforeEach(async () => {
    const s = await prisma.store.create({
      data: { shopDomain: `test-${Date.now()}.myshopify.com`, accessToken: 'x' },
    });
    storeId = s.id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: storeId } });
  });

  it('returns 200 with editorOverrides null on fresh store', async () => {
    const req = new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`);
    const res = await GET(req, { params: { storeId } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.editorOverrides).toBeNull();
    expect(body.editorOverridesVersion).toBe(0);
    expect(res.headers.get('ETag')).toBe('"ce-0"');
  });

  it('returns 404 for unknown storeId', async () => {
    const req = new NextRequest('http://localhost/api/cart-editor/nope/config');
    const res = await GET(req, { params: { storeId: 'nope' } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, expect failure** — route file does not exist.

- [ ] **Step 3: Implement GET route**

Create `backend/src/app/api/cart-editor/[storeId]/config/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateLimiter } from '@/lib/rate-limit';

const getLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });

export async function GET(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  if (!getLimiter.check(`ce:get:${storeId}`)) {
    return NextResponse.json({ error: 'Rate limited' }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { editorOverrides: true, editorOverridesVersion: true },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  const version = store.editorOverridesVersion ?? 0;
  return NextResponse.json(
    { editorOverrides: store.editorOverrides ?? null, editorOverridesVersion: version },
    { headers: { ETag: `"ce-${version}"`, 'Cache-Control': 'no-store' } }
  );
}
```

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/api/cart-editor backend/__tests__/cart-editor/get-config.test.ts
git commit -m "feat(cart-editor): GET /api/cart-editor/[storeId]/config"
```

---

### Task 1.4: PUT endpoint with Zod validation, ownership check, If-Match, rate limit

**Files:**
- Modify: `backend/src/app/api/cart-editor/[storeId]/config/route.ts`
- Test: `backend/__tests__/cart-editor/put-config.test.ts`

- [ ] **Step 1: Write failing tests** — 10 tests covering all PUT scenarios in spec §8.3:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, PUT } from '@/app/api/cart-editor/[storeId]/config/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

function putReq(storeId: string, body: any, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/cart-editor/[storeId]/config', () => {
  let storeId: string;
  beforeEach(async () => {
    const s = await prisma.store.create({
      data: { shopDomain: `put-${Date.now()}.myshopify.com`, accessToken: 'x' },
    });
    storeId = s.id;
  });
  afterEach(async () => {
    await prisma.store.deleteMany({ where: { id: storeId } });
  });

  it('writes editorOverrides only', async () => {
    const res = await PUT(
      putReq(storeId, { editorOverrides: { header: { title: 'My Cart' } } }, { 'If-Match': '"ce-0"' }),
      { params: { storeId } }
    );
    expect(res.status).toBe(200);
    const after = await prisma.store.findUnique({ where: { id: storeId } });
    expect((after!.editorOverrides as any).header.title).toBe('My Cart');
    // schema default of config may be null OR {} depending on Prisma — accept either
    const cfg = after!.config as any;
    expect(cfg == null || Object.keys(cfg).length === 0).toBe(true);
  });

  it('bumps editorOverridesVersion by exactly 1', async () => {
    await PUT(putReq(storeId, { editorOverrides: { header: { title: 'A' } } }, { 'If-Match': '"ce-0"' }), { params: { storeId } });
    await PUT(putReq(storeId, { editorOverrides: { header: { title: 'B' } } }, { 'If-Match': '"ce-1"' }), { params: { storeId } });
    const after = await prisma.store.findUnique({ where: { id: storeId } });
    expect(after!.editorOverridesVersion).toBe(2);
  });

  it('does not touch config or featureFlags fields', async () => {
    await prisma.store.update({ where: { id: storeId }, data: { config: { foo: 1 } as any, featureFlags: { bar: true } as any } });
    await PUT(putReq(storeId, { editorOverrides: {} }, { 'If-Match': '"ce-0"' }), { params: { storeId } });
    const after = await prisma.store.findUnique({ where: { id: storeId } });
    expect((after!.config as any).foo).toBe(1);
    expect((after!.featureFlags as any).bar).toBe(true);
  });

  it('returns 409 on stale If-Match', async () => {
    await PUT(putReq(storeId, { editorOverrides: { header: { title: 'A' } } }, { 'If-Match': '"ce-0"' }), { params: { storeId } });
    const res = await PUT(putReq(storeId, { editorOverrides: { header: { title: 'B' } } }, { 'If-Match': '"ce-0"' }), { params: { storeId } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.currentVersion).toBe(1);
  });

  it('rate-limits after 10 saves in 60s', async () => {
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await PUT(putReq(storeId, { editorOverrides: {} }, { 'If-Match': `"ce-${i}"` }), { params: { storeId } });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('returns 400 with conflict info for addon-owned path', async () => {
    const res = await PUT(
      putReq(storeId, { editorOverrides: {}, addons: { milestone: { tiers: [] } } }, { 'If-Match': '"ce-0"' }),
      { params: { storeId } }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/addon-owned/i);
    expect(body.conflictPath).toBe('addons.milestone.tiers');
  });

  it('returns 400 with field name for Zod failure', async () => {
    const res = await PUT(
      putReq(storeId, { editorOverrides: { header: { badgeColor: 'red' } } }, { 'If-Match': '"ce-0"' }),
      { params: { storeId } }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/badgeColor/);
  });

  it('returns new editorOverridesVersion + ETag in response', async () => {
    const res = await PUT(putReq(storeId, { editorOverrides: { header: { title: 'X' } } }, { 'If-Match': '"ce-0"' }), { params: { storeId } });
    expect(res.headers.get('ETag')).toBe('"ce-1"');
    const body = await res.json();
    expect(body.editorOverridesVersion).toBe(1);
  });

  it('rejects body containing global.customCss', async () => {
    const res = await PUT(
      putReq(storeId, { editorOverrides: { global: { customCss: '.x{}' } } }, { 'If-Match': '"ce-0"' }),
      { params: { storeId } }
    );
    expect(res.status).toBe(400);
  });

  it('accepts missing schemaVersion (defaults to 1)', async () => {
    const res = await PUT(
      putReq(storeId, { editorOverrides: { header: { title: 'Y' } } }, { 'If-Match': '"ce-0"' }),
      { params: { storeId } }
    );
    expect(res.status).toBe(200);
    const after = await prisma.store.findUnique({ where: { id: storeId } });
    expect((after!.editorOverrides as any).schemaVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, expect failure** — `PUT` not exported yet.

- [ ] **Step 3: Implement PUT in same route file**

Append to `backend/src/app/api/cart-editor/[storeId]/config/route.ts`:

```ts
import { editorOverridesSchema, findAddonOwnedConflict } from '@/lib/cart-editor/schema';
import { revalidateTag } from 'next/cache';

const putLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });

export async function PUT(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  if (!putLimiter.check(`ce:put:${storeId}`)) {
    return NextResponse.json({ error: 'Rate limited' }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  let raw: any;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 1. Ownership guard
  const conflict = findAddonOwnedConflict(raw);
  if (conflict) {
    return NextResponse.json(
      { error: `Field ${conflict} is addon-owned (edit in Addons tab)`, conflictPath: conflict },
      { status: 400 }
    );
  }

  // 2. Zod validation
  const parsed = editorOverridesSchema.safeParse(raw.editorOverrides ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Validation failed: ${issue.path.join('.')} — ${issue.message}`, issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // 3. If-Match concurrency
  const ifMatch = req.headers.get('If-Match');
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { editorOverridesVersion: true },
  });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const currentVersion = store.editorOverridesVersion ?? 0;
  if (ifMatch && ifMatch !== `"ce-${currentVersion}"`) {
    return NextResponse.json(
      { error: 'Version conflict', currentVersion },
      { status: 409, headers: { ETag: `"ce-${currentVersion}"` } }
    );
  }

  // 4. Persist + bump version atomically
  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      editorOverrides: parsed.data as any,
      editorOverridesVersion: { increment: 1 },
    },
    select: { editorOverrides: true, editorOverridesVersion: true },
  });

  // 5. Cache bust
  try { revalidateTag(`cart-config:${storeId}`); } catch {}

  return NextResponse.json(
    {
      editorOverrides: updated.editorOverrides,
      editorOverridesVersion: updated.editorOverridesVersion,
    },
    { headers: { ETag: `"ce-${updated.editorOverridesVersion}"` } }
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
cd backend && npx vitest run __tests__/cart-editor/put-config.test.ts
```

Expected: 10/10 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/api/cart-editor backend/__tests__/cart-editor/put-config.test.ts
git commit -m "feat(cart-editor): PUT with Zod + ownership + If-Match + rate limit"
```

---

### Task 1.5: Feature flag wrapper

**Files:**
- Modify: `backend/src/app/api/cart-editor/[storeId]/config/route.ts`

- [ ] **Step 1: Wrap GET + PUT in feature-flag check**

At the top of each handler, before any work:

```ts
if (process.env.CART_EDITOR_API_ENABLED !== 'true') {
  return NextResponse.json({ error: 'Cart Editor API disabled' }, { status: 404 });
}
```

- [ ] **Step 2: Update tests to set env**

Add to each test file's top-level:
```ts
process.env.CART_EDITOR_API_ENABLED = 'true';
```

- [ ] **Step 3: Run all cart-editor tests, expect pass**

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/api/cart-editor backend/__tests__/cart-editor
git commit -m "feat(cart-editor): gate API behind CART_EDITOR_API_ENABLED flag"
```

---

### Task 1.6: Stage 1 deploy checkpoint

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: all existing + new tests pass. Note baseline + 17 schema + 2 GET + 10 PUT = 29 new tests pass.

- [ ] **Step 2: Set Railway env var (do NOT enable in production yet)**

```bash
railway variables set CART_EDITOR_API_ENABLED=false
```

- [ ] **Step 3: Deploy**

```bash
cd backend && npm run deploy
```

- [ ] **Step 4: Verify with curl** (API should 404 because flag is false):

```bash
curl -i "$RAILWAY_URL/api/cart-editor/$STORE_ID/config"
```

Expected: 404. This confirms the feature flag works.

---

## Chunk 1 end — dispatch plan-document-reviewer here before proceeding.

---

## Chunk 2: Stage 2 — v14-complete.js fallback reads + shopper proxy cache

### Task 2.1: Document every field's fallback target

**Files:**
- Create: `backend/src/lib/cart-editor/v14-field-map.md`

- [ ] **Step 1: Write the field map**

Create the file listing every editor field, its source line in `v14-complete.js`, and the fallback value. This is reference material the contract tests will assert against. Example rows:

```
| Editor field | v14 read site | Fallback default |
|---|---|---|
| header.title | injectHeader() | 'Your Cart' |
| header.showItemCountBadge | renderBadge() | true |
| checkoutButton.label | renderCheckoutBtn() | 'Checkout · ' + total |
| footer.totalOutsideButton | renderFooter() | false (button shows total) |
| ...
```

Fill the rest by grepping `v14-complete.js` for each existing literal that the editor will now override.

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/cart-editor/v14-field-map.md
git commit -m "docs(cart-editor): v14 field-to-fallback map"
```

---

### Task 2.2: Add structural-equivalence helper (shared infra for Stage 2 + 3)

**Files:**
- Create: `tests/helpers/structural-equiv.js`

- [ ] **Step 1: Implement helper**

```js
// tests/helpers/structural-equiv.js
// Compares two DOM trees ignoring whitespace text nodes, hidden elements,
// and data-cart-editor-* attributes added by the editor overlay.

const IGNORED_ATTR_PREFIXES = ['data-cart-editor-'];

function isHidden(el) {
  if (!el || !el.getAttribute) return false;
  if (el.hasAttribute('hidden')) return true;
  const style = el.getAttribute('style') || '';
  return /display\s*:\s*none/i.test(style);
}

function normalizeAttrs(el) {
  const out = {};
  for (const { name, value } of Array.from(el.attributes)) {
    if (IGNORED_ATTR_PREFIXES.some(p => name.startsWith(p))) continue;
    out[name] = value.trim();
  }
  return out;
}

function compare(a, b, path = 'root') {
  if (!a && !b) return null;
  if (!a || !b) return `${path}: presence mismatch (${!!a} vs ${!!b})`;
  if (isHidden(a) && isHidden(b)) return null;
  if (a.nodeType === 3 && b.nodeType === 3) {
    const ta = (a.textContent || '').trim();
    const tb = (b.textContent || '').trim();
    if (ta !== tb) return `${path}: text "${ta}" !== "${tb}"`;
    return null;
  }
  if (a.tagName !== b.tagName) return `${path}: tag ${a.tagName} !== ${b.tagName}`;
  const aa = normalizeAttrs(a), ba = normalizeAttrs(b);
  const keys = new Set([...Object.keys(aa), ...Object.keys(ba)]);
  for (const k of keys) {
    if (aa[k] !== ba[k]) return `${path}@${a.tagName}: attr ${k} "${aa[k]}" !== "${ba[k]}"`;
  }
  const ac = Array.from(a.childNodes).filter(n => !(n.nodeType === 3 && !(n.textContent || '').trim()));
  const bc = Array.from(b.childNodes).filter(n => !(n.nodeType === 3 && !(n.textContent || '').trim()));
  const visAc = ac.filter(n => !isHidden(n));
  const visBc = bc.filter(n => !isHidden(n));
  if (visAc.length !== visBc.length) return `${path}@${a.tagName}: child count ${visAc.length} !== ${visBc.length}`;
  for (let i = 0; i < visAc.length; i++) {
    const r = compare(visAc[i], visBc[i], `${path}/${a.tagName}[${i}]`);
    if (r) return r;
  }
  return null;
}

module.exports = { compare };
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/structural-equiv.js
git commit -m "test(cart-editor): structural-equivalence DOM helper"
```

---

### Task 2.3: Snapshot pre-Stage-2 production cart HTML

**Files:**
- Create: `tests/snapshots/cart-pre-editor.html`

- [ ] **Step 1: Capture snapshot**

Render the current production cart HTML using the existing `cart-constants.ts` CONTROL_HTML + `v14-complete.js` render path against a known fixture (3 items, milestone halfway). Save the rendered HTML to the snapshot file.

```bash
node tests/scripts/snapshot-current-cart.js > tests/snapshots/cart-pre-editor.html
```

If `tests/scripts/snapshot-current-cart.js` doesn't exist yet, create it using JSDOM + the existing snapshot.js infrastructure in `tests/`.

- [ ] **Step 2: Commit**

```bash
git add tests/snapshots/cart-pre-editor.html tests/scripts/snapshot-current-cart.js
git commit -m "test(cart-editor): pre-Stage-2 cart HTML baseline snapshot"
```

---

### Task 2.4: Add fallback reads in v14-complete.js — one field group per commit

**Files:**
- Modify: `extensions/cart-drawer/assets/v14-complete.js`
- Test: `tests/contract.test.js`

For each of the 8 field groups (`header`, `milestoneBar`, `lineItem`, `emptyState`, `footer`, `checkoutButton`, `trustLine`, `global`), repeat steps below as a separate sub-task. Document below shows the `header` group; the other 7 follow the same pattern.

**Ordering note:** Sub-task 2.4.h's Step 4 references `tests/blast-radius/cart-editor.test.js`, which is created in Task 2.5. For the FIRST sub-task (header), Step 4 only runs `node tests/contract.test.js` and skips the blast-radius command. After Task 2.5 ships, sub-tasks 2.4.milestoneBar through 2.4.global all run BOTH commands in Step 4.

**Per-group test counts** (sum = 60 to match spec §8.6):
- `header` ≈ 7 tests | `milestoneBar` ≈ 8 | `lineItem` ≈ 8 | `emptyState` ≈ 5 | `footer` ≈ 7 | `checkoutButton` ≈ 9 | `trustLine` ≈ 7 | `global` ≈ 9 → total 60

#### Sub-tasks 2.4.* (one checkbox per group, do not collapse into one mega-commit)

- [ ] **2.4.h Header** — detailed pattern below
- [ ] **2.4.m MilestoneBar** — same 5-step pattern, paths under `editorOverrides.milestoneBar.*`
- [ ] **2.4.l LineItem** — same
- [ ] **2.4.e EmptyState** — same
- [ ] **2.4.f Footer** — same
- [ ] **2.4.b CheckoutButton** — same
- [ ] **2.4.t TrustLine** — same
- [ ] **2.4.g Global** — same

#### Sub-task 2.4.h: Header fallback reads

- [ ] **Step 1: Write failing contract tests**

Append to `tests/contract.test.js`:

```js
test('v14: header.title read from cfg.editorOverrides.header.title with fallback', () => {
  const src = readSync('extensions/cart-drawer/assets/v14-complete.js');
  // Read site is present
  assert.match(src, /cfg\.editorOverrides\?\.header\?\.title/);
  // Fallback default still present
  assert.match(src, /\|\|\s*['"]Your Cart['"]/);
});
test('v14: header.showItemCountBadge fallback to true', () => {
  const src = readSync('extensions/cart-drawer/assets/v14-complete.js');
  assert.match(src, /cfg\.editorOverrides\?\.header\?\.showItemCountBadge/);
});
// ... one test per header field (7 fields = 7 tests)
```

- [ ] **Step 2: Run, expect failure**

```bash
node tests/contract.test.js
```

- [ ] **Step 3: Add fallback reads in v14-complete.js**

At each header render site, swap literal for `(cfg.editorOverrides?.header?.title) || 'Your Cart'` pattern. Do NOT change defaults — the fallback must be exactly what the code did before.

- [ ] **Step 4: Run contract tests + structural-equivalence lock**

```bash
node tests/contract.test.js
node tests/blast-radius/cart-editor.test.js  # created in Task 2.5 below
```

Expected: header tests pass. Structural-equiv with `editorOverrides = null` still matches pre-Stage-2 snapshot.

- [ ] **Step 5: Commit**

```bash
git add extensions/cart-drawer/assets/v14-complete.js tests/contract.test.js
git commit -m "feat(cart-editor): v14 header fallback reads + contract tests"
```

Repeat for groups `milestoneBar`, `lineItem`, `emptyState`, `footer`, `checkoutButton`, `trustLine`, `global` — 7 more commits.

Final count after all sub-tasks: ~60 new contract tests (matches spec §8.1).

---

### Task 2.5: Blast-radius lock test #1 + #2 — null and {} structural equivalence

**Files:**
- Create: `tests/blast-radius/cart-editor.test.js`

- [ ] **Step 1: Write the two locks**

```js
const { compare } = require('../helpers/structural-equiv');
const { renderCart } = require('../helpers/render-cart');
const fs = require('fs');
const path = require('path');

test('LOCK 1: editorOverrides=null is structurally equivalent to pre-Stage-2 snapshot', () => {
  const baselineHtml = fs.readFileSync(path.join(__dirname, '../snapshots/cart-pre-editor.html'), 'utf8');
  const rendered = renderCart({ editorOverrides: null });
  const diff = compare(parseDom(baselineHtml), parseDom(rendered));
  assert.equal(diff, null, `Structural difference: ${diff}`);
});

test('LOCK 2: editorOverrides={} (schemaVersion 1) is equivalent to null', () => {
  const a = renderCart({ editorOverrides: null });
  const b = renderCart({ editorOverrides: { schemaVersion: 1 } });
  assert.equal(compare(parseDom(a), parseDom(b)), null);
});
```

`tests/helpers/render-cart.js` is a thin JSDOM wrapper that loads `v14-complete.js` against a fixture window with `window.CCD_CONFIG = { editorOverrides }` and returns the resulting `#CCD-Drawer` innerHTML.

- [ ] **Step 2: Run, expect pass** (because Task 2.4 already verified incrementally per group).

- [ ] **Step 3: Commit**

```bash
git add tests/blast-radius/cart-editor.test.js tests/helpers/render-cart.js
git commit -m "test(cart-editor): blast-radius locks 1+2 (null/{} ≡ baseline)"
```

---

### Task 2.6: Blast-radius locks 3, 4, 6 (scoped isolation, addon isolation, idempotency)

**Files:**
- Modify: `tests/blast-radius/cart-editor.test.js`

- [ ] **Step 1: Add three lock tests**

```js
test('LOCK 3: scoped change only mutates footer/button region', () => {
  const baseline = renderCart({ editorOverrides: null });
  const scoped = renderCart({ editorOverrides: { footer: { totalOutsideButton: true } } });
  // Footer region differs (allowed); all OTHER regions must be equivalent.
  for (const region of ['header', 'milestone', 'items', 'empty', 'trust', 'global-bg']) {
    const a = pick(baseline, region);
    const b = pick(scoped, region);
    assert.equal(compare(a, b), null, `Region ${region} should be unchanged`);
  }
});

test('LOCK 4: Addon-owned values pass through unchanged', () => {
  // Use sentinel values that could NOT appear from defaults — proves addonCfg path
  const sentinelLabel = 'SENTINEL-LOCK4-' + Date.now();
  const sentinelThreshold = 12345;
  const addonCfg = { milestone: { tiers: [{ threshold: sentinelThreshold, label: sentinelLabel }], enabled: true } };
  const rendered = renderCart({
    addons: addonCfg,
    editorOverrides: { milestoneBar: { fillColor: '#ff0000' } },
  });
  // Tiers still come from addons (data integrity) — sentinel proves source
  assert.ok(rendered.includes(sentinelLabel), 'milestone label must come from addonCfg, not defaults');
  assert.ok(rendered.includes(String(sentinelThreshold)), 'milestone threshold must come from addonCfg');
  // And the editorOverrides visual DID apply
  assert.match(rendered, /#ff0000/);
});

test('LOCK 6: rendering twice is idempotent (byte-identical + structurally-equivalent)', () => {
  const cfg = { editorOverrides: { header: { title: 'X' } } };
  const a = renderCart(cfg);
  const b = renderCart(cfg);
  // Byte-identical — required so sessionStorage cache keys match across renders
  assert.equal(a, b, 'renderCart must produce byte-identical output for cache correctness');
  // Structural-equiv as a secondary check (catches whitespace-only diffs explicitly)
  assert.equal(compare(parseDom(a), parseDom(b)), null);
});
```

- [ ] **Step 2: Run, expect pass**

- [ ] **Step 3: Commit**

```bash
git add tests/blast-radius/cart-editor.test.js
git commit -m "test(cart-editor): blast-radius locks 3, 4, 6"
```

LOCK 5 (production smoke replay) runs only as the Stage 2 deploy gate — see Task 2.8.

---

### Task 2.7: Shopper proxy — version + ETag + cache headers

**Files:**
- Modify: `backend/src/app/api/proxy/config/route.ts:84-137`

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/cart-editor/proxy-config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/proxy/config/route';
import { prisma } from '@/lib/prisma';

describe('proxy /api/proxy/config — editor overrides flow-through', () => {
  let storeId: string;
  beforeEach(async () => {
    const s = await prisma.store.create({
      data: {
        shopDomain: `proxy-${Date.now()}.myshopify.com`,
        accessToken: 'x',
        editorOverrides: { schemaVersion: 1, header: { title: 'Hi' } } as any,
        editorOverridesVersion: 3,
      },
    });
    storeId = s.id;
  });
  afterEach(async () => { await prisma.store.deleteMany({ where: { id: storeId } }); });

  it('includes editorOverrides + version in response', async () => {
    // Use the HMAC-bypass test mode (existing pattern in proxy/event test)
    const req = makeSignedRequest({ shop: 'proxy-...myshopify.com' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.cartConfig.editorOverrides.header.title).toBe('Hi');
    expect(body.cartConfig.editorOverridesVersion).toBe(3);
  });

  it('sets ETag header', async () => {
    const res = await GET(makeSignedRequest({ shop: '...' }));
    expect(res.headers.get('ETag')).toBe('"ce-3"');
  });

  it('uses s-maxage cache control (not no-store)', async () => {
    const res = await GET(makeSignedRequest({ shop: '...' }));
    expect(res.headers.get('Cache-Control')).toMatch(/s-maxage=300/);
    expect(res.headers.get('Cache-Control')).toMatch(/stale-while-revalidate=60/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Modify proxy response**

In `backend/src/app/api/proxy/config/route.ts`, change step 9 (lines ~121-137):

1. Include `editorOverrides` and `editorOverridesVersion` in the returned `cartConfig`:
```ts
const cartConfigBase = isDemo && ... ? store.demoConfig : store.config;
const cartConfigOut = {
  ...(cartConfigBase as any),
  editorOverrides: (store as any).editorOverrides ?? null,
  editorOverridesVersion: (store as any).editorOverridesVersion ?? 0,
  ...(jsUrl ? { _jsUrl: jsUrl } : {}),
  ...(cssUrl ? { _cssUrl: cssUrl } : {}),
  featureFlags,
};
```

2. Change `Cache-Control` from `no-store, no-cache, must-revalidate` to:
```ts
headers: {
  'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
  'ETag': `"ce-${(store as any).editorOverridesVersion ?? 0}"`,
  // NOTE: deliberately omit `Vary: Cookie` — shopper proxy carries no dashboard cookie, and a per-cookie Vary would shatter the CDN cache (every shopper session has a unique cookie), defeating s-maxage. Cache key is path-based (includes storeId).
},
```

3. Select the new fields in the Prisma query (add `editorOverrides: true, editorOverridesVersion: true` to the `select` if one exists; otherwise the default findUnique returns them).

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/api/proxy/config/route.ts backend/__tests__/cart-editor/proxy-config.test.ts
git commit -m "feat(cart-editor): proxy serves editorOverrides + ETag + s-maxage cache"
```

---

### Task 2.8: Version-based cache invalidation in v14-complete.js (sessionStorage)

**Files:**
- Modify: `extensions/cart-drawer/assets/v14-complete.js`
- Modify: `tests/contract.test.js`

**Cache layer note:** Spec §6.2.1 lists three cache layers. Layer 2 — `revalidateTag('cart-config:' + storeId)` after PUT — was already wired in Chunk 1 Task 1.4 Step 3 (see plan line ~639). This Task 2.8 implements **layer 3** — runtime invalidation inside the shopper's browser via sessionStorage. Layer 1 (DB version + ETag) is in Task 2.7. All three layers must be present for cache correctness.

- [ ] **Step 1: Write failing contract test**

```js
test('v14: invalidates cached HTML when editorOverridesVersion changes', () => {
  const src = readSync('extensions/cart-drawer/assets/v14-complete.js');
  assert.match(src, /sessionStorage\.getItem\(['"]ccd:cfgVersion['"]\)/);
  assert.match(src, /sessionStorage\.setItem\(['"]ccd:cfgVersion['"]/);
});
```

- [ ] **Step 2: Implement cache-key check**

Inside `v14-complete.js` cart-open handler, before reading cached HTML from sessionStorage:

```js
var cachedVer = sessionStorage.getItem('ccd:cfgVersion');
var currentVer = String(cfg.editorOverridesVersion || 0);
if (cachedVer !== currentVer) {
  sessionStorage.removeItem('ccd:cachedHtml');
  sessionStorage.setItem('ccd:cfgVersion', currentVer);
}
```

- [ ] **Step 3: Run, expect pass**

- [ ] **Step 4: Commit**

```bash
git add extensions/cart-drawer/assets/v14-complete.js tests/contract.test.js
git commit -m "feat(cart-editor): version-based runtime cache invalidation"
```

---

### Task 2.9: Stage 2 deploy gate — LOCK 5 (production smoke replay)

- [ ] **Step 1: Capture live production cart HTML**

```bash
node tests/scripts/snapshot-production-cart.js > tests/snapshots/cart-prod-stage2-gate.html
```

(Hits the demo store's app proxy with `editorOverrides=null` enforced.)

- [ ] **Step 2: Add LOCK 5 to `tests/blast-radius/cart-editor.test.js`**

```js
test('LOCK 5 (deploy gate): production HTML structurally equiv to renderCart({null})', () => {
  const prod = fs.readFileSync('tests/snapshots/cart-prod-stage2-gate.html', 'utf8');
  const rendered = renderCart({ editorOverrides: null });
  assert.equal(compare(parseDom(prod), parseDom(rendered)), null);
});
```

- [ ] **Step 3: Run full test suite**

```bash
cd backend && npm test
node tests/contract.test.js
node tests/blast-radius/cart-editor.test.js
```

Expected: all 6 blast-radius locks pass + all contract + all unit tests.

- [ ] **Step 4: Deploy backend + v14-complete.js with editor feature flag OFF**

Backend ships first (proxy change is no-op while every store has `editorOverrides=null` and `editorOverridesVersion=0`). v14-complete.js ships next — its fallback reads are no-op when `editorOverrides` is absent.

```bash
cd backend && npm run deploy
# Then upload v14-complete.js to extension via existing deploy flow
```

Safe-deploy rationale: at this point NO store has `editorOverrides` populated (Stage 1 deployed Chunk 1's API behind `CART_EDITOR_API_ENABLED=false`). So both backend and extension changes produce structurally-identical output to pre-deploy for every shopper. LOCK 1+2+5 prove this.

- [ ] **Step 5: Verify on DEMO theme BEFORE tagging**

Open DEMO theme cart in incognito → confirm structurally identical to pre-deploy. Use browser DevTools to compare against `tests/snapshots/cart-prod-stage2-gate.html`. If structurally different, **revert immediately** — do not tag.

- [ ] **Step 6: Verify on a real LIVE store (read-only sanity check)**

Open the production store's cart drawer in incognito → confirm it still renders. No structural diff expected. If issues, revert the deploy.

- [ ] **Step 7: Tag Stage 2 release** (only after Steps 5+6 pass)

```bash
git tag cart-editor-stage-2
git push --tags
```

---

## Chunk 2 end — dispatch plan-document-reviewer here before proceeding.

---

## Chunk 3: Stage 3a — Editor shell, draft store, preview canvas

### Task 3.1: Cart Editor page scaffold + feature-flag gate

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/page.tsx`
- Modify: `backend/src/app/dashboard/layout.tsx` (add tab nav link)

- [ ] **Step 1: Write minimal page**

```tsx
'use client';
export default function CartEditorPage() {
  if (process.env.NEXT_PUBLIC_CART_EDITOR_ENABLED !== 'true') {
    return <div className="p-8">Cart Editor coming soon.</div>;
  }
  return (
    <div className="grid grid-cols-[55%_45%] h-[calc(100vh-64px)]">
      <div data-cart-editor-preview className="border-r border-zinc-800">Preview placeholder</div>
      <div data-cart-editor-panel>Settings placeholder</div>
    </div>
  );
}
```

- [ ] **Step 2: Add tab nav link** in `layout.tsx` next to Addons/A-B Tests tabs.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor backend/src/app/dashboard/layout.tsx
git commit -m "feat(cart-editor): page scaffold + nav tab (flag-gated)"
```

---

### Task 3.2: Draft store (React Context with BroadcastChannel + localStorage)

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/draft-store.tsx`
- Test: `backend/__tests__/cart-editor/draft-store.test.tsx`

- [ ] **Step 1: Write 11 failing tests** matching spec §8.3 `describe('draft store')` block.

  Banner discriminator note — there are **two distinct conflict kinds**:
  - `incoming-while-dirty` — another tab broadcast a saved version while THIS tab has unsaved changes (BroadcastChannel/storage event path)
  - `server-conflict-409` — our own PUT returned 409 because savedVersion drifted (rare; happens when BroadcastChannel was missed, e.g. tab was suspended)

  Both expose `incomingVersion` and `incomingOverrides` so the user can `acceptIncoming()` either way, but the banner UI labels them differently. Test #7 covers `incoming-while-dirty`; test #10 covers `server-conflict-409`.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DraftStoreProvider, useDraftStore } from '@/app/dashboard/cart-editor/draft-store';

const wrap = (storeId = 's1') => ({ children }: any) => (
  <DraftStoreProvider storeId={storeId} initial={{ editorOverrides: null, editorOverridesVersion: 0 }}>
    {children}
  </DraftStoreProvider>
);

describe('draft-store', () => {
  beforeEach(() => { localStorage.clear(); });

  it('setField updates path and marks dirty', () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Hi'));
    expect(result.current.draft.header?.title).toBe('Hi');
    expect(result.current.isDirty).toBe(true);
  });

  it('setField on same path twice — last write wins', () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => { result.current.setField('header.title', 'A'); result.current.setField('header.title', 'B'); });
    expect(result.current.draft.header?.title).toBe('B');
  });

  it('discard reverts to savedConfig', () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'X'));
    act(() => result.current.discard());
    expect(result.current.draft.header?.title).toBeUndefined();
    expect(result.current.isDirty).toBe(false);
  });

  it('save clears dirty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ editorOverrides: { header: { title: 'X' } }, editorOverridesVersion: 1 }) });
    (global as any).fetch = fetchMock;
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'X'));
    await act(async () => { await result.current.save(); });
    expect(result.current.isDirty).toBe(false);
  });

  it('concurrent setField on different paths merges', () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => { result.current.setField('header.title', 'A'); result.current.setField('footer.totalLabel', 'Total'); });
    expect(result.current.draft.header?.title).toBe('A');
    expect(result.current.draft.footer?.totalLabel).toBe('Total');
  });

  it('BroadcastChannel saved message updates savedConfig when not dirty', async () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => {
      const ch = new BroadcastChannel('cart-editor:s1');
      ch.postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'From other tab' } } });
    });
    // BroadcastChannel delivery is async via macrotask in jsdom — flush with setTimeout(0)
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.savedConfig.header?.title).toBe('From other tab');
    expect(result.current.draft.header?.title).toBe('From other tab');
  });

  it('BroadcastChannel saved shows banner when isDirty (no clobber)', async () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Mine'));
    act(() => {
      new BroadcastChannel('cart-editor:s1').postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'Theirs' } } });
    });
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.draft.header?.title).toBe('Mine'); // not clobbered
    // 'incoming-while-dirty' = another tab/admin saved while we have unsaved changes
    expect(result.current.crossTabBanner).toEqual({
      kind: 'incoming-while-dirty',
      incomingVersion: 7,
      incomingOverrides: { header: { title: 'Theirs' } },
    });
  });

  it('dismissBanner clears crossTabBanner but keeps draft', async () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Mine'));
    act(() => {
      new BroadcastChannel('cart-editor:s1').postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'Theirs' } } });
    });
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.crossTabBanner).not.toBeNull();
    act(() => result.current.dismissBanner());
    expect(result.current.crossTabBanner).toBeNull();
    expect(result.current.draft.header?.title).toBe('Mine'); // draft untouched
    expect(result.current.isDirty).toBe(true);
  });

  it('acceptIncoming replaces draft with incoming overrides + clears dirty', async () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Mine'));
    act(() => {
      new BroadcastChannel('cart-editor:s1').postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'Theirs' } } });
    });
    await new Promise(r => setTimeout(r, 0));
    act(() => result.current.acceptIncoming());
    expect(result.current.draft.header?.title).toBe('Theirs');
    expect(result.current.savedConfig.header?.title).toBe('Theirs');
    expect(result.current.savedVersion).toBe(7);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.crossTabBanner).toBeNull();
  });

  it('save 409 conflict surfaces server-conflict-409 banner (distinct from incoming-while-dirty)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ currentVersion: 5, currentOverrides: { header: { title: 'Server wins' } } }),
    });
    (global as any).fetch = fetchMock;
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Mine'));
    await act(async () => { await result.current.save(); });
    expect(result.current.crossTabBanner).toEqual({
      kind: 'server-conflict-409',
      incomingVersion: 5,
      incomingOverrides: { header: { title: 'Server wins' } },
    });
    expect(result.current.isDirty).toBe(true); // save failed, still dirty
  });

  it('localStorage fallback updates when no BroadcastChannel', async () => {
    const originalBC = (global as any).BroadcastChannel;
    delete (global as any).BroadcastChannel;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ editorOverrides: { header: { title: 'Via LS' } }, editorOverridesVersion: 9 }) });
    (global as any).fetch = fetchMock;
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => {
      localStorage.setItem('cart-editor:s1:lastSaveVersion', '9');
      window.dispatchEvent(new StorageEvent('storage', { key: 'cart-editor:s1:lastSaveVersion', newValue: '9' }));
    });
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.savedConfig.header?.title).toBe('Via LS');
    (global as any).BroadcastChannel = originalBC;
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement DraftStoreProvider**

Create `backend/src/app/dashboard/cart-editor/draft-store.tsx` with React Context exposing `{ draft, savedConfig, isDirty, savedVersion, crossTabBanner, setField, discard, save, dismissBanner, acceptIncoming }`. Use `useReducer` internally. Listen on:
- BroadcastChannel `cart-editor:${storeId}` for `saved` messages
- `storage` event for `cart-editor:${storeId}:lastSaveVersion` key
- `setField(path, value)` updates `draft` immutably via lodash-style path setter (write a tiny inline `setIn(obj, path, val)` to avoid the dependency)

`crossTabBanner` type:
```ts
type CrossTabBanner =
  | null
  | { kind: 'incoming-while-dirty'; incomingVersion: number; incomingOverrides: EditorOverrides }
  | { kind: 'server-conflict-409';  incomingVersion: number; incomingOverrides: EditorOverrides };
```

Behavior:
- **BroadcastChannel/storage `saved` event arrives while `isDirty === false`**: replace savedConfig + draft + savedVersion silently. No banner.
- **BroadcastChannel/storage `saved` event arrives while `isDirty === true`**: do NOT clobber draft. Set `crossTabBanner = { kind: 'incoming-while-dirty', incomingVersion, incomingOverrides }`.
- **`save()`**: PUT `/api/cart-editor/${storeId}/config` with `If-Match: "ce-${savedVersion}"`. On 200, update savedConfig + savedVersion + isDirty=false + post `{ kind: 'saved', version, editorOverrides }` to BroadcastChannel + write `lastSaveVersion` to localStorage. On 409, parse `{ currentVersion, currentOverrides }` from response, set `crossTabBanner = { kind: 'server-conflict-409', incomingVersion: currentVersion, incomingOverrides: currentOverrides }`, keep `isDirty = true`. On other errors, throw.
- **`dismissBanner()`**: set `crossTabBanner = null`. Do not touch draft, savedConfig, or savedVersion.
- **`acceptIncoming()`**: requires `crossTabBanner !== null`. Set `draft = incomingOverrides`, `savedConfig = incomingOverrides`, `savedVersion = incomingVersion`, `isDirty = false`, `crossTabBanner = null`.

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/draft-store.tsx backend/__tests__/cart-editor/draft-store.test.tsx
git commit -m "feat(cart-editor): draft store with cross-tab sync"
```

---

### Task 3.3: Preview canvas — same-DOM renderer driven by editorOverrides (spec §3.3 compliant)

**Spec alignment (§3.3):** "No iframe. No mock. Same DOM. The overlay is a sibling div positioned via `getBoundingClientRect()`." The preview canvas mounts the cart drawer HTML **directly inside the editor page**, not in an iframe. A new `preview-renderer.ts` module walks `editorOverrides` and emits the same HTML structure v14-complete.js produces in the browser, **reusing `cart-constants.ts` (REAL_CART_CSS + CONTROL_HTML)** — no inline styles, no duplicated CSS.

The "60 contract tests" in Chunk 2 are exactly what protects against drift between v14's runtime render and the preview-renderer's output: both must read the same fields from `editorOverrides`, and the contract tests assert the field→DOM mapping. If preview-renderer.ts and v14-complete.js disagree on any field, a contract test fails.

Note on iframe alternative: an earlier draft of this task used an iframe to load v14-complete.js directly. That violated spec §3.3 and broke the overlay (Chunk 4) because the parent's `elementsFromPoint` cannot pierce iframe boundaries. The same-DOM approach is the spec contract.

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/preview-canvas.tsx`
- Create: `backend/src/app/dashboard/cart-editor/preview-renderer.ts`
- Create: `backend/src/app/dashboard/cart-editor/preview-fixtures.ts` (fixture cart data — items, empty, unlocked)
- Test:   `backend/__tests__/cart-editor/preview-renderer.test.ts`

- [ ] **Step 1: Write failing test for preview-renderer**

```ts
import { describe, it, expect } from 'vitest';
import { renderPreviewHTML } from '@/app/dashboard/cart-editor/preview-renderer';
import { PREVIEW_FIXTURES } from '@/app/dashboard/cart-editor/preview-fixtures';

describe('preview-renderer', () => {
  it('uses REAL_CART_CSS from cart-constants (no inline styles)', () => {
    const html = renderPreviewHTML({}, { viewport: 'desktop', previewState: 'cart-with-items', cart: PREVIEW_FIXTURES['cart-with-items'] });
    // The renderer must reference our shared CSS classes, not duplicate styles inline
    expect(html).toMatch(/class="ccd-/);
    expect(html).not.toMatch(/style="background-color: #/i);
  });

  it('header.title override appears in output', () => {
    const html = renderPreviewHTML({ header: { title: 'My Cart' } }, { viewport: 'desktop', previewState: 'cart-with-items', cart: PREVIEW_FIXTURES['cart-with-items'] });
    expect(html).toContain('My Cart');
  });

  it('empty previewState renders empty-state CTA, not line items', () => {
    const html = renderPreviewHTML({}, { viewport: 'desktop', previewState: 'empty', cart: PREVIEW_FIXTURES['empty'] });
    expect(html).toContain('data-ccd-empty-state');
    expect(html).not.toContain('data-ccd-line-item');
  });

  it('mobile viewport sets mobile-width class', () => {
    const html = renderPreviewHTML({}, { viewport: 'mobile', previewState: 'cart-with-items', cart: PREVIEW_FIXTURES['cart-with-items'] });
    expect(html).toMatch(/data-ccd-viewport="mobile"/);
  });
});
```

- [ ] **Step 2: Run test, expect failure.**

- [ ] **Step 3: Implement preview-renderer.ts**

`renderPreviewHTML(overrides, opts)` returns a single HTML string. Internally:
- Resolve effective config: deep-merge `BASELINE_CONFIG` ← addonsLiveConfig (passed via opts) ← `overrides`. (For Stage 3a we only need the overrides path; addons defaults come from the existing `addon-definitions.ts`.)
- Reuse `cart-constants.ts` REAL_CART_CSS once at the top of the output (wrapped in `<style data-ccd-preview-css>`).
- Walk the section tree (header → milestoneBar → items → emptyState → footer → trustLine) in the same order v14 does.
- Each section is a small template function (e.g. `renderHeader(cfg)`, `renderFooter(cfg, cart)`) that emits the same class names + `data-ccd-*` hooks v14 uses.
- For Stage 3a, support `previewState ∈ { 'cart-with-items', 'empty', 'unlocked' }` and `viewport ∈ { 'desktop', 'mobile' }`. Hotspot data attributes are added in Chunk 4 Task 4.1.

- [ ] **Step 4: Implement preview-fixtures.ts**

Exports `PREVIEW_FIXTURES: Record<PreviewState, CartJson>`:
- `'cart-with-items'`: 2 line items with realistic price/qty/variant
- `'empty'`: `{ items: [], total_price: 0 }`
- `'unlocked'`: 1 line item with total_price ≥ highest milestone threshold

- [ ] **Step 5: Run tests, expect pass.**

- [ ] **Step 6: Build canvas component**

```tsx
'use client';
import { useDraftStore } from './draft-store';
import { renderPreviewHTML } from './preview-renderer';
import { PREVIEW_FIXTURES } from './preview-fixtures';
import { useState } from 'react';

export function PreviewCanvas({ onPreviewRootRef }: { onPreviewRootRef?: (el: HTMLDivElement | null) => void }) {
  const { draft } = useDraftStore();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewState, setPreviewState] = useState<'cart-with-items' | 'empty' | 'unlocked'>('cart-with-items');
  const html = renderPreviewHTML(draft, { viewport, previewState, cart: PREVIEW_FIXTURES[previewState] });
  return (
    <div className="p-4 relative">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewport('desktop')} aria-pressed={viewport === 'desktop'}>Desktop</button>
        <button onClick={() => setViewport('mobile')} aria-pressed={viewport === 'mobile'}>Mobile</button>
        <select value={previewState} onChange={(e) => setPreviewState(e.target.value as any)}>
          <option value="cart-with-items">Cart with items</option>
          <option value="empty">Empty</option>
          <option value="unlocked">Unlocked</option>
        </select>
      </div>
      <div
        ref={onPreviewRootRef}
        data-cart-editor-preview-root
        className={viewport === 'mobile' ? 'w-[375px] mx-auto' : 'w-full max-w-[520px]'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
```

The `onPreviewRootRef` callback lets the parent page hand the preview root DOM node to the overlay (Chunk 4) so `elementsFromPoint` queries work against the same document.

- [ ] **Step 7: Wire into page.tsx (client component)**

```tsx
'use client';
import { use, useEffect, useState } from 'react';
import { DraftStoreProvider } from './draft-store';
import { PreviewCanvas } from './preview-canvas';

export default function CartEditorPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params);
  const [initial, setInitial] = useState<{ editorOverrides: any; editorOverridesVersion: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cart-editor/${storeId}/config`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { if (!cancelled) setInitial(data); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [storeId]);

  if (error) return <div className="p-8 text-red-500">Failed to load editor: {error}</div>;
  if (!initial) return <div className="p-8">Loading editor…</div>;

  return (
    <DraftStoreProvider storeId={storeId} initial={initial}>
      <div className="grid grid-cols-[55%_45%] h-[calc(100vh-64px)]">
        <PreviewCanvas />
        <div data-cart-editor-panel className="p-4 border-l border-zinc-800">
          Click an element in the preview to edit it.
        </div>
      </div>
    </DraftStoreProvider>
  );
}
```

Notes:
- `'use client'` required for hooks + runtime fetch.
- `params` typed as `Promise<…>` for Next 15; on Next 14, use `params: { storeId: string }` and drop `use()`.
- Save URL is `/api/cart-editor/[storeId]/config` (matches Chunk 1 route per Reconciliation #4).
- The `selected` state for the overlay (Chunk 4) will be added here later — Chunk 4 Task 4.0.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app/dashboard/cart-editor backend/__tests__/cart-editor/preview-renderer.test.ts
git commit -m "feat(cart-editor): preview canvas + renderer (same-DOM, reuses cart-constants)"
```

---

## Chunk 3 end — dispatch plan-document-reviewer before proceeding.

---

## Chunk 4: Stage 3b — Overlay + element editors

> Test-first reminder (CLAUDE.md Test-First Development — ZERO TOLERANCE): every task in this chunk MUST start with a failing test, referencing the test IDs in spec §8.3 (`backend/__tests__/cart-editor.test.ts`) and §8.4 (`tests/cart-editor-preview.spec.js`). Each "Step 0" below pins the exact test name. Do NOT write component code until the named test exists and fails.

### Task 4.0: Wire `selected` state + previewRoot ref in page.tsx

**Files:**
- Modify: `backend/src/app/dashboard/cart-editor/page.tsx`

This task closes the loose end from Chunk 3 Task 3.3 (`onPreviewRootRef`) and the placeholder right panel. It owns the two pieces of state every other Chunk 4 task depends on:

1. `previewRoot: HTMLDivElement | null` — captured from PreviewCanvas via the `onPreviewRootRef` callback (declared in Chunk 3 Task 3.3 Step 4).
2. `selected: HotspotId | null` — the currently-selected hotspot id.

- [ ] **Step 1: Add state + callback ref**

In `page.tsx`, inside `CartEditorPage`, after the existing `useState` for `initial`/`error`:

```tsx
import type { HotspotId } from './overlay/hotspots'; // created in Task 4.1
const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null);
const [selected, setSelected] = useState<HotspotId | null>(null);
```

- [ ] **Step 2: Pass callback ref to PreviewCanvas**

Replace `<PreviewCanvas />` with:

```tsx
<PreviewCanvas onPreviewRootRef={setPreviewRoot} />
```

Note: until Task 4.1 lands, the import of `HotspotId` will fail to resolve. Add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comments on `previewRoot` and `selected` for one commit, OR commit Task 4.0 + 4.1 sequentially in the same branch (preferred — they're tightly coupled).

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/page.tsx
git commit -m "feat(cart-editor): wire previewRoot + selected state in page"
```

---

### Task 4.1: Hotspot registry + overlay layer

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/overlay/hotspots.ts`
- Create: `backend/src/app/dashboard/cart-editor/overlay/overlay.tsx`
- Test: `backend/__tests__/cart-editor/overlay.test.tsx`

- [ ] **Step 0: Write the failing overlay test FIRST**

From spec §8.4 ("hover halo follows cursor as user moves mouse" and "selection ring stays after click, disappears on click-outside"). These are Playwright tests in the spec, but we also need a unit test that locks the hotspot-resolution logic so component refactors don't silently break it.

Create `backend/__tests__/cart-editor/overlay.test.tsx` with a JSDOM render that:
- Mounts a fake preview root containing a `<button class="ccd-checkout-btn">` and a `<div class="ccd-header">`
- Calls `resolveHotspotFromPoint(previewRoot, { x, y })` (the pure function the overlay component delegates to)
- Asserts: point inside `ccd-checkout-btn` → `'checkoutButton'`; point inside `ccd-header` → `'header'`; point outside both → `null`

```ts
import { describe, it, expect } from 'vitest';
import { resolveHotspotFromPoint } from '../../src/app/dashboard/cart-editor/overlay/hotspots';

describe('resolveHotspotFromPoint', () => {
  it('returns null when point is outside the preview root', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    expect(resolveHotspotFromPoint(root, { x: -1, y: -1 })).toBeNull();
  });
  it('returns checkoutButton when point is inside .ccd-checkout-btn', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button class="ccd-checkout-btn">Checkout</button>';
    document.body.appendChild(root);
    const btn = root.firstElementChild as HTMLElement;
    const rect = btn.getBoundingClientRect();
    expect(resolveHotspotFromPoint(root, { x: rect.left + 1, y: rect.top + 1 })).toBe('checkoutButton');
  });
});
```

Run: `cd backend && npm test -- overlay.test`. Expected: FAIL (`Cannot find module '.../overlay/hotspots'`).

- [ ] **Step 1: Hotspot registry**

Copy the registry table from spec §5.1 into `overlay/hotspots.ts`:

```ts
export type HotspotId =
  | 'header' | 'milestoneBar' | 'lineItem' | 'emptyState'
  | 'footer' | 'checkoutButton' | 'trustLine' | 'global';

// Order matters: most-specific first. Pure function so it's unit-testable
// without a real overlay/mouse — the overlay component just calls it.
const HOTSPOT_SELECTORS: Array<{ id: HotspotId; selector: string }> = [
  { id: 'checkoutButton', selector: '.ccd-checkout-btn' },
  { id: 'trustLine',      selector: '.ccd-trust-line' },
  { id: 'footer',         selector: '.ccd-footer' },
  { id: 'lineItem',       selector: '.ccd-line-item' },
  { id: 'emptyState',     selector: '.ccd-empty-state' },
  { id: 'milestoneBar',   selector: '.ccd-milestone-bar' },
  { id: 'header',         selector: '.ccd-header' },
  { id: 'global',         selector: '.ccd-drawer' }, // fallback — whole drawer
];

export function resolveHotspotFromPoint(
  previewRoot: HTMLElement,
  point: { x: number; y: number }
): HotspotId | null {
  const doc = previewRoot.ownerDocument;
  // Use same-document elementsFromPoint — preview-renderer renders into the
  // parent document (spec §3.3), so no iframe crossing is needed.
  const stack = doc.elementsFromPoint(point.x, point.y);
  for (const el of stack) {
    if (!previewRoot.contains(el)) continue;
    for (const { id, selector } of HOTSPOT_SELECTORS) {
      if ((el as HTMLElement).closest(selector)) return id;
    }
  }
  return null;
}
```

Run the test from Step 0 — expected PASS for the `checkoutButton` case and `null` case.

- [ ] **Step 2: Overlay component**

Create `overlay/overlay.tsx`. Props: `{ previewRoot: HTMLElement | null; selected: HotspotId | null; onSelect: (id: HotspotId | null) => void }`.

Behavior:
- Subscribes to `mousemove` and `click` on `previewRoot` (no-op if null).
- On `mousemove`: calls `resolveHotspotFromPoint(previewRoot, { x: e.clientX, y: e.clientY })` and stores result in local `hovered` state.
- On `click`: same lookup, then calls `onSelect(id)`. Click outside any hotspot → `onSelect(null)`.
- Renders two absolutely-positioned sibling divs (NOT children of the cart DOM) — one dashed purple halo over `hovered`, one solid purple ring over `selected`. Positions computed via `getBoundingClientRect()` of the resolved element (closest match for the selector).
- Uses `ResizeObserver` on the resolved element + `window.addEventListener('scroll', …, true)` to recompute on layout changes.
- Renders a label badge over the hover halo with the hotspot id (humanized: "Checkout Button", "Header", …).

Note: the overlay is a **sibling div positioned via `getBoundingClientRect()`** (spec §3.3). It never inserts nodes inside the cart DOM tree. Each render of position rects is wrapped in `requestAnimationFrame` to coalesce mousemove → reposition.

- [ ] **Step 3: Wire Overlay into page.tsx**

In `page.tsx`, after `<PreviewCanvas onPreviewRootRef={setPreviewRoot} />`, add:

```tsx
<Overlay previewRoot={previewRoot} selected={selected} onSelect={setSelected} />
```

(The overlay being a sibling of PreviewCanvas in the same grid cell keeps it inside the preview viewport but outside the cart DOM tree. Use `position: relative` on the parent and `position: absolute; inset: 0; pointer-events: none` on the overlay's hover/select rings, with `pointer-events: auto` only on the invisible click-catcher layer.)

- [ ] **Step 4: Verify**

Run `cd backend && npm test -- overlay.test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/overlay backend/__tests__/cart-editor/overlay.test.tsx backend/src/app/dashboard/cart-editor/page.tsx
git commit -m "feat(cart-editor): hotspot overlay (hover halo + selection ring, same-DOM)"
```

---

### Task 4.2: Element editor components — one task per editor

Each of the 8 editors gets its own sub-task with its own commit. Every sub-task follows the same shape: Step 0 = failing test, Step 1 = build form, Step 2 = addon-gated notice (only if applicable), Step 3 = commit.

**Addon gating rule** (clarifies spec §4.3 — *editor-level* vs *field-level*):
- **Editor-level gate** (notice covers entire editor): `milestoneBar`, `trustLine`. The whole element is conceptually owned by an addon — if the addon is disabled, the whole element won't render to shoppers regardless of style.
- **Field-level gate** (notice attaches to specific field only): `footer.showGiftNote` (this single toggle is the only footer field gated by the gift-note addon — the rest of the footer renders unconditionally). Inside `footer-editor.tsx`, wrap only the `showGiftNote` toggle with the notice, NOT the whole editor.
- **Ungated**: `header`, `lineItem`, `emptyState`, `checkoutButton`, `global`, plus all `footer.*` fields other than `showGiftNote`.

The notice content comes verbatim from spec §4.3 ("This addon is currently disabled in the Addons tab…"). Reads addon-enabled state from the same config payload page.tsx already fetched (`initial.addons.milestone.enabled`, `initial.addons.trustLine.enabled`, `initial.addons.giftNote.enabled`).

#### Sub-task 4.2.a: Header editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/header-editor.tsx`
- Test: `backend/__tests__/cart-editor/header-editor.test.tsx`

- [ ] **Step 0: Failing test** — references spec §8.4 "click Header → right panel shows Header editor" + §8.4 "change header.title → preview text updates in <500ms (no network)".

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DraftStoreProvider } from '../../src/app/dashboard/cart-editor/draft-store';
import { HeaderEditor } from '../../src/app/dashboard/cart-editor/element-editors/header-editor';

it('renders header title input bound to draft.header.title', () => {
  render(
    <DraftStoreProvider storeId="s1" initial={{ schemaVersion: 1, savedConfig: { editorOverrides: {}, editorOverridesVersion: 0 } }}>
      <HeaderEditor />
    </DraftStoreProvider>
  );
  const input = screen.getByLabelText(/title/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Shopping Bag' } });
  expect(input.value).toBe('Shopping Bag');
});
```

Run: FAIL (`Cannot find module 'header-editor'`).

- [ ] **Step 1: Build form**

One input per field in spec §4.1 `editorOverrides.header` schema (`title`, `showItemCount`, `badgeColor`, `closeIconStyle`, `bgColor`, `borderStyle`, `padding`). Inputs read from `draft.header.<field>` via `useDraft()` hook and write via `setField('header.<field>', value)`. Hex colors use `<input type="color">`. Enums use radio groups matching `backend/src/app/dashboard/addons/protection-editor.tsx` pattern.

- [ ] **Step 2: Addon gate** — N/A (header is ungated per spec §4.3).

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/header-editor.tsx backend/__tests__/cart-editor/header-editor.test.tsx
git commit -m "feat(cart-editor): header element editor"
```

#### Sub-task 4.2.b: Milestone bar editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/milestone-editor.tsx`
- Test: `backend/__tests__/cart-editor/milestone-editor.test.tsx`

- [ ] **Step 0: Failing test** — bind `milestoneBar.preUnlockTemplate` to a textarea. Then: render with `initial.addons.milestone.enabled = false` and assert the addon-disabled notice appears at the top of the editor. (Locks editor-level gating.)

- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.milestoneBar` only (NOT `addons.milestone.tiers` — that lives in the Addons tab, spec §4.3). Inputs: `preUnlockTemplate`, `unlockedTemplate`, `fillColor`, `trackColor`, `height`, `textSize`, `textWeight`, `position`, `celebrationAnim`.

- [ ] **Step 2: Addon gate** — editor-level. If `initial.addons.milestone.enabled === false`, render the notice from spec §4.3 at the top of the editor (above all fields). Fields remain editable.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/milestone-editor.tsx backend/__tests__/cart-editor/milestone-editor.test.tsx
git commit -m "feat(cart-editor): milestone bar editor (addon-gated)"
```

#### Sub-task 4.2.c: Line item editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/line-item-editor.tsx`
- Test: `backend/__tests__/cart-editor/line-item-editor.test.tsx`

- [ ] **Step 0: Failing test** — `lineItem.imageSize` radio group binds to draft.
- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.lineItem` (`imageSize`, `imageShape`, `showVariant`, `showSku`, `qtyControlStyle`, `removeButtonStyle`, `showCrossedOutCompareAt`, `perItemSavingsBadge`, `separator`, `titleFontSize`, `titleFontWeight`).
- [ ] **Step 2: Addon gate** — N/A (ungated).
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/line-item-editor.tsx backend/__tests__/cart-editor/line-item-editor.test.tsx
git commit -m "feat(cart-editor): line item editor"
```

#### Sub-task 4.2.d: Empty state editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/empty-state-editor.tsx`
- Test: `backend/__tests__/cart-editor/empty-state-editor.test.tsx`

- [ ] **Step 0: Failing test** — `ctaLink` validation: typing `javascript:alert(1)` shows inline error and does NOT call `setField` (locks spec §8.3 Zod test "rejects emptyState.ctaLink = 'javascript:alert(1)'" at the UI layer too).
- [ ] **Step 1: Build form** — fields: `heading`, `subtext`, `icon`, `ctaLabel`, `ctaLink`, `ctaInheritsStyle`. Use the same Zod helper that the schema uses (spec §4.1) to validate `ctaLink` on input change.
- [ ] **Step 2: Addon gate** — N/A.
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/empty-state-editor.tsx backend/__tests__/cart-editor/empty-state-editor.test.tsx
git commit -m "feat(cart-editor): empty state editor (ctaLink validation)"
```

#### Sub-task 4.2.e: Footer editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/footer-editor.tsx`
- Test: `backend/__tests__/cart-editor/footer-editor.test.tsx`

- [ ] **Step 0: Failing test** — render with `initial.addons.giftNote.enabled = false` and assert: the `showGiftNote` toggle has the addon-disabled notice attached to that **single field**, AND the other footer fields (e.g. `showSubtotal`) do NOT show the notice. (Locks field-level gating.)
- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.footer`.
- [ ] **Step 2: Addon gate** — field-level. Wrap only the `showGiftNote` toggle (NOT the entire editor) with the spec §4.3 notice when `initial.addons.giftNote.enabled === false`. All other footer fields render unconditionally.
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/footer-editor.tsx backend/__tests__/cart-editor/footer-editor.test.tsx
git commit -m "feat(cart-editor): footer editor (field-level gift-note gate)"
```

#### Sub-task 4.2.f: Checkout button editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/checkout-button-editor.tsx`
- Test: `backend/__tests__/cart-editor/checkout-button-editor.test.tsx`

- [ ] **Step 0: Failing test** — radio group for `radius` writes `'pill'` to draft.
- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.checkoutButton`.
- [ ] **Step 2: Addon gate** — N/A.
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/checkout-button-editor.tsx backend/__tests__/cart-editor/checkout-button-editor.test.tsx
git commit -m "feat(cart-editor): checkout button editor"
```

#### Sub-task 4.2.g: Trust line editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/trust-line-editor.tsx`
- Test: `backend/__tests__/cart-editor/trust-line-editor.test.tsx`

- [ ] **Step 0: Failing test** — render with `initial.addons.trustLine.enabled = false` and assert: addon-disabled notice appears at the top of the editor. (Locks editor-level gating.)
- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.trustLine` (`paymentIcons`, `text`, `showLockIcon`, `position`, `textSize`, `textColor`). NOTE: `paymentIcons` is the per-icon visibility override; the *provider list* itself (`addons.trustLine.providers[]`) is read-only here per spec §4.3.
- [ ] **Step 2: Addon gate** — editor-level. Same notice at top as milestone editor.
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/trust-line-editor.tsx backend/__tests__/cart-editor/trust-line-editor.test.tsx
git commit -m "feat(cart-editor): trust line editor (addon-gated)"
```

#### Sub-task 4.2.h: Global style editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/global-editor.tsx`
- Test: `backend/__tests__/cart-editor/global-editor.test.tsx`

- [ ] **Step 0: Failing test** — `widthDesktop = 319` shows inline range error (matches spec §8.3 "rejects drawer width 319 (below min)").
- [ ] **Step 1: Build form** — fields from spec §4.1 `editorOverrides.global`. **Explicitly excludes `customCss`** (per spec §8.3 "rejects body containing global.customCss (out of scope)").
- [ ] **Step 2: Addon gate** — N/A.
- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/global-editor.tsx backend/__tests__/cart-editor/global-editor.test.tsx
git commit -m "feat(cart-editor): global style editor"
```

---

### Task 4.3: Right panel router — show editor for selected hotspot

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/right-panel.tsx`
- Test: `backend/__tests__/cart-editor/right-panel.test.tsx`

- [ ] **Step 0: Failing test** — references spec §8.4 "click Header → right panel shows Header editor".

```tsx
import { render, screen } from '@testing-library/react';
import { RightPanel } from '../../src/app/dashboard/cart-editor/right-panel';
import { DraftStoreProvider } from '../../src/app/dashboard/cart-editor/draft-store';

it('shows placeholder when nothing selected', () => {
  render(<DraftStoreProvider storeId="s1" initial={fakeInitial}><RightPanel selected={null} /></DraftStoreProvider>);
  expect(screen.getByText(/click an element/i)).toBeInTheDocument();
});
it('shows Header editor when selected = "header"', () => {
  render(<DraftStoreProvider storeId="s1" initial={fakeInitial}><RightPanel selected="header" /></DraftStoreProvider>);
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
});
```

Run: FAIL.

- [ ] **Step 1: Build router**

```tsx
const EDITORS: Record<HotspotId, ComponentType> = {
  header: HeaderEditor,
  milestoneBar: MilestoneEditor,
  lineItem: LineItemEditor,
  emptyState: EmptyStateEditor,
  footer: FooterEditor,
  checkoutButton: CheckoutButtonEditor,
  trustLine: TrustLineEditor,
  global: GlobalStyleEditor,
};

export function RightPanel({ selected }: { selected: HotspotId | null }) {
  if (!selected) return <div>Click an element in the preview to edit it.</div>;
  const Editor = EDITORS[selected];
  return <Editor />;
}
```

- [ ] **Step 2: Wire into page.tsx**

Replace the placeholder right panel with `<RightPanel selected={selected} />`.

- [ ] **Step 3: Verify**

Run: `cd backend && npm test -- right-panel.test`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/right-panel.tsx backend/src/app/dashboard/cart-editor/page.tsx backend/__tests__/cart-editor/right-panel.test.tsx
git commit -m "feat(cart-editor): right panel router"
```

---

### Task 4.4: Save / Discard bar + conflict modal (consumes draft store's `crossTabBanner`)

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/save-bar.tsx`
- Test: `backend/__tests__/cart-editor/save-bar.test.tsx`

**Important — single source of truth for conflicts:** The 409 conflict modal does NOT own its own state. It reads `crossTabBanner` from the draft store (declared in Chunk 3 Task 3.2). The two banner kinds drive different UI:

- `crossTabBanner === null` → no banner / no modal.
- `crossTabBanner.kind === 'incoming-while-dirty'` → inline yellow banner inside the save bar (another tab saved while we have local edits). Actions wire to `draftStore.acceptIncoming()` and `draftStore.dismissBanner()`.
- `crossTabBanner.kind === 'server-conflict-409'` → blocking modal (we got 409 from our own PUT). Same two actions, but UI is a modal not an inline banner.

This avoids the parallel-state risk the reviewer flagged.

- [ ] **Step 0: Failing test** — references spec §8.3 ("test BroadcastChannel 'saved' shows banner when local isDirty") + §8.4 ("cross-tab conflict: tab B has isDirty → tab A saves → tab B shows banner with discard/keep options").

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveBar } from '../../src/app/dashboard/cart-editor/save-bar';
import { DraftStoreProvider, useDraft } from '../../src/app/dashboard/cart-editor/draft-store';

it('renders incoming-banner when crossTabBanner.kind === incoming-while-dirty', () => {
  const initial = { schemaVersion: 1, savedConfig: { editorOverrides: {}, editorOverridesVersion: 0 } };
  function Harness() {
    const draft = useDraft();
    // simulate cross-tab incoming
    React.useEffect(() => {
      draft._setCrossTabBanner({ kind: 'incoming-while-dirty', incomingVersion: 5, incomingOverrides: {} });
    }, []);
    return <SaveBar />;
  }
  render(<DraftStoreProvider storeId="s1" initial={initial}><Harness /></DraftStoreProvider>);
  expect(screen.getByText(/another tab saved/i)).toBeInTheDocument();
});

it('renders 409 modal when crossTabBanner.kind === server-conflict-409', () => {
  // similar setup, dispatch kind: 'server-conflict-409'
  // assert role="dialog" present
});
```

Run: FAIL.

- [ ] **Step 1: Build save bar**

Sticky bottom bar inside the right panel:
- "Discard" calls `draftStore.discard()`. Disabled when `!isDirty`.
- "Save Changes" calls `draftStore.save()`. Disabled when `!isDirty` or `saving`.
- Error toasts go through existing toast system (`backend/src/lib/toast.ts` or equivalent — check codebase before creating new infra).
- On 429 from save, parse `Retry-After` header, disable Save, show countdown ("Try again in Ns").
- Reads `crossTabBanner` from `useDraft()`.

- [ ] **Step 2: Build incoming-while-dirty banner (inline)**

When `crossTabBanner?.kind === 'incoming-while-dirty'`:
- Render a yellow inline banner above the Discard/Save buttons.
- **Must include `data-cart-editor-conflict-banner="incoming"`** on the root banner element (used by Playwright test in Chunk 5 Task 5.3).
- Copy: "Another tab saved newer changes (v{incomingVersion}). You have unsaved edits here."
- Buttons: [Discard mine & load latest] → `acceptIncoming()`. [Keep my changes] → `dismissBanner()`.
- Escape key on this banner is a no-op (it's inline, not modal).

- [ ] **Step 3: Build 409 server-conflict modal**

When `crossTabBanner?.kind === 'server-conflict-409'`:
- Render a blocking modal (`role="dialog"`, focus trap, esc-to-cancel).
- **Must include `data-cart-editor-conflict-banner="server-409"`** on the modal root element (used by Playwright test in Chunk 5 Task 5.3).
- Copy: "Your changes couldn't be saved because someone else updated this configuration. Their version: v{incomingVersion}."
- Buttons: [Discard mine & reload latest] → `acceptIncoming()`. [Keep my changes] → `dismissBanner()` (returns to dirty state; user can re-save which will 409 again — they must explicitly resolve).
- Escape key invokes `dismissBanner()` (matches the [Keep my changes] action).

- [ ] **Step 4: Verify**

Run: `cd backend && npm test -- save-bar.test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/save-bar.tsx backend/__tests__/cart-editor/save-bar.test.tsx
git commit -m "feat(cart-editor): save bar + crossTabBanner-driven conflict UI"
```

---

## Chunk 4 end — dispatch plan-document-reviewer before proceeding.

---

## Chunk 5: Stage 3c + Stage 4 — Navigation guard, Playwright tests, docs

> **Note:** Cross-tab conflict banner UI is fully delivered in Chunk 4 Task 4.4 (inline `incoming-while-dirty` banner + `server-conflict-409` modal, both reading `crossTabBanner` from the draft store). There is no separate banner file in this chunk — Task 4.4 is the single source of truth for conflict UI.

### Task 5.1: Navigation guard

**Files:**
- Modify: `backend/src/app/dashboard/cart-editor/page.tsx`
- Test: `backend/__tests__/cart-editor/navigation-guard.test.tsx`

- [ ] **Step 0: Failing test** — covers all three behaviors (beforeunload, intra-app Link, sessionStorage round-trip). Per CLAUDE.md Test-First ZERO TOLERANCE.

```tsx
import { render, fireEvent } from '@testing-library/react';
import { CartEditorPage } from '../../src/app/dashboard/cart-editor/page';

it('beforeunload prompt fires only when isDirty=true', () => {
  const { rerender } = render(<CartEditorPage storeId="s1" initialIsDirty={false} />);
  const evClean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(evClean);
  expect(evClean.defaultPrevented).toBe(false);

  rerender(<CartEditorPage storeId="s1" initialIsDirty={true} />);
  const evDirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(evDirty);
  expect(evDirty.defaultPrevented).toBe(true);
});

it('intra-app Link click while isDirty=true opens dashboard confirm modal', () => {
  const { getByTestId, queryByRole } = render(<CartEditorPage storeId="s1" initialIsDirty={true} />);
  fireEvent.click(getByTestId('nav-link-addons'));
  expect(queryByRole('dialog')).toHaveTextContent(/unsaved changes/i);
});

it('sessionStorage round-trip restores draft on mount', () => {
  sessionStorage.setItem('cart-editor:s1:draft', JSON.stringify({ header: { title: 'Restored' } }));
  const { getByLabelText } = render(<CartEditorPage storeId="s1" />);
  expect((getByLabelText(/title/i) as HTMLInputElement).value).toBe('Restored');
});
```

Run: FAIL.

- [ ] **Step 1: Beforeunload listener**

```tsx
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (!isDirty) return;
    e.preventDefault();
    e.returnValue = ''; // browser default styled prompt
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

- [ ] **Step 2: Intra-app Next.js Link guard**

Subscribe to Next.js router events; if `isDirty`, intercept route changes with the existing dashboard custom-modal confirm pattern (used by `rich-text-editor.tsx`).

- [ ] **Step 3: sessionStorage draft persistence**

On every `setField`, write ``sessionStorage.setItem(`cart-editor:${storeId}:draft`, JSON.stringify(draft))``. On mount, restore from sessionStorage if present. Clear on save/discard.

- [ ] **Step 4: Verify**

Run: `cd backend && npm test -- navigation-guard.test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/page.tsx backend/__tests__/cart-editor/navigation-guard.test.tsx
git commit -m "feat(cart-editor): navigation guard + sessionStorage draft persistence"
```

---

### Task 5.2: Playwright tests — 12 preview integration tests

**Files:**
- Create: `tests/cart-editor-preview.spec.js`

- [ ] **Step 1: Write all 12 tests** matching spec §8.4 exactly:

> **Auth seeding:** dashboard routes require a logged-in session. Use the existing Playwright auth fixture (see `tests/helpers/auth-seed.js` if present, otherwise `playwright.config.js` `globalSetup`). The `beforeEach` below assumes a stored auth state has already been loaded by the project config (`use: { storageState: 'tests/.auth/dashboard-user.json' }`). If that fixture does not exist, add it before running this suite.

```js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // requires dashboard auth fixture (see note above)
  await page.goto('/dashboard/cart-editor?storeId=test-store');
});

test('click Header shows Header editor', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await expect(page.locator('[data-cart-editor-panel]')).toContainText('Header');
});

test('header.title edit updates preview within 1000ms of last keystroke', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await page.fill('input[name="header.title"]', 'New Title');
  // Measure ONLY the preview-propagation latency after the last keystroke (excludes typing time).
  const t0 = await page.evaluate(() => performance.now());
  await expect(page.locator('[data-cart-editor-preview-root] .ccd-header')).toContainText('New Title');
  const t1 = await page.evaluate(() => performance.now());
  // Spec §3.3 budget is 16ms p95 in single-process, but Playwright adds RPC overhead.
  // Use 1000ms as a non-flaky CI ceiling; tighten in perf-only runs.
  expect(t1 - t0).toBeLessThan(1000);
});

test('save then reload shows persisted value', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await page.fill('input[name="header.title"]', 'Persisted');
  await page.click('button:has-text("Save Changes")');
  await page.reload();
  await expect(page.locator('[data-cart-editor-preview-root] .ccd-header')).toContainText('Persisted');
});

test('navigate with isDirty shows confirm modal', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await page.fill('input[name="header.title"]', 'Dirty');
  await page.click('a[href="/dashboard/addons"]');
  await expect(page.locator('[role="dialog"]')).toContainText('unsaved changes');
});

test('empty state click opens empty editor', async ({ page }) => {
  await page.selectOption('[data-cart-editor-preview-state]', 'empty');
  await page.locator('[data-cart-editor-preview-root] .ccd-empty').click();
  await expect(page.locator('[data-cart-editor-panel]')).toContainText('Empty State');
});

test('desktop ↔ mobile viewport toggle changes width', async ({ page }) => {
  await page.click('button:has-text("Mobile")');
  const w = await page.locator('[data-cart-editor-preview-root]').evaluate(el => el.clientWidth);
  expect(w).toBeLessThan(400);
});

test('hover halo follows cursor', async ({ page }) => {
  await page.hover('[data-cart-editor-preview-root] .ccd-header');
  await expect(page.locator('[data-cart-editor-hover-halo]')).toBeVisible();
});

test('selection ring stays after click, disappears on outside click', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await expect(page.locator('[data-cart-editor-selection-ring]')).toBeVisible();
  await page.click('[data-cart-editor-preview-root]', { position: { x: 1, y: 1 } });
  await expect(page.locator('[data-cart-editor-selection-ring]')).toBeHidden();
});

test('cross-tab sync: tab A save → tab B savedConfig updates within 1s', async ({ browser }) => {
  const ctx = await browser.newContext();
  const [a, b] = await Promise.all([ctx.newPage(), ctx.newPage()]);
  await a.goto('/dashboard/cart-editor?storeId=test-store');
  await b.goto('/dashboard/cart-editor?storeId=test-store');
  await a.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await a.fill('input[name="header.title"]', 'From A');
  await a.click('button:has-text("Save Changes")');
  await expect(b.locator('[data-cart-editor-preview-root] .ccd-header')).toContainText('From A', { timeout: 1000 });
});

test('cross-tab conflict: B dirty, A saves → B banner appears', async ({ browser }) => {
  const ctx = await browser.newContext();
  const [a, b] = await Promise.all([ctx.newPage(), ctx.newPage()]);
  await a.goto('/dashboard/cart-editor?storeId=test-store');
  await b.goto('/dashboard/cart-editor?storeId=test-store');
  await b.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await b.fill('input[name="header.title"]', 'My draft');
  await a.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await a.fill('input[name="header.title"]', 'A saved');
  await a.click('button:has-text("Save Changes")');
  await expect(b.locator('[data-cart-editor-conflict-banner]')).toBeVisible({ timeout: 2000 });
});

test('cache bust: PUT → /apps/eliminai/config returns new version within 2s', async ({ page, request }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await page.fill('input[name="header.title"]', 'CacheTest');
  await page.click('button:has-text("Save Changes")');
  await new Promise(r => setTimeout(r, 2000));
  // Full proxy URL — params match Shopify App Proxy signature shape used by the cart drawer.
  // See backend/src/app/api/proxy/config/route.ts for required params (shop, path_prefix, timestamp, signature).
  const proxyUrl = '/api/proxy/config?shop=test-store.myshopify.com&path_prefix=%2Fapps%2Feliminai&timestamp=1700000000&signature=test';
  const r = await request.get(proxyUrl);
  const body = await r.json();
  expect(body.cartConfig.editorOverrides.header.title).toBe('CacheTest');
});

test('ownership: PUT addons.milestone.tiers returns 400', async ({ request }) => {
  const r = await request.put('/api/cart-editor/test-store/config', {
    headers: { 'If-Match': '"ce-0"', 'Content-Type': 'application/json' },
    data: { editorOverrides: {}, addons: { milestone: { tiers: [] } } },
  });
  expect(r.status()).toBe(400);
  const body = await r.json();
  expect(body.conflictPath).toBe('addons.milestone.tiers');
});
```

- [ ] **Step 2: Run Playwright**

```bash
cd backend && npx playwright test cart-editor-preview.spec.js
```

Expected: 12/12 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/cart-editor-preview.spec.js
git commit -m "test(cart-editor): 12 Playwright preview + cross-tab + ownership tests"
```

---

### Task 5.3: CI gate — pre-commit + pre-deploy reconcile

**Files:**
- Modify: `tests/pre-upload-gate.js` (or whichever pre-commit script the repo already uses)

- [ ] **Step 1: Add per-section test-count assertions**

After running the suite, parse vitest/test output and assert each section minimum from spec §8.6 individually, then assert the grand total. On any miss, print the failing section and exit non-zero.

Required per-section minimums (spec §8.6):
- Baseline contract tests in `tests/contract.test.js`: **≥ 339** (existing pre-editor)
- Cart-editor contract additions in `tests/contract.test.js`: **≥ 60** (new field wiring)
- Cart-editor unit tests in `backend/__tests__/cart-editor/**`: **≥ 37**
- Cart-editor Playwright tests in `tests/cart-editor-preview.spec.js`: **≥ 12**
- Blast-radius locks in `tests/blast-radius/cart-editor.test.js`: **= 6** (exact)
- Grand total across all suites: **≥ 514** (399 baseline + 115 new)

Pseudo-code:

```js
const sections = {
  contractBaseline: { pattern: /tests\/contract\.test\.js \[baseline\]/, min: 339 },
  contractEditor:   { pattern: /tests\/contract\.test\.js \[cart-editor\]/, min: 60 },
  unitEditor:       { pattern: /backend\/__tests__\/cart-editor\//, min: 37 },
  playwrightEditor: { pattern: /tests\/cart-editor-preview\.spec\.js/, min: 12 },
  blastRadius:      { pattern: /tests\/blast-radius\/cart-editor\.test\.js/, min: 6, exact: true },
};
for (const [name, s] of Object.entries(sections)) {
  const count = countPassing(s.pattern);
  if (s.exact ? count !== s.min : count < s.min) {
    console.error(`Section ${name}: expected ${s.exact ? '=' : '>='} ${s.min}, got ${count}`);
    process.exit(1);
  }
}
const total = sumAllPassing();
if (total < 514) { console.error(`Total ${total} < 514`); process.exit(1); }
```

- [ ] **Step 2: Commit**

```bash
git add tests/pre-upload-gate.js
git commit -m "test(cart-editor): CI gate enforces per-section minimums + >=514 total"
```

---

### Task 5.4: Stage 4 — docs

**Files:**
- Create: `docs/cart-editor/settings-reference.md`
- Modify: `docs/cart-editor/README.md` (or create if missing)

- [ ] **Step 1: Write settings reference**

For each editor field, document: name, type, default, range, what it controls visually, example. Mirror the schema structure section by section.

- [ ] **Step 2: Competitor parity check**

Re-check Rebuy, SLIDECART, UpCart for any settings missed in v1. Capture in `docs/cart-editor/competitor-parity.md` for the next phase.

- [ ] **Step 3: Commit**

```bash
git add docs/cart-editor
git commit -m "docs(cart-editor): settings reference + competitor parity check"
```

---

### Task 5.5: Stage 3 + Stage 4 deploy

- [ ] **Step 0: LOCK 5 production smoke replay (deploy gate per spec §8.5)**

Snapshot current production cart DOM and replay it through the editor renderer with `editorOverrides = null`. Result MUST be byte-identical to the production snapshot. This is the deploy gate for Stage 2 onward — if this fails, do NOT proceed.

```bash
# Capture fresh production snapshot
node tests/scripts/snapshot-production-cart.js
# Run only LOCK 5 against the fresh snapshot
node tests/blast-radius/cart-editor.test.js --only=lock-5
```

Expected: PASS with exit 0. On failure, abort deploy and investigate divergence between editor renderer and live cart.

- [ ] **Step 1: Run full gate**

```bash
cd backend && npm test
node tests/contract.test.js
node tests/blast-radius/cart-editor.test.js
npx playwright test cart-editor-preview.spec.js
```

All must pass. Per-section minimums and total count >= 514 enforced by Task 5.3 pre-upload gate.

- [ ] **Step 2: Set Railway env**

```bash
railway variables set CART_EDITOR_API_ENABLED=true
railway variables set NEXT_PUBLIC_CART_EDITOR_ENABLED=true
```

- [ ] **Step 3: Deploy**

```bash
cd backend && npm run deploy
```

- [ ] **Step 4: Verify in production**

Happy path:
- Open dashboard → Cart Editor tab visible
- Edit header.title → save → reload → persists
- Open second tab → save in first → second tab `savedConfig` updates within 1s (cross-tab sync path)
- Open shopper cart on demo theme → header.title from editor renders live within 5 minutes (cache-bust path)

Conflict path:
- In tab B, dirty a field
- In tab A, save a different change
- Tab B must show the `incoming-while-dirty` inline banner from Task 4.4
- In tab B, click [Keep my changes], then click Save → must receive 409 → must show the `server-conflict-409` modal from Task 4.4

Cache-bust verification:
- Capture `If-None-Match: "ce-<oldVersion>"` request to `/api/proxy/config` → expect 200 with new ETag (not 304) within 5 minutes of save
- Subsequent request with the new ETag → expect 304

- [ ] **Step 5: Tag release**

```bash
git tag cart-editor-stage-3-4
git push --tags
```

---

## Chunk 5 end — dispatch plan-document-reviewer before final handoff.

---

## Summary of artifacts

**New files (backend):**
- `backend/src/lib/cart-editor/schema.ts`
- `backend/src/lib/cart-editor/v14-field-map.md`
- `backend/src/app/api/cart-editor/[storeId]/config/route.ts`
- `backend/src/app/dashboard/cart-editor/page.tsx`
- `backend/src/app/dashboard/cart-editor/draft-store.tsx`
- `backend/src/app/dashboard/cart-editor/preview-canvas.tsx`
- `backend/src/app/dashboard/cart-editor/preview-renderer.ts`
- `backend/src/app/dashboard/cart-editor/right-panel.tsx`
- `backend/src/app/dashboard/cart-editor/save-bar.tsx`
- `backend/src/app/dashboard/cart-editor/cross-tab-banner.tsx`
- `backend/src/app/dashboard/cart-editor/overlay/hotspots.ts`
- `backend/src/app/dashboard/cart-editor/overlay/overlay.tsx`
- `backend/src/app/dashboard/cart-editor/element-editors/{header,milestone,line-item,empty-state,footer,checkout-button,trust-line,global-style}-editor.tsx`

**Modified files (backend):**
- `backend/prisma/schema.prisma` — +2 columns on Store
- `backend/src/app/api/proxy/config/route.ts` — editorOverrides + ETag + s-maxage
- `backend/src/app/dashboard/layout.tsx` — Cart Editor nav tab

**Modified (extension):**
- `extensions/cart-drawer/assets/v14-complete.js` — fallback reads + version cache check

**New test files:**
- `backend/__tests__/cart-editor/{schema,get-config,put-config,proxy-config,draft-store}.test.{ts,tsx}` — 37 unit tests
- `tests/blast-radius/cart-editor.test.js` — 6 locks
- `tests/cart-editor-preview.spec.js` — 12 Playwright
- `tests/helpers/structural-equiv.js`
- `tests/helpers/render-cart.js`
- `tests/snapshots/cart-pre-editor.html`
- `tests/snapshots/cart-prod-stage2-gate.html`
- `tests/scripts/snapshot-current-cart.js`
- `tests/scripts/snapshot-production-cart.js`
- `tests/contract.test.js` — +~60 contract tests for v14 field wiring

**Total new tests:** 60 contract + 37 unit + 12 Playwright + 6 blast-radius = 115. Combined with 399 baseline = **514**.

**Env vars added:**
- `CART_EDITOR_API_ENABLED` (server)
- `NEXT_PUBLIC_CART_EDITOR_ENABLED` (client)
