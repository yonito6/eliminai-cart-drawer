import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Manages Shopify discounts for gift products in reward tiers.
 *
 * CRITICAL RULE: Shopify only allows ONE automatic discount per cart.
 * - Tier 1 (first gift) → DiscountAutomaticBxgy (auto-applies at checkout)
          ... on DiscountCodeBasic {
            title
            status
            codes(first: 1) { nodes { code } }
          }
 * - Tier 2+ (subsequent gifts) → DiscountCodeBxgy (code-based, applied via /discount/CODE redirect)
 *
 * POST — Clean-sync gift discounts: deletes old, recreates with correct types.
 * GET — Check which gift discounts already exist.
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

interface ExistingDiscount {
  id: string;
  title: string;
  giftProductGid: string | null;
  buyQuantity: number | null;
}

// Find all existing AUTOMATIC gift discounts
async function findExistingGiftDiscounts(shopDomain: string, token: string): Promise<ExistingDiscount[]> {
  const result = await shopifyGraphQL(shopDomain, token, `{
    automaticDiscountNodes(first: 50, query: "title:Gift*") {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            customerBuys {
              value {
                ... on DiscountQuantity { quantity }
              }
            }
            customerGets {
              items {
                ... on DiscountProducts {
                  products(first: 5) {
                    nodes { id }
                  }
                }
              }
            }
          }
          ... on DiscountAutomaticBasic {
            title
            status
          }
        }
      }
    }
  }`);

  const nodes = result?.data?.automaticDiscountNodes?.nodes ?? [];
  // SAFETY: Only include discounts whose title starts with "Gift" — never touch store's own discounts
  return nodes.filter((node: any) => {
    const title = node.automaticDiscount?.title ?? '';
    return title.startsWith('Gift');
  }).map((node: any) => {
    const disc = node.automaticDiscount;
    const giftProductGid = disc?.customerGets?.items?.products?.nodes?.[0]?.id ?? null;
    const buyQuantity = disc?.customerBuys?.value?.quantity
      ? Number(disc.customerBuys.value.quantity)
      : null;
    return {
      id: node.id,
      title: disc?.title ?? '',
      giftProductGid,
      buyQuantity,
    };
  });
}

// Find existing CODE-based gift discounts (both Basic and Bxgy types)
async function findExistingCodeDiscounts(shopDomain: string, token: string): Promise<{ id: string; title: string; code: string }[]> {
  const result = await shopifyGraphQL(shopDomain, token, `{
    codeDiscountNodes(first: 50, query: "title:Gift*") {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title
            status
            codes(first: 1) { nodes { code } }
          }
          ... on DiscountCodeBxgy {
            title
            status
            codes(first: 1) { nodes { code } }
          }
        }
      }
    }
  }`);
  const nodes = result?.data?.codeDiscountNodes?.nodes ?? [];
  // SAFETY: Only include discounts whose title starts with "Gift" — never touch store's other codes
  return nodes
    .filter((n: any) => n.codeDiscount?.title?.startsWith('Gift'))
    .map((n: any) => ({
      id: n.id,
      title: n.codeDiscount.title,
      code: n.codeDiscount.codes?.nodes?.[0]?.code ?? '',
    }));
}

// Ensure all existing automatic discounts allow combining with product discounts
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

// Delete an automatic discount by ID
async function deleteDiscount(shopDomain: string, token: string, discountId: string) {
  await shopifyGraphQL(shopDomain, token, `
    mutation discountAutomaticDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        userErrors { field message }
      }
    }
  `, { id: discountId });
}

// Delete a code discount by ID
async function deleteCodeDiscount(shopDomain: string, token: string, discountId: string) {
  await shopifyGraphQL(shopDomain, token, `
    mutation discountCodeDelete($id: ID!) {
      discountCodeDelete(id: $id) {
        userErrors { field message }
      }
    }
  `, { id: discountId });
}



