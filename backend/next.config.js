/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    missingSuspenseWithCSRBailout: false,
  },
  async headers() {
    return [
      {
        // Allow Shopify admin to embed this app in an iframe
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.spin.dev;",
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
