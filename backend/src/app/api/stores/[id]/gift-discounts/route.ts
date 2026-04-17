import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Manages gift products via PRODUCT DUPLICATION approach.
 *
 * Instead of using the store's original products (which interfere with
 * store BXGY promotions), we DUPLICATE gift products with exact settings
 * and use the duplicates in the cart. This ensures:
 * - Store's BXGY never consumes gift items (duplicates aren't in their collections)
 * - Gift items get their own discount codes (100% off)
 * - Cart links point to the ORIGINAL product URL
 * - Cleanup deletes only OUR duplicates
 *
 * POST — Clean-sync: delete old duplicates + discounts, create new ones.
 * GET — Check existing gift discounts.
 * DELETE — Remove all gift duplicates + discounts.
 */

const GIFT_TAG = '_eliminai-gift';

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

// --- Product Duplication ---

// Duplicate a product with ALL settings (images, variants, fulfillment, weight, etc.)
async function duplicateProduct(
  shopDomain: string, token: string, originalProductGid: string, originalTitle: string,
): Promise<{ duplicateGid: string; duplicateVariantId: string; duplicateHandle: string } | { error: string }> {
  const newTitle = `[Gift] ${originalTitle}`;

  const result = await shopifyGraphQL(shopDomain, token, `
    mutation productDuplicate($productId: ID!, $newTitle: String!, $includeImages: Boolean!, $newStatus: ProductStatus) {
      productDuplicate(productId: $productId, newTitle: $newTitle, includeImages: $includeImages, newStatus: $newStatus) {
        newProduct {
          id
          handle
          title
          variants(first: 1) { nodes { id } }
        }
        userErrors { field message }
      }
    }
  `, {
    productId: originalProductGid,
    newTitle,
    includeImages: true,
    newStatus: 'ACTIVE',
  });

  const errors = result?.data?.productDuplicate?.userErrors;
  if (errors?.length > 0) {
    return { error: errors.map((e: any) => e.message).join('; ') };
  }

  const newProduct = result?.data?.productDuplicate?.newProduct;
  if (!newProduct) {
    return { error: 'productDuplicate returned no product: ' + JSON.stringify(result) };
  }

  const duplicateVariantGid = newProduct.variants?.nodes?.[0]?.id;
  if (!duplicateVariantGid) {
    return { error: 'Duplicate product has no variants' };
  }

  // Extract numeric variant ID for cart/add.js
  const duplicateVariantId = duplicateVariantGid.replace('gid://shopify/ProductVariant/', '');

  // Tag the duplicate so we can find/cleanup our products
  await shopifyGraphQL(shopDomain, token, `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `, { id: newProduct.id, tags: [GIFT_TAG] });

  console.log(`[gift-discounts] Duplicated "${originalTitle}" → "${newTitle}" (${newProduct.id}, variant ${duplicateVariantId})`);

  return {
    duplicateGid: newProduct.id,
    duplicateVariantId,
    duplicateHandle: newProduct.handle,
  };
}

// Delete a product (our duplicate)
async function deleteProduct(shopDomain: string, token: string, productGid: string) {
  const result = await shopifyGraphQL(shopDomain, token, `
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        userErrors { field message }
      }
    }
  `, { input: { id: productGid } });
  const errors = result?.data?.productDelete?.userErrors;
  if (errors?.length > 0) {
    console.warn(`[gift-discounts] Failed to delete product ${productGid}:`, errors);
  }
}

// Find all our duplicate gift products (tagged _eliminai-gift)
async function findGiftDuplicates(shopDomain: string, token: string): Promise<{ id: string; title: string; handle: string }[]> {
  const result = await shopifyGraphQL(shopDomain, token, `{
    products(first: 50, query: "tag:${GIFT_TAG}") {
      nodes { id title handle }
    }
  }`);
  return (result?.data?.products?.nodes ?? []);
}

// --- Discount Management ---

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

// Find existing CODE-based gift discounts
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
  // SAFETY: Only include discounts whose title starts with "Gift"
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