// Generate a unique discount code
function generateGiftCode(tierNumber: number): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GIFT-T${tierNumber}-${rand}`;
}

// Create CODE-based BASIC discount (100% off specific product) — for tier 2+ gifts.
          ... on DiscountCodeBasic {
            title
            status
            codes(first: 1) { nodes { code } }
          }
// Uses DiscountCodeBasic instead of DiscountCodeBxgy to avoid BXGY stacking conflicts
// with the tier 1 automatic BXGY discount.
// Cart drawer redirects checkout through /discount/CODE?redirect=/checkout
async function createCodeDiscount(
  shopDomain: string, token: string,
  productGid: string, tierGoal: number, tierNumber: number, allProductGids: string[],
) {
  const code = generateGiftCode(tierNumber);
  const result = await shopifyGraphQL(shopDomain, token, `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount { ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } } }
        }
        userErrors { field message }
      }
    }
  `, {
    basicCodeDiscount: {
      title: `Gift #${tierNumber}`,
      startsAt: new Date().toISOString(),
      usageLimit: null,
      code,
      customerSelection: { all: true },
      customerGets: {
        items: { products: { productsToAdd: [productGid] } },
        value: { percentage: 1.0 },
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
    },
  });

  if (result?.errors?.length > 0) {
    return { error: result.errors.map((e: any) => e.message).join('; ') };
  }
  const errors = result?.data?.discountCodeBasicCreate?.userErrors;
  if (errors?.length > 0) {
    return { error: errors };
  }
  const node = result?.data?.discountCodeBasicCreate?.codeDiscountNode;
  return { id: node?.id, code };
}

// Look up product GID from handle
async function getProductGidByHandle(shopDomain: string, token: string, handle: string): Promise<string | null> {
  const result = await shopifyGraphQL(shopDomain, token, `
    query productByIdentifier($identifier: ProductIdentifierInput!) {
      productByIdentifier(identifier: $identifier) { id }
    }
  `, { identifier: { handle } });
  return result?.data?.productByIdentifier?.id ?? null;
}

