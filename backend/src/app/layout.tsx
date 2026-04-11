import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Eliminai Cart Optimizer",
  description: "AI-powered cart drawer A/B testing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0 }}>
        {apiKey && (
          <Script
            src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
            strategy="beforeInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