// Create CODE-based BASIC discount (100% off specific DUPLICATE product)
async function createCodeDiscount(
  shopDomain: string, token: string,
  duplicateProductGid: string, tierGoal: number, tierNumber: number,
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
        items: { products: { productsToAdd: [duplicateProductGid] } },
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

// Look up product GID + title from handle
async function getProductByHandle(shopDomain: string, token: string, handle: string): Promise<{ id: string; title: string } | null> {
  const result = await shopifyGraphQL(shopDomain, token, `
    query productByIdentifier($identifier: ProductIdentifierInput!) {
      productByIdentifier(identifier: $identifier) { id title }
    }
  `, { identifier: { handle } });
  const p = result?.data?.productByIdentifier;
  return p ? { id: p.id, title: p.title } : null;
}

/**
 * POST — Clean sync gift discounts with product duplication.
 *
 * Flow:
 * 1. Delete old gift discounts (auto + code)
 * 2. Delete old gift product duplicates (tagged _eliminai-gift)
 * 3. For each gift product in tiers:
 *    a. Duplicate the original product (exact copy with images, fulfillment, etc.)
 *    b. Tag duplicate with _eliminai-gift
 *    c. Create discount code for the DUPLICATE (100% off)
 * 4. Store mapping in config: duplicate handles, variant IDs, original URLs
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

    // 1. Delete ALL existing gift discounts (clean slate)
    const existingAuto = await findExistingGiftDiscounts(store.shopDomain, token);
    const existingCodes = await findExistingCodeDiscounts(store.shopDomain, token);
    for (const disc of existingAuto) {
      await deleteDiscount(store.shopDomain, token, disc.id);
    }
    for (const disc of existingCodes) {
      await deleteCodeDiscount(store.shopDomain, token, disc.id);
    }
    const deletedDiscounts = existingAuto.length + existingCodes.length;

    // 2. Delete ALL existing gift duplicate products
    const existingDuplicates = await findGiftDuplicates(store.shopDomain, token);
    for (const dup of existingDuplicates) {
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);
    }

    // 3. Build desired state from tiers
    const desired: { handle: string; title: string; originalGid: string; tierGoal: number; tierNumber: number }[] = [];
    const notFound: string[] = [];

    let tierNumber = 0;
    for (const tier of tiers) {
      tierNumber++;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (const gift of giftProducts) {
        if (!gift.handle) continue;
        const product = await getProductByHandle(store.shopDomain, token, gift.handle);
        if (!product) {
          console.warn(`[gift-discounts] Product not found: ${gift.handle}`);
          notFound.push(gift.handle);
          continue;
        }
        desired.push({
          handle: gift.handle,
          title: product.title,
          originalGid: product.id,
          tierGoal: tier.goal,
          tierNumber,
        });
      }
    }

    // 4. Duplicate each gift product and create discount codes
    const results: any[] = [];
    const giftCodes: string[] = [];
    const giftMappings: { originalHandle: string; originalUrl: string; duplicateHandle: string; duplicateVariantId: string; duplicateGid: string }[] = [];
    const errors: any[] = [];

    for (const want of desired) {
      // 4a. Duplicate the product
      const dupResult = await duplicateProduct(store.shopDomain, token, want.originalGid, want.title);
      if ('error' in dupResult) {
        errors.push({ handle: want.handle, error: dupResult.error });
        continue;
      }

      // 4b. Create discount code for the DUPLICATE
      const codeResult = await createCodeDiscount(
        store.shopDomain, token, dupResult.duplicateGid, want.tierGoal, want.tierNumber,
      );

      if (codeResult?.error) {
        errors.push({ handle: want.handle, error: codeResult.error });
        // Still keep the duplicate — discount can be retried
      } else if (codeResult?.id) {
        giftCodes.push((codeResult as any).code);
      }

      // 4c. Store the mapping
      giftMappings.push({
        originalHandle: want.handle,
        originalUrl: `/products/${want.handle}`,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
      });

      results.push({
        tier: want.tierGoal,
        originalHandle: want.handle,
        originalTitle: want.title,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
        discountCode: giftCodes[giftCodes.length - 1] || null,
      });
    }

    // 5. Update config with gift mappings + discount codes
    // The cart drawer needs: duplicate handles, duplicate variant IDs, original URLs, discount codes
    const url = new URL(req.url);
    const target = url.searchParams.get('target');
    const configField = target === 'demo' ? 'demoConfig' : 'config';
    const otherField = target === 'demo' ? 'config' : 'demoConfig';
    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore[configField] as any) ?? {};
      const otherCfg = (currentStore[otherField] as any) ?? {};

      // Update gift data in BOTH configs
      for (const c of [cfg, otherCfg]) {
        if (giftCodes.length > 0) {
          c.giftDiscountCodes = giftCodes;
        } else {
          delete c.giftDiscountCodes;
        }
        if (giftMappings.length > 0) {
          c.giftMappings = giftMappings;
        } else {
          delete c.giftMappings;
        }

        // Update tier giftProducts to use DUPLICATE handles + variant IDs
        const addons = c.addons ?? {};
        const rewardConfig = addons.freeShippingBar?.config ?? {};
        const cfgTiers = rewardConfig.tiers ?? [];
        for (const tier of cfgTiers) {
          const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
          for (const gp of giftProducts) {
            const mapping = giftMappings.find(m => m.originalHandle === gp.handle);
            if (mapping) {
              // Store original info for reference
              gp.originalHandle = gp.handle;
              gp.originalUrl = mapping.originalUrl;
              // Switch to duplicate for cart operations
              gp.handle = mapping.duplicateHandle;
              gp.variantId = parseInt(mapping.duplicateVariantId) || gp.variantId;
            }
          }
        }
      }

      await prisma.store.update({ where: { id }, data: { [configField]: cfg, [otherField]: otherCfg } });
    }

    console.log(`[gift-discounts] Sync complete: ${results.length} duplicated+discounted, ${deletedDiscounts} discounts deleted, ${existingDuplicates.length} old duplicates deleted`);

    return NextResponse.json({
      success: true,
      discounts: results,
      giftMappings,
      errors: errors.length > 0 ? errors : null,
      notFound,
      deleted: { discounts: deletedDiscounts, duplicates: existingDuplicates.length },
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
    const duplicates = await findGiftDuplicates(store.shopDomain, store.accessToken);
    return NextResponse.json({
      exists: existing.length > 0 || existingCodes.length > 0,
      count: existing.length + existingCodes.length,
      automatic: existing.map(e => ({ id: e.id, title: e.title, giftProductGid: e.giftProductGid })),
      codes: existingCodes.map(e => ({ id: e.id, title: e.title, code: e.code })),
      duplicates: duplicates.map(d => ({ id: d.id, title: d.title, handle: d.handle })),
    });
  } catch (err: any) {
    console.error('[gift-discounts] GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE — Remove all gift duplicates + discounts for this store.
 */
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

    // Delete discounts
    const existingAuto = await findExistingGiftDiscounts(store.shopDomain, token);
    const existingCodes = await findExistingCodeDiscounts(store.shopDomain, token);
    for (const node of existingAuto) {
      await deleteDiscount(store.shopDomain, token, node.id);
    }
    for (const node of existingCodes) {
      await deleteCodeDiscount(store.shopDomain, token, node.id);
    }

    // Delete duplicate products
    const duplicates = await findGiftDuplicates(store.shopDomain, token);
    for (const dup of duplicates) {
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);
    }

    // Clear config
    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore.config as any) ?? {};
      const demo = (currentStore.demoConfig as any) ?? {};
      for (const c of [cfg, demo]) {
        delete c.giftDiscountCodes;
        delete c.giftMappings;
        // Restore original handles in tiers
        const addons = c.addons ?? {};
        const rewardConfig = addons.freeShippingBar?.config ?? {};
        const tiers = rewardConfig.tiers ?? [];
        for (const tier of tiers) {
          const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
          for (const gp of giftProducts) {
            if (gp.originalHandle) {
              gp.handle = gp.originalHandle;
              delete gp.originalHandle;
              delete gp.originalUrl;
            }
          }
        }
      }
      await prisma.store.update({ where: { id }, data: { config: cfg, demoConfig: demo } });
    }

    return NextResponse.json({
      success: true,
      deleted: {
        discounts: existingAuto.length + existingCodes.length,
        duplicates: duplicates.length,
      },
    });
  } catch (err: any) {
    console.error('[gift-discounts] Delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
