import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect root to dashboard (Shopify may load / as the app URL)
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // TEMPORARILY allow ALL frame ancestors to debug mobile blank page
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors *;"
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
