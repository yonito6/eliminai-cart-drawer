import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect root to dashboard (Shopify loads / as the app URL)
  // TEMPORARY: redirect to mobile diagnostic page to debug blank screen
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/mobile-test';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // CSP frame-ancestors — all 5 origins required by Shopify (from their official source):
  // 1. *.myshopify.com — store domains
  // 2. admin.shopify.com — desktop admin
  // 3. admin.myshopify.io — MOBILE admin (WebView) ← THIS WAS MISSING
  // 4. *.spin.dev — Shopify internal dev
  // 5. admin.shop.dev — Shopify development
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://admin.myshopify.io https://*.spin.dev https://admin.shop.dev;"
  );

  // Preload App Bridge for faster mobile init
  response.headers.set(
    'Link',
    '<https://cdn.shopify.com/shopifycloud/app-bridge.js>; rel="preload"; as="script";'
  );

  // Remove X-Frame-Options if set (conflicts with CSP frame-ancestors)
  response.headers.delete('X-Frame-Options');

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/',
  ],
};
