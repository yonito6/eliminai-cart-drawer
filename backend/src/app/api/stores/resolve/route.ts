import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  if (!shop) return NextResponse.json({ error: 'shop required' }, { status: 400 });

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    select: { id: true, shopName: true, shopDomain: true, currency: true },
  });

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  return NextResponse.json({ store });
}
