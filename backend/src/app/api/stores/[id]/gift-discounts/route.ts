import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Manages gift products via PRODUCT DUPLICATION + $0 PRICE approach.
 *
 * Instead of using discount codes, we DUPLICATE gift products and set
 * their price to $0 with compare_at_price showing the original value.
 * Then we unpublish from the Online Store so customers can't browse to them.
 *
 * NO DISCOUNT CODES NEEDED — the product is simply free.
 *
 * POST — Clean-sync: delete old duplicates, create new ones at $0.
 * GET — Check existing gift duplicates.
 * DELETE — Remove all gift duplicates, restore config.
 */

const GIFT_TAG = '_eliminai-gift';

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

// --- Product Duplication ---

// Duplicate a product, set price to $0, compare_at_price to original, unpublish from storefront
async function duplicateAndZeroPrice(
  shopDomain: string, token: string, originalProductGid: string, originalTitle: string, originalPrice: string,
): Promise<{ duplicateGid: string; duplicateVariantId: string; duplicateHandle: string } | { error: string }> {
  const newTitle = originalTitle;

  // 1. Duplicate the product (copies images, fulfillment, weight, etc.)
  const result = await shopifyGraphQL(shopDomain, token, `
    mutation productDuplicate($productId: ID!, $newTitle: String!, $includeImages: Boolean!, $newStatus: ProductStatus) {
      productDuplicate(productId: $productId, newTitle: $newTitle, includeImages: $includeImages, newStatus: $newStatus) {
        newProduct {
          id
          handle
          title
          variants(first: 10) { nodes { id price } }
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

  const dupErrors = result?.data?.productDuplicate?.userErrors;
  if (dupErrors?.length > 0) {
    return { error: dupErrors.map((e: any) => e.message).join('; ') };
  }

  const newProduct = result?.data?.productDuplicate?.newProduct;
  if (!newProduct) {
    return { error: 'productDuplicate returned no product: ' + JSON.stringify(result) };
  }

  const variants = newProduct.variants?.nodes ?? [];
  if (variants.length === 0) {
    return { error: 'Duplicate product has no variants' };
  }

  // 2. Tag the duplicate so we can find/cleanup our products
  await shopifyGraphQL(shopDomain, token, `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `, { id: newProduct.id, tags: [GIFT_TAG] });

  // 3. Set ALL variant prices to $0, compare_at_price to original price
  for (const variant of variants) {
    const comparePrice = variant.price || originalPrice || '0';
    await shopifyGraphQL(shopDomain, token, `
      mutation productVariantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant { id price compareAtPrice }
          userErrors { field message }
        }
      }
    `, {
      input: {
        id: variant.id,
        price: '0',
        compareAtPrice: comparePrice,
      },
    });
  }

  // 4. Unpublish from Online Store via REST API (published: false)
  //    This works without read_publications/write_publications scopes.
  //    Product stays ACTIVE (can be added to cart) but hidden from storefront.
  const numericProductId = newProduct.id.replace('gid://shopify/Product/', '');
  const unpubRes = await fetch(`https://${shopDomain}/admin/api/2025-01/products/${numericProductId}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: { id: parseInt(numericProductId), published: false } }),
  });
  if (unpubRes.ok) {
    console.log(`[gift-discounts] Unpublished "${newTitle}" from Online Store (published=false)`);
  } else {
    console.warn(`[gift-discounts] Failed to unpublish "${newTitle}": ${unpubRes.status}`);
  }

  // 5. Remove duplicate from ALL collections — Shopify copies collection memberships
  //    from the original. If gift duplicates stay in collections used by BXGY discounts
  //    (e.g. "All items"), Shopify wastes free slots on $0 gifts instead of real products.
  const collResult = await shopifyGraphQL(shopDomain, token, `{
    product(id: "${newProduct.id}") {
      collections(first: 50) {
        nodes { id title }
      }
    }
  }`);
  const collections = collResult?.data?.product?.collections?.nodes ?? [];
  if (collections.length > 0) {
    for (const coll of collections) {
      await shopifyGraphQL(shopDomain, token, `
        mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            userErrors { field message }
          }
        }
      `, {
        id: coll.id,
        productIds: [newProduct.id],
      });
    }
    console.log(`[gift-discounts] Removed "${newTitle}" from ${collections.length} collections: ${collections.map((c: any) => c.title).join(', ')}`);
  }

  const duplicateVariantGid = variants[0].id;
  const duplicateVariantId = duplicateVariantGid.replace('gid://shopify/ProductVariant/', '');

  console.log(`[gift-discounts] Duplicated "${originalTitle}" → "${newTitle}" at $0 (compare: $${originalPrice}) (variant ${duplicateVariantId})`);

  return {
    duplicateGid: newProduct.id,
    duplicateVariantId,
    duplicateHandle: newProduct.handle,
  };
}

