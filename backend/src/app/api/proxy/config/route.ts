import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/hmac';
import { assignVariant } from '@/lib/variant-assign';
import { prisma } from '@/lib/prisma';

async function handleRequest(req: NextRequest) {
  // 1. Extract Shopify signature params from query string
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  // 2. Verify HMAC
  const secret = process.env.SHOPIFY_API_SECRET!;
  if (!verifyAppProxySignature(query, secret)) {
    console.log('[proxy/config] HMAC failed. Query params:', JSON.stringify(query));
    return NextResponse.json({ error: 'Invalid signature', debug: { params: Object.keys(query) } }, { status: 401 });
  }

  // 3. Parse request body (for POST) or use defaults (for GET)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const shopDomain = query.shop;
  const sessionToken = body.sessionToken || query.session_token || `anon-${Date.now()}`;
  const deviceType = body.deviceType || 'DESKTOP';
  const isReturning = body.isReturning || false;
  const referralSource = body.referralSource;
  const country = body.country;

  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 });
  }

  // 4. Find store
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store || !store.isActive) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // 5. Assign variant
  const assignment = await assignVariant(
    store.id, sessionToken, deviceType, isReturning, referralSource, country
  );

  // 6. Track baseline cart open (if no experiment)
  if (!assignment.experiment) {
    await prisma.store.update({
      where: { id: store.id },
      data: { baselineCartOpens: { increment: 1 } },
    });
  }

  // 7. Return config + experiment assignment
  return NextResponse.json({
    cartConfig: store.config,
    currency: store.currency,
    experiment: assignment.experiment
      ? {
          id: assignment.experiment.id,
          variant: assignment.variant,
          features: assignment.experiment.features,
        }
      : null,
    sessionId: assignment.sessionId,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
