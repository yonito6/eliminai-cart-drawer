import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateLimiter } from '@/lib/rate-limit';
import { editorOverridesSchema, findAddonOwnedConflict } from '@/lib/cart-editor/schema';
import { revalidateTag } from 'next/cache';

const getLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });
const putLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });

export async function GET(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  if (process.env.CART_EDITOR_API_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cart Editor API disabled' }, { status: 404 });
  }

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
    {
      editorOverrides: store.editorOverrides ?? null,
      editorOverridesVersion: version,
    },
    {
      headers: {
        ETag: `"ce-${version}"`,
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  if (process.env.CART_EDITOR_API_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cart Editor API disabled' }, { status: 404 });
  }

  const { storeId } = params;

  // Rate limit: 10 PUT requests per 60s per store
  if (!putLimiter.check(`ce:put:${storeId}`)) {
    return NextResponse.json({ error: 'Rate limited' }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  // Parse JSON body - explicit try/catch for clear 400 on malformed JSON
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Guard: body must be a plain object (not null, not an array)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  // Ownership guard: reject if body contains any addon-owned paths
  const conflictPath = findAddonOwnedConflict(raw);
  if (conflictPath) {
    return NextResponse.json(
      { error: 'Body contains addon-owned path', conflictPath },
      { status: 400 }
    );
  }

  // Zod validation on the editorOverrides field
  const rawRecord = raw as Record<string, unknown>;
  const overridesInput = rawRecord.editorOverrides ?? {};
  const parsed = editorOverridesSchema.safeParse(overridesInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'Validation failed',
        path: firstIssue.path,
        message: firstIssue.message,
      },
      { status: 400 }
    );
  }

  // Store existence check
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { editorOverrides: true, editorOverridesVersion: true },
  });

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const currentVersion = store.editorOverridesVersion ?? 0;

  // If-Match concurrency check: strong ETag must match current version.
  // If the header is absent, we allow the write (useful for initial saves).
  const ifMatch = req.headers.get('If-Match');
  const expectedETag = `"ce-${currentVersion}"`;
  if (ifMatch !== null && ifMatch !== expectedETag) {
    return NextResponse.json(
      { error: 'Version conflict', currentVersion },
      {
        status: 409,
        headers: { ETag: expectedETag },
      }
    );
  }

  // Atomic update: write editorOverrides and increment version in one operation
  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      editorOverrides: parsed.data as object,
      editorOverridesVersion: { increment: 1 },
    },
    select: { editorOverrides: true, editorOverridesVersion: true },
  });

  const newVersion = updated.editorOverridesVersion ?? currentVersion + 1;

  // Bust the cache for this store's cart config
  try {
    revalidateTag(`cart-config:${storeId}`);
  } catch {
    // revalidateTag can throw outside the Next.js rendering context - swallow silently
  }

  return NextResponse.json(
    {
      editorOverrides: updated.editorOverrides,
      editorOverridesVersion: newVersion,
    },
    {
      headers: {
        ETag: `"ce-${newVersion}"`,
      },
    }
  );
}