// Delete a product (our duplicate only — caller must verify _eliminai-gift tag)
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
  const nodes = result?.data?.products?.nodes ?? [];
  // SAFETY: Only return products tagged with _eliminai-gift — OUR duplicates only.
  // The tag is ONLY applied by duplicateAndZeroPrice(), never by external scripts.
  return nodes;
}

// Look up product GID + title + price from handle
async function getProductByHandle(shopDomain: string, token: string, handle: string): Promise<{ id: string; title: string; price: string } | null> {
  const result = await shopifyGraphQL(shopDomain, token, `{
    products(first: 1, query: "handle:${handle}") {
      nodes { id title handle status variants(first: 1) { nodes { price } } }
    }
  }`);
  const nodes = result?.data?.products?.nodes ?? [];
  const exact = nodes.find((n: any) => n.handle === handle && n.status === 'ACTIVE');
  if (exact) return { id: exact.id, title: exact.title, price: exact.variants?.nodes?.[0]?.price ?? '0' };
  const anyMatch = nodes.find((n: any) => n.handle === handle);
  if (anyMatch) {
    console.log(`[gift-discounts] Product "${handle}" found but status=${anyMatch.status}`);
    return { id: anyMatch.id, title: anyMatch.title, price: anyMatch.variants?.nodes?.[0]?.price ?? '0' };
  }
  console.warn(`[gift-discounts] Product not found for handle "${handle}"`);
  return null;
}

// --- Legacy discount cleanup (remove old discounts from previous approach) ---

async function cleanupLegacyDiscounts(shopDomain: string, token: string) {
  const autoResult = await shopifyGraphQL(shopDomain, token, `{
    automaticDiscountNodes(first: 50, query: "title:Gift*") {
      nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } ... on DiscountAutomaticBasic { title } } }
    }
  }`);
  const autoNodes = (autoResult?.data?.automaticDiscountNodes?.nodes ?? [])
    .filter((n: any) => (n.automaticDiscount?.title ?? '').startsWith('Gift'));
  for (const n of autoNodes) {
    await shopifyGraphQL(shopDomain, token, `mutation { discountAutomaticDelete(id: "${n.id}") { userErrors { field message } } }`);
    console.log(`[gift-discounts] Cleaned up legacy automatic discount: ${n.automaticDiscount?.title}`);
  }

  const codeResult = await shopifyGraphQL(shopDomain, token, `{
    codeDiscountNodes(first: 50, query: "title:Gift*") {
      nodes { id codeDiscount { ... on DiscountCodeBasic { title } ... on DiscountCodeBxgy { title } } }
    }
  }`);
  const codeNodes = (codeResult?.data?.codeDiscountNodes?.nodes ?? [])
    .filter((n: any) => (n.codeDiscount?.title ?? '').startsWith('Gift'));
  for (const n of codeNodes) {
    await shopifyGraphQL(shopDomain, token, `mutation { discountCodeDelete(id: "${n.id}") { userErrors { field message } } }`);
    console.log(`[gift-discounts] Cleaned up legacy code discount: ${n.codeDiscount?.title}`);
  }

  return autoNodes.length + codeNodes.length;
}

