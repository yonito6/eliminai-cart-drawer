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
4. **Auth on dashboard API:** existing dashboard routes (`/api/stores/[id]/addons/route.ts` etc.) gate by `storeId` path param. Cart Editor follows the same pattern: `PUT /api/cart-editor/[storeId]/config` instead of the spec's session-only path. This matches the codebase's actual auth model.

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
    expect((after!.config as any)).toEqual({}); // addons/config untouched
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
  const addonCfg = { milestone: { tiers: [{ threshold: 50, label: 'Free' }], enabled: true } };
  const rendered = renderCart({
    addons: addonCfg,
    editorOverrides: { milestoneBar: { fillColor: '#ff0000' } },
  });
  // Tiers still come from addons (data integrity)
  assert.match(rendered, /threshold.*50/);
  assert.match(rendered, /Free/);
});

test('LOCK 6: rendering twice is idempotent', () => {
  const cfg = { editorOverrides: { header: { title: 'X' } } };
  const a = renderCart(cfg);
  const b = renderCart(cfg);
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
  'Vary': 'Cookie',
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

- [ ] **Step 4: Deploy v14-complete.js (extension CDN) + backend (proxy changes)**

```bash
cd backend && npm run deploy
# Then upload v14-complete.js to extension via existing deploy flow
```

- [ ] **Step 5: Verify on DEMO theme**

Open DEMO theme cart → confirm structurally identical to pre-deploy. Use browser DevTools to compare snapshot.

- [ ] **Step 6: Commit + tag Stage 2 release**

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

- [ ] **Step 1: Write 8 failing tests** matching spec §8.3 `describe('draft store')` block:

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

  it('BroadcastChannel saved message updates savedConfig when not dirty', () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => {
      const ch = new BroadcastChannel('cart-editor:s1');
      ch.postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'From other tab' } } });
    });
    // Allow microtask
    return Promise.resolve().then(() => {
      expect(result.current.savedConfig.header?.title).toBe('From other tab');
      expect(result.current.draft.header?.title).toBe('From other tab');
    });
  });

  it('BroadcastChannel saved shows banner when isDirty (no clobber)', async () => {
    const { result } = renderHook(() => useDraftStore(), { wrapper: wrap() });
    act(() => result.current.setField('header.title', 'Mine'));
    act(() => {
      new BroadcastChannel('cart-editor:s1').postMessage({ kind: 'saved', version: 7, editorOverrides: { header: { title: 'Theirs' } } });
    });
    await Promise.resolve();
    expect(result.current.draft.header?.title).toBe('Mine'); // not clobbered
    expect(result.current.crossTabBanner).toEqual({ kind: 'conflict', incomingVersion: 7 });
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

On `save()`: PUT `/api/cart-editor/${storeId}/config` with `If-Match: "ce-${savedVersion}"`. On 200, update savedConfig + savedVersion + broadcast. On 409, set crossTabBanner kind to 'conflict' with currentVersion. On other errors, surface to caller.

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/draft-store.tsx backend/__tests__/cart-editor/draft-store.test.tsx
git commit -m "feat(cart-editor): draft store with cross-tab sync"
```

---

### Task 3.3: Preview canvas — render real cart DOM from draft

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/preview-canvas.tsx`
- Create: `backend/src/app/dashboard/cart-editor/preview-renderer.ts`

- [ ] **Step 1: Create preview renderer**

`preview-renderer.ts` exports `renderPreviewHTML(editorOverrides, opts)` that mirrors `v14-complete.js` render path but in isolated React-friendly form. Reuses `cart-constants.ts` REAL_CART_CSS + CONTROL_HTML structure. For Stage 3a the renderer only supports `previewState ∈ { 'cart-with-items', 'empty', 'unlocked', 'loading' }` and `viewport ∈ { 'desktop', 'mobile' }`. Hotspots are added in Chunk 4.

- [ ] **Step 2: Build canvas component**

```tsx
'use client';
import { useDraftStore } from './draft-store';
import { renderPreviewHTML } from './preview-renderer';
import { useState } from 'react';

export function PreviewCanvas() {
  const { draft } = useDraftStore();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [state, setState] = useState<'cart-with-items' | 'empty' | 'unlocked' | 'loading'>('cart-with-items');
  const html = renderPreviewHTML(draft, { viewport, previewState: state });
  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewport('desktop')} aria-pressed={viewport === 'desktop'}>Desktop</button>
        <button onClick={() => setViewport('mobile')} aria-pressed={viewport === 'mobile'}>Mobile</button>
        <select value={state} onChange={(e) => setState(e.target.value as any)}>
          <option value="cart-with-items">Cart with items</option>
          <option value="empty">Empty</option>
          <option value="unlocked">Unlocked</option>
          <option value="loading">Loading</option>
        </select>
      </div>
      <div
        data-cart-editor-preview-root
        className={viewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-[520px]'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire into page.tsx**

```tsx
import { DraftStoreProvider } from './draft-store';
import { PreviewCanvas } from './preview-canvas';

export default async function CartEditorPage({ params }: { params: { storeId?: string } }) {
  // load initial editorOverrides from API (server component fetch)
  const initial = await fetch(`/api/cart-editor/${storeId}/config`).then(r => r.json());
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

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/dashboard/cart-editor
git commit -m "feat(cart-editor): preview canvas + viewport/state controls"
```

---

## Chunk 3 end — dispatch plan-document-reviewer before proceeding.

---

## Chunk 4: Stage 3b — Overlay + element editors

### Task 4.1: Hotspot registry + overlay layer

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/overlay/hotspots.ts`
- Create: `backend/src/app/dashboard/cart-editor/overlay/overlay.tsx`

- [ ] **Step 1: Hotspot registry** — copy directly from spec §5.1.

- [ ] **Step 2: Overlay component**

Subscribes to `mousemove` and `click` on the preview root. Uses `document.elementsFromPoint(x, y)` filtered by hotspot selectors. Renders hover halo (dashed purple outline + label) and selection ring (solid purple) as absolutely positioned siblings using `getBoundingClientRect()`. Uses `ResizeObserver` to recompute on layout changes.

Exposes `selectedHotspotId: HotspotId | null` via callback `onSelect(id)` so the right panel can react.

- [ ] **Step 3: Wire into PreviewCanvas**

Add `<Overlay rootRef={previewRef} onSelect={setSelected} selected={selected} />` over the preview root.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/overlay
git commit -m "feat(cart-editor): hotspot overlay (hover halo + selection ring)"
```

---

### Task 4.2: Element editor components — 8 editors, one task each

For each editor (`header`, `milestoneBar`, `lineItem`, `emptyState`, `footer`, `checkoutButton`, `trustLine`, `global`) repeat the steps below. Documenting `header-editor.tsx` as the pattern:

#### Sub-task 4.2.h: Header editor

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/element-editors/header-editor.tsx`

- [ ] **Step 1: Build form**

One input per field in spec §4.1 header schema. Inputs read from `draft.header.<field>` and write via `setField('header.<field>', value)`. Hex color inputs use `<input type="color">`. Enum inputs use radio groups matching existing dashboard pattern (`backend/src/app/dashboard/addons/protection-editor.tsx`).

- [ ] **Step 2: Inline addon-disabled notice (spec §4.3)**

Only applies to editors whose owning addon is gated: `milestoneBar`, `trustLine`, and `footer.showGiftNote` slice. For header (no addon dependency), this step is N/A.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/element-editors/header-editor.tsx
git commit -m "feat(cart-editor): header element editor"
```

Repeat for the other 7 editors.

---

### Task 4.3: Right panel router — show editor for selected hotspot

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/right-panel.tsx`

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

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/right-panel.tsx backend/src/app/dashboard/cart-editor/page.tsx
git commit -m "feat(cart-editor): right panel router"
```

---

### Task 4.4: Save / Discard buttons + dirty indicator

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/save-bar.tsx`

- [ ] **Step 1: Build save bar**

Sticky bottom bar inside the right panel:
- "Discard" calls `draftStore.discard()`. Disabled when `!isDirty`.
- "Save Changes" calls `draftStore.save()`. Disabled when `!isDirty` or `saving`.
- On save error, toast message via existing toast system.
- On 429, parse `Retry-After` and show countdown.
- On 409, show modal with [Discard mine & reload latest] / [Keep my changes].

- [ ] **Step 2: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/save-bar.tsx
git commit -m "feat(cart-editor): save/discard bar with conflict modal"
```

---

## Chunk 4 end — dispatch plan-document-reviewer before proceeding.

---

## Chunk 5: Stage 3c + Stage 4 — Navigation guard, Playwright tests, docs

### Task 5.1: Cross-tab conflict banner UI

**Files:**
- Create: `backend/src/app/dashboard/cart-editor/cross-tab-banner.tsx`

- [ ] **Step 1: Build banner**

Reads `crossTabBanner` from draft store. When `{ kind: 'conflict', incomingVersion }`:

> "Settings updated in another tab. [Discard mine & reload] [Keep my changes]"

- [ ] **Step 2: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/cross-tab-banner.tsx
git commit -m "feat(cart-editor): cross-tab conflict banner"
```

---

### Task 5.2: Navigation guard

**Files:**
- Modify: `backend/src/app/dashboard/cart-editor/page.tsx`

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

On every `setField`, write `sessionStorage.setItem(`cart-editor:${storeId}:draft`, JSON.stringify(draft))`. On mount, restore from sessionStorage if present. Clear on save/discard.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/dashboard/cart-editor/page.tsx
git commit -m "feat(cart-editor): navigation guard + sessionStorage draft persistence"
```

---

### Task 5.3: Playwright tests — 12 preview integration tests

**Files:**
- Create: `tests/cart-editor-preview.spec.js`

- [ ] **Step 1: Write all 12 tests** matching spec §8.4 exactly:

```js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard/cart-editor?storeId=test-store');
});

test('click Header shows Header editor', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  await expect(page.locator('[data-cart-editor-panel]')).toContainText('Header');
});

