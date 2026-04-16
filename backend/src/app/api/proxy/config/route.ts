import { NextRequest, NextResponse } from 'next/server';
import { verifyAppProxySignature } from '@/lib/hmac';
import { assignVariant } from '@/lib/variant-assign';
import { prisma } from '@/lib/prisma';

async function handleRequest(req: NextRequest) {
  try {
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
    const sessionToken = body.sessionToken || query.session_token || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deviceType = body.deviceType || 'DESKTOP';
    const isReturning = body.isReturning || false;
    const visitCount = typeof body.visitCount === 'number' ? body.visitCount : 1;
    const hasCustomerId = body.hasCustomerId || false;
    const referralSource = body.referralSource;
    const country = body.country;
    const prefetch = body.prefetch === true; // Pre-fetch on page load — assign variant but skip CART_OPENED
    const themeId = body.themeId || null; // Shopify.theme.id — used to serve demo vs live config

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
      store.id, sessionToken, deviceType, isReturning, referralSource, country, visitCount, hasCustomerId
    );

    // 6. Track CART_OPENED event server-side (guaranteed — no client race)
    // Skip if this is a pre-fetch (page load) — CART_OPENED sent via /event when cart actually opens
    if (!prefetch) {
      if (assignment.experiment && assignment.sessionId) {
        if (assignment.isNew) {
          const variantAssignment = await prisma.variantAssignment.findUnique({
            where: {
              experimentId_sessionId: {
                experimentId: assignment.experiment.id,
                sessionId: assignment.sessionId,
              },
            },
          });
          if (variantAssignment) {
            const now = new Date();
            await prisma.event.create({
              data: {
                storeId: store.id,
                sessionId: assignment.sessionId,
                assignmentId: variantAssignment.id,
                eventType: 'CART_OPENED',
                hourOfDay: now.getUTCHours(),
                dayOfWeek: now.getUTCDay(),
                metadata: { deviceType, isReturning, source: 'server' },
              },
            });
          }
        }
      } else {
        await prisma.store.update({
          where: { id: store.id },
          data: { baselineCartOpens: { increment: 1 } },
        });
      }
    }

    // 7. Choose demo vs live config based on theme ID
    const isDemo = themeId && store.demoThemeId && String(themeId) === String(store.demoThemeId);
    const cartConfig = isDemo && store.demoConfig && Object.keys(store.demoConfig as any).length > 0
      ? store.demoConfig
      : store.config;

    // 8. Build theme asset URLs so app-embed loads from theme (not stale extension CDN)
    let jsUrl: string | undefined;
    let cssUrl: string | undefined;
    if (store.accessToken && themeId) {
      try {
        const assetResp = await fetch(
          `https://${shopDomain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=assets/v14-complete.js`,
          { headers: { 'X-Shopify-Access-Token': store.accessToken } }
        );
        const assetData = await assetResp.json();
        if (assetData.asset?.public_url) {
          jsUrl = assetData.asset.public_url;
        }
        const cssResp = await fetch(
          `https://${shopDomain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=assets/v14-css.css`,
          { headers: { 'X-Shopify-Access-Token': store.accessToken } }
        );
        const cssData = await cssResp.json();
        if (cssData.asset?.public_url) {
          cssUrl = cssData.asset.public_url;
        }
      } catch (e) {
        // Fall through — app-embed will use extension CDN fallback
      }
    }

    // 9. Return config + experiment assignment
    return NextResponse.json({
      cartConfig: { ...(cartConfig as any), ...(jsUrl ? { _jsUrl: jsUrl } : {}), ...(cssUrl ? { _cssUrl: cssUrl } : {}) },
      currency: store.currency,
      segment: assignment.segment,
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
  } catch (err: any) {
    console.error('[proxy/config] Error:', err.message, err.stack);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
