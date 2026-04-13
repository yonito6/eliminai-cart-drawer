import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = req.nextUrl.searchParams.get('q') ?? '';

  if (!q.trim()) {
    return NextResponse.json({ products: [] });
  }

  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true },
  });

  if (!store?.accessToken) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  try {
    // Use GraphQL for partial title matching (REST title= does exact match only)
    const graphqlUrl = `https://${store.shopDomain}/admin/api/2025-01/graphql.json`;
    const query = `{
      products(first: 10, query: "title:*${q.replace(/"/g, '\\"')}* status:active") {
        edges {
          node {
            id
            title
            handle
            featuredImage { url }
            images(first: 1) { edges { node { url } } }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price
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
      console.error('Shopify GraphQL error:', res.status, await res.text());
      return NextResponse.json({ products: [] });
    }

    const data = await res.json();
    const edges = data?.data?.products?.edges ?? [];

    // Transform GraphQL response to match expected shape
    const products = edges.map((edge: any) => {
      const node = edge.node;
      const imgUrl = node.featuredImage?.url || node.images?.edges?.[0]?.node?.url || '';
      const variants = (node.variants?.edges ?? []).map((ve: any) => ({
        id: parseInt(ve.node.id.replace('gid://shopify/ProductVariant/', ''), 10),
        title: ve.node.title,
        price: ve.node.price,
      }));
      return {
        id: parseInt(node.id.replace('gid://shopify/Product/', ''), 10),
        title: node.title,
        handle: node.handle,
        image: { src: imgUrl },
        images: [{ src: imgUrl }],
        variants,
      };
    });

    return NextResponse.json({ products });
  } catch (e) {
    console.error('Product search failed:', e);
    return NextResponse.json({ products: [] });
  }
}
