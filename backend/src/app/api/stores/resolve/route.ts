import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');

  if (shop) {
    // Production: resolve by shop domain
    const store = await prisma.store.findUnique({
      where: { shopDomain: shop },
      select: { id: true, shopName: true, shopDomain: true, currency: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    return NextResponse.json({ store });
  }

  // Dev fallback: return the NEWEST store (most likely what you're working on)
  // To pick a specific store on localhost, add ?shop=domain.myshopify.com
  const store = await prisma.store.findFirst({
    select: { id: true, shopName: true, shopDomain: true, currency: true },
    orderBy: { installedAt: 'desc' },
  });

  // Also return all stores so the dashboard can show a store switcher on localhost
  const allStores = await prisma.store.findMany({
    select: { id: true, shopName: true, shopDomain: true, currency: true },
    orderBy: { installedAt: 'desc' },
  });

  if (!store) return NextResponse.json({ error: 'No stores in database' }, { status: 404 });
  return NextResponse.json({ store, allStores });
}
