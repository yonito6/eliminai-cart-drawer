import { NextRequest, NextResponse } from 'next/server';
import { buildInstallUrl } from '@/lib/shopify-auth';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  if (!shop || !shop.endsWith('.myshopify.com')) {
    return NextResponse.json({ error: 'Invalid shop' }, { status: 400 });
  }
  return NextResponse.redirect(buildInstallUrl(shop));
}
