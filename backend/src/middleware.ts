import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Allow Shopify admin to embed this app in an iframe
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.spin.dev;"
  );

  // Remove X-Frame-Options if set (conflicts with CSP frame-ancestors)
  response.headers.delete('X-Frame-Options');

  return response;
}

export const config = {
  matcher: [
    // Apply to all dashboard pages, skip API routes and static files
    '/dashboard/:path*',
    '/',
  ],
};
