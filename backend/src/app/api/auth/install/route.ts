import { NextRequest, NextResponse } from 'next/server';
import { buildInstallUrl } from '@/lib/shopify-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return NextResponse.json({ error: 'Invalid shop' }, { status: 400 });
  }

  try {
    // Check if store is already installed with a valid token
    const store = await prisma.store.findUnique({
      where: { shopDomain: shop },
      select: { accessToken: true, isActive: true },
    });

    console.log('[auth/install]', { shop, found: !!store, hasToken: !!store?.accessToken, isActive: store?.isActive });

    if (store?.accessToken && store.isActive) {
      // Already installed — go straight to dashboard (skip OAuth redirect chain)
      const host = req.nextUrl.searchParams.get('host') || '';
      const dashUrl = new URL('/dashboard', process.env.HOST || req.nextUrl.origin);
      dashUrl.searchParams.set('shop', shop);
      if (host) dashUrl.searchParams.set('host', host);
      return NextResponse.redirect(dashUrl.toString());
    }
  } catch (err) {
    console.error('[auth/install] DB check failed, falling through to OAuth:', err);
  }

  // Not installed yet — go through OAuth
  return NextResponse.redirect(buildInstallUrl(shop));
}