/**
 * POST — Sync gift products: duplicate originals at $0, unpublish from storefront.
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

    // 1. Delete existing gift duplicates
    const existingDuplicates = await findGiftDuplicates(store.shopDomain, token);
    for (const dup of existingDuplicates) {
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);
    }

    // 2. Clean up legacy discounts
    const legacyCleaned = await cleanupLegacyDiscounts(store.shopDomain, token);

    // 3. Build desired state from tiers
    const desired: { handle: string; title: string; originalGid: string; originalPrice: string; tierGoal: number; tierNumber: number; giftIndex: number; tierIndex: number; variantTitle?: string }[] = [];
    const notFound: string[] = [];

    // Cache product lookups to avoid repeated API calls for same handle
    const productCache: Record<string, { id: string; title: string; price: string } | null> = {};

    let tierNumber = 0;
    for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
      const tier = tiers[tIdx];
      tierNumber++;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (let gIdx = 0; gIdx < giftProducts.length; gIdx++) {
        const gift = giftProducts[gIdx];
        if (!gift.handle) continue;
        const lookupHandle = gift.originalHandle || gift.handle;

        if (!(lookupHandle in productCache)) {
          productCache[lookupHandle] = await getProductByHandle(store.shopDomain, token, lookupHandle);
        }
        const product = productCache[lookupHandle];
        if (!product) {
          console.warn(`[gift-discounts] Product not found: ${lookupHandle}`);
          notFound.push(lookupHandle);
          continue;
        }
        // Extract variant-specific title (part after em-dash)
        const variantTitle = gift.title?.includes('\u2014') ? gift.title.split('\u2014').pop()?.trim() : undefined;
        desired.push({
          handle: lookupHandle,
          title: product.title,
          originalGid: product.id,
          originalPrice: gift.price || product.price,
          tierGoal: tier.goal,
          tierNumber,
          giftIndex: gIdx,
          tierIndex: tIdx,
          variantTitle,
        });
      }
    }

    // 4. Duplicate each gift product at $0
    const results: any[] = [];
    const giftMappings: { originalHandle: string; originalUrl: string; duplicateHandle: string; duplicateVariantId: string; duplicateGid: string; tierIndex?: number; giftIndex?: number; _used?: boolean }[] = [];
    const errors: any[] = [];

    for (const want of desired) {
      const dupResult = await duplicateAndZeroPrice(
        store.shopDomain, token, want.originalGid, want.title, want.originalPrice,
      );
      if ('error' in dupResult) {
        errors.push({ handle: want.handle, error: dupResult.error });
        continue;
      }

      giftMappings.push({
        originalHandle: want.handle,
        originalUrl: `/products/${want.handle}`,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
        tierIndex: want.tierIndex,
        giftIndex: want.giftIndex,
      });

      results.push({
        tier: want.tierGoal,
        originalHandle: want.handle,
        originalTitle: want.title,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
      });
    }

    // 5. Update config with gift mappings (NO discount codes needed!)
    const url = new URL(req.url);
    const target = url.searchParams.get('target');
    const configField = target === 'demo' ? 'demoConfig' : 'config';
    const otherField = target === 'demo' ? 'config' : 'demoConfig';
    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore[configField] as any) ?? {};
      const otherCfg = (currentStore[otherField] as any) ?? {};

      for (const c of [cfg, otherCfg]) {
        delete c.giftDiscountCodes;

        if (giftMappings.length > 0) {
          c.giftMappings = giftMappings;
        } else {
          delete c.giftMappings;
        }

        const addons = c.addons ?? {};
        const rewardConfig = addons.freeShippingBar?.config ?? {};
        const cfgTiers = rewardConfig.tiers ?? [];
        for (let tI = 0; tI < cfgTiers.length; tI++) {
          const tier = cfgTiers[tI];
          const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
          for (let gI = 0; gI < giftProducts.length; gI++) {
            const gp = giftProducts[gI];
            const lookupHandle = gp.originalHandle || gp.handle;
            // Match by tierIndex + giftIndex for unique mapping (handles same product in multiple slots)
            const mapping = giftMappings.find(m => m.tierIndex === tI && m.giftIndex === gI)
              || giftMappings.find(m => m.originalHandle === lookupHandle && !m._used);
            if (mapping) {
              (mapping as any)._used = true;
              gp.originalHandle = lookupHandle;
              gp.originalUrl = mapping.originalUrl;
              gp.handle = mapping.duplicateHandle;
              gp.variantId = parseInt(mapping.duplicateVariantId) || gp.variantId;
            }
          }
        }
      }

      await prisma.store.update({ where: { id }, data: { [configField]: cfg, [otherField]: otherCfg } });
    }

    console.log(`[gift-discounts] Sync complete: ${results.length} duplicated at $0, ${existingDuplicates.length} old deleted, ${legacyCleaned} legacy discounts cleaned`);

    return NextResponse.json({
      success: true,
      duplicates: results,
      giftMappings,
      errors: errors.length > 0 ? errors : null,
      notFound,
      deleted: { duplicates: existingDuplicates.length, legacyDiscounts: legacyCleaned },
      created: results.length,
    });
  } catch (err: any) {
    console.error('[gift-discounts] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET — Check existing gift duplicates for this store.
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

    const duplicates = await findGiftDuplicates(store.shopDomain, store.accessToken);
    return NextResponse.json({
      exists: duplicates.length > 0,
      count: duplicates.length,
      duplicates: duplicates.map(d => ({ id: d.id, title: d.title, handle: d.handle })),
    });
  } catch (err: any) {
    console.error('[gift-discounts] GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE — Remove all gift duplicates for this store.
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

    const legacyCleaned = await cleanupLegacyDiscounts(store.shopDomain, token);

    const duplicates = await findGiftDuplicates(store.shopDomain, token);
    let deleted = 0;
    for (const dup of duplicates) {
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);
      deleted++;
    }

    const currentStore = await prisma.store.findUnique({ where: { id }, select: { config: true, demoConfig: true } });
    if (currentStore) {
      const cfg = (currentStore.config as any) ?? {};
      const demo = (currentStore.demoConfig as any) ?? {};
      for (const c of [cfg, demo]) {
        delete c.giftDiscountCodes;
        delete c.giftMappings;
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
      deleted: { duplicates: deleted, legacyDiscounts: legacyCleaned },
    });
  } catch (err: any) {
    console.error('[gift-discounts] Delete error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}