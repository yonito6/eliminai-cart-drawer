import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect root to dashboard (Shopify loads / as the app URL)
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // CSP frame-ancestors — allow Shopify admin (desktop + mobile) to embed us
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://admin.myshopify.io https://*.spin.dev https://admin.shop.dev;"
  );

  // Remove X-Frame-Options if set (conflicts with CSP frame-ancestors)
  response.headers.delete('X-Frame-Options');

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/',
    '/api/mobile-test',
  ],
};
