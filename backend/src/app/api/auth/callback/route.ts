import { NextRequest, NextResponse } from 'next/server';
import { exchangeToken, verifyHmac, registerWebhooks } from '@/lib/shopify-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => { query[k] = v; });

  if (!verifyHmac(query)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const shop = query.shop;
  const code = query.code;

  const accessToken = await exchangeToken(shop, code);

  // Fetch shop info via GraphQL
  const shopGql = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ shop { name currencyCode } }` }),
  }).then(r => r.json());
  const shopData = shopGql?.data?.shop;

  // Upsert store
  await prisma.store.upsert({
    where: { shopDomain: shop },
    create: {
      shopDomain: shop,
      shopName: shopData?.name || shop,
      accessToken,
      currency: shopData?.currencyCode || 'USD',
      config: {},
      isActive: true,
    },
    update: {
      accessToken,
      shopName: shopData?.name || shop,
      currency: shopData?.currencyCode || 'USD',
      isActive: true,
    },
  });

  // Register webhooks (orders/create for purchase tracking)
  await registerWebhooks(shop, accessToken);

  // Pre-seed baseline stats from Shopify (gives accurate A/B test targets from day 1)
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const countRes = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ ordersCount(query: "created_at:>='${thirtyDaysAgo.toISOString()}'") { count } }` }),
    });
    if (countRes.ok) {
      const gql = await countRes.json();
      const count = gql?.data?.ordersCount?.count ?? 0;
      const dailyOrders = Math.max(1, Math.round(count / 30));
      await prisma.store.update({
        where: { shopDomain: shop },
        data: {
          config: {
            estimatedDailyOrders: dailyOrders,
            shopifyOrderCount30d: count,
            baselineSeededAt: new Date().toISOString(),
          },
        },
      });
    }
  } catch (e) {
    // Non-blocking — A/B test targets will self-correct from real data
    console.error('Baseline stats fetch failed:', e);
  }

  // Redirect to dashboard
  return NextResponse.redirect(`${process.env.HOST}/dashboard?shop=${shop}`);
}