test('header.title edit updates preview within 500ms', async ({ page }) => {
  await page.locator('[data-cart-editor-preview-root] .ccd-header').click();
  const t0 = Date.now();
  await page.fill('input[name="header.title"]', 'New Title');
  await expect(page.locator('[data-cart-editor-preview-root] .ccd-header')).toContainText('New Title');
  expect(Date.now() - t0).toBeLessThan(500);
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
  const r = await request.get('/api/proxy/config?shop=test-store.myshopify.com&...');
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

### Task 5.4: CI gate — pre-commit + pre-deploy reconcile

**Files:**
- Modify: `tests/pre-upload-gate.js` (or whichever pre-commit script the repo already uses)

- [ ] **Step 1: Add test-count assertion**

After running the suite, parse vitest/test output and assert at least 514 passing (399 baseline + 115 new). On miss, print the section breakdown from spec §8.6 and exit non-zero.

- [ ] **Step 2: Commit**

```bash
git add tests/pre-upload-gate.js
git commit -m "test(cart-editor): CI gate enforces ≥514 passing tests"
```

---

### Task 5.5: Stage 4 — docs

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

### Task 5.6: Stage 3 + Stage 4 deploy

- [ ] **Step 1: Run full gate**

```bash
cd backend && npm test
node tests/contract.test.js
node tests/blast-radius/cart-editor.test.js
npx playwright test cart-editor-preview.spec.js
```

All must pass. Total count ≥ 514.

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

- Open dashboard → Cart Editor tab visible
- Edit header.title → save → reload → persists
- Open second tab → save in first → second tab syncs
- Open shopper cart on demo theme → header.title from editor renders live

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
