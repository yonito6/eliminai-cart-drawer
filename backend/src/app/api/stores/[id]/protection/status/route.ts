import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/stores/:id/protection/status
 *
 * Returns the current state of the shipping protection product.
 *
 * If no productId in config → { exists: false }
 * If product deleted on Shopify → { exists: false, warning: 'Product was deleted' }
 * Otherwise → { exists: true, productId, handle, status, variants, config }
 */

async function shopifyGraphQL(shopDomain: string, token: string, query: string, variables?: any) {
  const res = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { shopDomain: true, accessToken: true, config: true },
    });

    if (!store?.accessToken) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const config = (store.config as any) ?? {};
    const protectionConfig = config.addons?.shippingProtection;

    if (!protectionConfig?.productId) {
      return NextResponse.json({ exists: false });
    }

    const shopDomain = store.shopDomain;
    const token = store.accessToken;
    const productGid = protectionConfig.productId;

    // Query Shopify for product
    const result = await shopifyGraphQL(shopDomain, token, `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          handle
          status
          title
          variants(first: 20) {
            nodes {
              id
              title
              price
            }
          }
        }
      }
    `, { id: productGid });

    const product = result?.data?.product;

    if (!product) {
      return NextResponse.json({
        exists: false,
        warning: 'Product was deleted from Shopify',
        config: protectionConfig,
      });
    }

    return NextResponse.json({
      exists: true,
      productId: product.id,
      handle: product.handle,
      status: product.status,
      title: product.title,
      variants: product.variants.nodes.map((v: any) => ({
        id: v.id,
        numericId: parseInt(v.id.replace(/\D/g, ''), 10),
        title: v.title,
        price: v.price,
      })),
      config: protectionConfig,
    });
  } catch (err: any) {
    console.error('[protection/status] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
