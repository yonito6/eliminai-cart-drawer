import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/stores/:id/products/preview
 * Returns 2-3 active products for the dashboard cart preview.
 * No search query needed — just grabs popular/recent products.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true },
  });

  if (!store?.accessToken) {
    return NextResponse.json({ products: [] });
  }

  try {
    const graphqlUrl = `https://${store.shopDomain}/admin/api/2025-10/graphql.json`;
    const query = `{
      products(first: 3, query: "status:active") {
        edges {
          node {
            title
            featuredImage { url }
            variants(first: 1) {
              edges {
                node {
                  title
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }`;

    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return NextResponse.json({ products: [] });
    }

    const data = await res.json();
    const edges = data?.data?.products?.edges ?? [];

    const products = edges.map((edge: any) => {
      const node = edge.node;
      const variant = node.variants?.edges?.[0]?.node;
      return {
        title: node.title,
        image: node.featuredImage?.url || '',
        variant: variant?.title !== 'Default Title' ? variant?.title : '',
        price: variant?.price || '0.00',
        compareAtPrice: variant?.compareAtPrice || null,
      };
    });

    const cacheHeader = products.length > 0
      ? 'public, s-maxage=3600, stale-while-revalidate=7200'
      : 'no-cache, no-store';
    return NextResponse.json(
      { products },
      { headers: { 'Cache-Control': cacheHeader } },
    );
  } catch {
    return NextResponse.json({ products: [] });
  }
}
