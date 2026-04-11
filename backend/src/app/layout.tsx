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
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY || ''}`}
          defer
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
