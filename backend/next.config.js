/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    missingSuspenseWithCSRBailout: false,
  },
  async headers() {
    return [
      {
        // Allow Shopify admin (desktop + mobile) to embed this app
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://admin.myshopify.io https://*.spin.dev https://admin.shop.dev;",
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          // Prevent aggressive caching that breaks mobile
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/pixel/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://checkout.shopify.com' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
// cache bust Wed, Apr 15, 2026 11:12:27 PM
