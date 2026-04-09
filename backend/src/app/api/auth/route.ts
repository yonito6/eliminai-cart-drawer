import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  const host = req.nextUrl.searchParams.get('host');

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }

  const dashboardUrl = new URL('/dashboard', req.url);
  if (shop) dashboardUrl.searchParams.set('shop', shop);
  if (host) dashboardUrl.searchParams.set('host', host);

  return NextResponse.redirect(dashboardUrl);
}
