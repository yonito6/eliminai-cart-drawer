import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminai Cart Optimizer",
  description: "AI-powered cart drawer A/B testing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY || '';

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {apiKey && (
          <script
            src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
            async
          />
        )}
      </head>
      <body style={{ margin: 0 }}>
        <noscript>
          <div style={{ padding: 20, textAlign: 'center' as const }}>
            JavaScript is required to use Cart Optimizer.
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