/**
 * POST — Clean sync gift discounts.
 * Deletes all existing gift discounts, then recreates:
 * - First gift tier → automatic BXGY (auto-applies)
 * - Subsequent gift tiers → code BXGY (cart drawer applies via /discount/CODE redirect)
 */
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

    // 0. Ensure existing store discounts allow combining
    await ensureExistingDiscountsCombine(store.shopDomain, token);

    // 1. Find all existing gift discounts (both automatic and code-based)
    const existingAuto = await findExistingGiftDiscounts(store.shopDomain, token);
    const existingCodes = await findExistingCodeDiscounts(store.shopDomain, token);

    // 2. Build desired state
    const desired: { handle: string; title: string; productGid: string; tierGoal: number; tierNumber: number }[] = [];
    const notFound: string[] = [];

    let tierNumber = 0;
    for (const tier of tiers) {
      tierNumber++;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (const gift of giftProducts) {
        if (!gift.handle) continue;
        const productGid = await getProductGidByHandle(store.shopDomain, token, gift.handle);
        if (!productGid) {
          console.warn(`[gift-discounts] Product not found: ${gift.handle}`);
          notFound.push(gift.handle);
          continue;
        }
        desired.push({
          handle: gift.handle,
          title: gift.title || gift.handle,
          productGid,
          tierGoal: tier.goal,
          tierNumber,
        });
      }
    }

    // 3. Delete ALL existing gift discounts (clean slate — avoids type mismatch from legacy)
    for (const disc of existingAuto) {
      await deleteDiscount(store.shopDomain, token, disc.id);
    }
    for (const disc of existingCodes) {
      await deleteCodeDiscount(store.shopDomain, token, disc.id);
    }
    const deletedCount = existingAuto.length + existingCodes.length;
    console.log(`[gift-discounts] Cleaned ${deletedCount} old discounts (${existingAuto.length} auto + ${existingCodes.length} code)`);

    // 4. Recreate as CODE discounts (one per gift product).
    // IMPORTANT: Cannot use automatic BXGY because stores already have their own
    // automatic BXGY discounts (e.g. "1+2 FREE") and Shopify can't stack them.
    // Code discounts are applied via /discount/CODE1,CODE2?redirect=/checkout.
    const results: { tier: number; handle: string; title: string; gid: string; discountId: string; type: 'code'; code: string }[] = [];
    const giftCodes: string[] = [];
    const errors: any[] = [];

    for (const want of desired) {
      const codeResult = await createCodeDiscount(
        store.shopDomain, token, want.productGid, want.tierGoal, want.tierNumber, [],
      );

      if (codeResult?.error) {
        errors.push({ handle: want.handle, error: codeResult.error });
      } else if (codeResult?.id) {
        const discountCode = (codeResult as any).code;
        giftCodes.push(discountCode);
        results.push({
          tier: want.tierGoal, handle: want.handle, title: want.title,
          gid: want.productGid, discountId: codeResult.id as string, type: 'code', code: discountCode,
        });
      }
    }

    // 5. Store gift discount codes in config so cart drawer can use them at checkout
    const url = new URL(req.url);
    const target = url.searchParams.get('target');
    const configField = target === 'demo' ? 'demoConfig' : 'config';
    const otherField = target === 'demo' ? 'config' : 'demoConfig';
    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore[configField] as any) ?? {};
      const otherCfg = (currentStore[otherField] as any) ?? {};
      if (giftCodes.length > 0) {
        cfg.giftDiscountCodes = giftCodes;
        otherCfg.giftDiscountCodes = giftCodes;
      } else {
        delete cfg.giftDiscountCodes;
        delete otherCfg.giftDiscountCodes;
      }
      await prisma.store.update({ where: { id }, data: { [configField]: cfg, [otherField]: otherCfg } });
    }

    console.log(`[gift-discounts] Sync complete: ${results.length} created, ${deletedCount} deleted`);

    return NextResponse.json({
      success: true,
      discounts: results,
      errors: errors.length > 0 ? errors : null,
      notFound,
      deleted: deletedCount,
      created: results.length,
      giftCodes,
    });
  } catch (err: any) {
    console.error('[gift-discounts] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET — Check if gift discounts already exist for this store.
 */
export async function GET(
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

    const existing = await findExistingGiftDiscounts(store.shopDomain, store.accessToken);
    const existingCodes = await findExistingCodeDiscounts(store.shopDomain, store.accessToken);
    return NextResponse.json({
      exists: existing.length > 0 || existingCodes.length > 0,
      count: existing.length + existingCodes.length,
      automatic: existing.map(e => ({ id: e.id, title: e.title, giftProductGid: e.giftProductGid })),
      codes: existingCodes.map(e => ({ id: e.id, title: e.title, code: e.code })),
    });
  } catch (err: any) {
    console.error('[gift-discounts] GET error:', err.message);
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
    const existingAuto = await findExistingGiftDiscounts(store.shopDomain, token);
    const existingCodes = await findExistingCodeDiscounts(store.shopDomain, token);

    for (const node of existingAuto) {
      await deleteDiscount(store.shopDomain, token, node.id);
    }
    for (const node of existingCodes) {
      await deleteCodeDiscount(store.shopDomain, token, node.id);
    }

    // Clear codes from config
    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore.config as any) ?? {};
      const demo = (currentStore.demoConfig as any) ?? {};
      delete cfg.giftDiscountCodes;
      delete demo.giftDiscountCodes;
      await prisma.store.update({ where: { id }, data: { config: cfg, demoConfig: demo } });
    }

    return NextResponse.json({ success: true, deleted: existingAuto.length + existingCodes.length });
  } catch (err: any) {
    console.error('[gift-discounts] Delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
