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
          <>
            <meta name="shopify-api-key" content={apiKey} />
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        )}
      </head>
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
