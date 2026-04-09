import { NextRequest, NextResponse } from 'next/server';
import { exchangeToken, verifyHmac } from '@/lib/shopify-auth';
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

  // Redirect to dashboard
  return NextResponse.redirect(`${process.env.HOST}/dashboard?shop=${shop}`);
}
