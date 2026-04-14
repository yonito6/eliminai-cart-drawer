import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Manages automatic Shopify discounts for gift products in reward tiers.
 *
 * POST — Sync all gift discounts for this store:
 *   Creates per-tier automatic discounts with minimum quantity requirements.
 *   Each gift product gets 100% off when its tier threshold is met.
 *
 * DELETE — Remove all gift discounts for this store.
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

// Find all existing gift discounts created by our app
async function findExistingGiftDiscounts(shopDomain: string, token: string) {
  const result = await shopifyGraphQL(shopDomain, token, `{
    automaticDiscountNodes(first: 50, query: "title:Gift -* OR title:Free Gift* OR title:Eliminai Gift*") {
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
  return result?.data?.automaticDiscountNodes?.nodes ?? [];
}

// Ensure all existing automatic discounts allow combining with product discounts.
async function ensureExistingDiscountsCombine(shopDomain: string, token: string) {
  const result = await shopifyGraphQL(shopDomain, token, `{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
          ... on DiscountAutomaticBxgy {
            title
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
        }
      }
    }
  }`);
  const nodes = result?.data?.automaticDiscountNodes?.nodes ?? [];
  for (const node of nodes) {
    const disc = node.automaticDiscount;
    if (!disc?.combinesWith || disc.combinesWith.productDiscounts) continue;
    console.log(`[gift-discounts] Enabling productDiscounts combining on: ${disc.title} (${node.id})`);
    const basicResult = await shopifyGraphQL(shopDomain, token, `
      mutation discountAutomaticBasicUpdate($id: ID!, $discount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
          userErrors { field message }
        }
      }
    `, { id: node.id, discount: { combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true } } });
    const basicErrors = basicResult?.data?.discountAutomaticBasicUpdate?.userErrors;
    if (basicErrors?.length > 0) {
      await shopifyGraphQL(shopDomain, token, `
        mutation discountAutomaticBxgyUpdate($id: ID!, $discount: DiscountAutomaticBxgyInput!) {
          discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $discount) {
            userErrors { field message }
          }
        }
      `, { id: node.id, discount: { combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true } } });
    }
  }
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

// Fetch all active product GIDs for the "customerBuys" section of BXGY discounts
async function getAllActiveProductGids(shopDomain: string, token: string): Promise<string[]> {
  const gids: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const result = await shopifyGraphQL(shopDomain, token, `{
      products(first: 50, query: "status:active"${afterClause}) {
        pageInfo { hasNextPage endCursor }
        nodes { id }
      }
    }`);
    const nodes = result?.data?.products?.nodes ?? [];
    gids.push(...nodes.map((n: any) => n.id));
    if (!result?.data?.products?.pageInfo?.hasNextPage) break;
    cursor = result.data.products.pageInfo.endCursor;
  }
  return gids;
}

// Create a per-tier automatic BXGY (Buy X Get Y) discount for a single gift product.
// Uses DiscountAutomaticBxgy — the correct type for "buy N items, get product free".
async function createPerTierDiscount(
  shopDomain: string,
  token: string,
  productGid: string,
  tierGoal: number,
  tierNumber: number,
  allProductGids: string[],
) {
  const mutation = `
    mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
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
    automaticBxgyDiscount: {
      title: `Gift #${tierNumber}`,
      startsAt: new Date().toISOString(),
      usesPerOrderLimit: "1",
      customerBuys: {
        items: {
          products: {
            productsToAdd: allProductGids,
          },
        },
        value: {
          quantity: String(tierGoal),
        },
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: [productGid],
          },
        },
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: {
              percentage: 1.0,
            },
          },
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
  if (result?.errors?.length > 0) {
    console.error('[gift-discounts] GraphQL errors:', result.errors);
    return { error: result.errors.map((e: any) => e.message).join('; ') };
  }
  const errors = result?.data?.discountAutomaticBxgyCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('[gift-discounts] Create errors:', errors);
    return { error: errors };
  }
  return result?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode;
}

// Look up product GID from handle
async function getProductGidByHandle(shopDomain: string, token: string, handle: string): Promise<string | null> {
  const result = await shopifyGraphQL(shopDomain, token, `
    query productByIdentifier($identifier: ProductIdentifierInput!) {
      productByIdentifier(identifier: $identifier) {
        id
      }
    }
  `, { identifier: { handle } });
  return result?.data?.productByIdentifier?.id ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { shopDomain: true, accessToken: true, config: true, demoConfig: true },
    });

    if (!store?.accessToken) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Accept tiers from request body or fall back to DB config
    let body: any = {};
    try { body = await req.json(); } catch {}
    let tiers: any[];
    if (body.tiers && Array.isArray(body.tiers)) {
      tiers = body.tiers;
    } else {
      const url = new URL(req.url);
      const target = url.searchParams.get('target');
      const rawConfig = target === 'demo' ? (store.demoConfig as any) : (store.config as any);
      const config = rawConfig ?? {};
      const addons = config.addons ?? ((store.config as any)?.addons) ?? {};
      const rewardConfig = addons.freeShippingBar?.config ?? {};
      tiers = rewardConfig.tiers ?? [];
    }

    const token = store.accessToken;

    // 0. Ensure existing store discounts allow combining with our gift discounts
    await ensureExistingDiscountsCombine(store.shopDomain, token);

    // 1. Find all existing gift discounts
    const existing = await findExistingGiftDiscounts(store.shopDomain, token);

    // 2. Delete all existing ones (recreate from scratch)
    for (const node of existing) {
      await deleteDiscount(store.shopDomain, token, node.id);
    }

    // 3. Fetch all active products for BXGY "customerBuys" section
    const allProductGids = await getAllActiveProductGids(store.shopDomain, token);

    // 4. Create per-tier BXGY discounts
    const created: { tier: number; handle: string; title: string; gid: string; discountId: string }[] = [];
    const discountErrors: any[] = [];
    const notFound: string[] = [];

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const tierNumber = i + 1;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (const gift of giftProducts) {
        if (!gift.handle) continue;

        const productGid = await getProductGidByHandle(store.shopDomain, token, gift.handle);
        if (!productGid) {
          console.warn(`[gift-discounts] Product not found: ${gift.handle}`);
          notFound.push(gift.handle);
          continue;
        }

        const result = await createPerTierDiscount(
          store.shopDomain,
          token,
          productGid,
          tier.goal,
          tierNumber,
          allProductGids,
        );

        if (result?.error) {
          discountErrors.push({ handle: gift.handle, error: result.error });
        } else if (result?.id) {
          created.push({
            tier: tier.goal,
            handle: gift.handle,
            title: gift.title || gift.handle,
            gid: productGid,
            discountId: result.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      discounts: created,
      errors: discountErrors.length > 0 ? discountErrors : null,
      notFound,
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
