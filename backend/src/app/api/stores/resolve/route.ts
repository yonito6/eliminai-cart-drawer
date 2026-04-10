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

  // Dev fallback: return the first store in the database
  const store = await prisma.store.findFirst({
    select: { id: true, shopName: true, shopDomain: true, currency: true },
    orderBy: { installedAt: 'asc' },
  });

  if (!store) return NextResponse.json({ error: 'No stores in database' }, { status: 404 });
  return NextResponse.json({ store });
}
