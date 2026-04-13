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

  // Fetch shop info
  const shopInfo = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  }).then(r => r.json());

  // Upsert store
  await prisma.store.upsert({
    where: { shopDomain: shop },
    create: {
      shopDomain: shop,
      shopName: shopInfo.shop?.name || shop,
      accessToken,
      currency: shopInfo.shop?.currency || 'USD',
      config: {},
      isActive: true,
    },
    update: {
      accessToken,
      shopName: shopInfo.shop?.name || shop,
      currency: shopInfo.shop?.currency || 'USD',
      isActive: true,
    },
  });

  // Register webhooks (orders/create for purchase tracking)
  await registerWebhooks(shop, accessToken);

  // Pre-seed baseline stats from Shopify (gives accurate A/B test targets from day 1)
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const countRes = await fetch(
      `https://${shop}/admin/api/2025-01/orders/count.json?created_at_min=${thirtyDaysAgo.toISOString()}&status=any`,
      { headers: { 'X-Shopify-Access-Token': accessToken } },
    );
    if (countRes.ok) {
      const { count } = await countRes.json();
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
