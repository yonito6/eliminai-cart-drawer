import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/hmac';
import { prisma } from '@/lib/prisma';
import { sessionLimiter, storeLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // 1. Verify HMAC
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  const secret = process.env.SHOPIFY_API_SECRET!;
  if (!verifyAppProxySignature(query, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body || !body.sessionToken || !body.eventType) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // 3. Rate limit
  if (!sessionLimiter.check(body.sessionToken)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const shopDomain = query.shop;
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  if (!storeLimiter.check(store.id)) {
    return NextResponse.json({ error: 'Store rate limited' }, { status: 429 });
  }

  // 4. Validate session exists
  const session = await prisma.visitorSession.findUnique({
    where: { sessionToken: body.sessionToken },
  });
  if (!session) {
    return NextResponse.json({ error: 'Unknown session' }, { status: 400 });
  }

  // 5. Find assignment (if experiment running)
  let assignmentId: string | null = null;
  if (body.experimentId) {
    const assignment = await prisma.variantAssignment.findUnique({
      where: {
        experimentId_sessionId: {
          experimentId: body.experimentId,
          sessionId: session.id,
        },
      },
    });
    assignmentId = assignment?.id || null;
  }

  // 6. Insert event
  const validTypes = ['CART_OPENED', 'CHECKOUT_CLICKED', 'CHECKOUT_STARTED', 'ORDER_COMPLETED'];
  if (!validTypes.includes(body.eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  // Dedup: only one event of each type per session (customer may click checkout multiple times)
  if (body.eventType === 'CART_OPENED' || body.eventType === 'CHECKOUT_CLICKED') {
    const existing = await prisma.event.findFirst({
      where: { sessionId: session.id, eventType: body.eventType },
    });
    if (existing) {
      return NextResponse.json({ ok: true, dedup: true }, { status: 200 });
    }
  }

  await prisma.event.create({
    data: {
      storeId: store.id,
      sessionId: session.id,
      assignmentId,
      eventType: body.eventType,
      hourOfDay: body.hourOfDay ?? new Date().getHours(),
      dayOfWeek: body.dayOfWeek ?? new Date().getDay(),
      metadata: body.metadata || {},
    },
  });

  // Also track baseline checkout clicks
  if (body.eventType === 'CHECKOUT_CLICKED' && !body.experimentId) {
    const opens = store.baselineCartOpens || 0;
    if (opens > 0) {
      const currentClicks = await prisma.event.count({
        where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', assignmentId: null },
      });
      await prisma.store.update({
        where: { id: store.id },
        data: { baselineCheckoutRate: currentClicks / opens },
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
