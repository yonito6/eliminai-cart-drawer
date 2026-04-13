import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Manages automatic Shopify discounts for gift products in reward tiers.
 *
 * POST — Sync all gift discounts for this store:
 *   Reads the store's reward tiers config, creates/updates/deletes
 *   automatic discounts so each gift product gets 100% off when its
 *   tier threshold is met.
 *
 * DELETE — Remove all gift discounts for this store.
 */

async function getShopifyToken(store: { shopDomain: string; accessToken: string }) {
  // Token is already stored from OAuth install flow
  return store.accessToken;
}

async function shopifyGraphQL(shopDomain: string, token: string, query: string, variables?: any) {
  const res = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
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

// Find all existing Eliminai gift discounts
async function findExistingGiftDiscounts(shopDomain: string, token: string) {
  const result = await shopifyGraphQL(shopDomain, token, `{
    discountAutomaticNodes(first: 50, query: "title:Eliminai Gift*") {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
          }
        }
      }
    }
  }`);
  return result?.data?.discountAutomaticNodes?.nodes ?? [];
}

// Delete a discount by ID
async function deleteDiscount(shopDomain: string, token: string, discountId: string) {
  await shopifyGraphQL(shopDomain, token, `
    mutation discountAutomaticDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        userErrors { field message }
      }
    }
  `, { id: discountId });
}

// Create an automatic 100% discount for a gift product
async function createGiftDiscount(
  shopDomain: string,
  token: string,
  opts: {
    title: string;
    productGid: string;
    minQuantity: number;
    thresholdMode: 'items' | 'dollars';
  }
) {
  // Build the minimum requirement based on threshold mode
  const minimumRequirement = opts.thresholdMode === 'dollars'
    ? `minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: "${opts.minQuantity}.00" } }`
    : `minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: "${opts.minQuantity}" } }`;

  const mutation = `
    mutation discountAutomaticBasicCreate($discount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicCreate(automaticDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    discount: {
      title: opts.title,
      startsAt: new Date().toISOString(),
      customerGets: {
        items: {
          products: {
            productsToAdd: [opts.productGid],
          },
        },
        value: {
          percentage: 1.0, // 100% off
        },
      },
      minimumRequirement: opts.thresholdMode === 'dollars'
        ? {
            subtotal: {
              greaterThanOrEqualToSubtotal: `${opts.minQuantity}.00`,
            },
          }
        : {
            quantity: {
              greaterThanOrEqualToQuantity: `${opts.minQuantity}`,
            },
          },
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true,
      },
    },
  };

  const result = await shopifyGraphQL(shopDomain, token, mutation, variables);
  const errors = result?.data?.discountAutomaticBasicCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('[gift-discounts] Create errors:', errors);
    return { error: errors };
  }
  return result?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
}

// Look up product GID from handle
async function getProductGidByHandle(shopDomain: string, token: string, handle: string): Promise<string | null> {
  const result = await shopifyGraphQL(shopDomain, token, `{
    productByHandle(handle: "${handle}") {
      id
    }
  }`);
  return result?.data?.productByHandle?.id ?? null;
}

export async function POST(
  req: NextRequest,
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
    const addons = config.addons ?? {};
    const rewardConfig = addons.freeShippingBar?.config ?? {};
    const tiers = rewardConfig.tiers ?? [];
    const thresholdMode = rewardConfig.thresholdMode ?? 'items';

    const token = store.accessToken;

    // 1. Find all existing Eliminai gift discounts
    const existing = await findExistingGiftDiscounts(store.shopDomain, token);

    // 2. Delete all existing ones (we'll recreate from scratch — simpler than diffing)
    for (const node of existing) {
      await deleteDiscount(store.shopDomain, token, node.id);
    }

    // 3. Create discounts for each tier's gift products
    const created: any[] = [];
    for (const tier of tiers) {
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (const gift of giftProducts) {
        if (!gift.handle) continue;

        // Look up the product GID
        const productGid = await getProductGidByHandle(store.shopDomain, token, gift.handle);
        if (!productGid) {
          console.warn(`[gift-discounts] Product not found: ${gift.handle}`);
          continue;
        }

        const title = `Eliminai Gift: ${gift.title || gift.handle} (Tier ${tier.goal})`;
        const result = await createGiftDiscount(store.shopDomain, token, {
          title,
          productGid,
          minQuantity: tier.goal,
          thresholdMode,
        });

        if (result && !result.error) {
          created.push({ handle: gift.handle, title, discountId: result.id });
        } else {
          created.push({ handle: gift.handle, title, error: result?.error });
        }
      }
    }

    return NextResponse.json({
      success: true,
      discounts: created,
      deleted: existing.length,
    });
  } catch (err: any) {
    console.error('[gift-discounts] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { shopDomain: true, accessToken: true },
    });

    if (!store?.accessToken) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const token = store.accessToken;
    const existing = await findExistingGiftDiscounts(store.shopDomain, token);

    for (const node of existing) {
      await deleteDiscount(store.shopDomain, token, node.id);
    }

    return NextResponse.json({ success: true, deleted: existing.length });
  } catch (err: any) {
    console.error('[gift-discounts] Delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
