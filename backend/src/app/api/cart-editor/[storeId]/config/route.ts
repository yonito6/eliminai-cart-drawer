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
