import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/stores/:id/protection/update
 *
 * Updates the existing Shopify protection product + config.
 *
 * Steps:
 *   1. Get existing product ID from store config
 *   2. Update title via productUpdate if changed
 *   3. Compare current variants with new tiers
 *   4. Update/create/delete variants to match desired tiers
 *   5. Update store config
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

function buildTierTitle(maxCartValue: number | null, index: number, total: number): string {
  if (total === 1) return 'Shipping Protection';
  if (index === total - 1) {
    return `$${Math.round((maxCartValue ?? 0) / 100)}+`;
  }
  return `Up to $${Math.round((maxCartValue ?? 0) / 100)}`;
}

export async function PUT(
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
    const protectionConfig = config.addons?.shippingProtection;

    if (!protectionConfig?.productId) {
      return NextResponse.json({ error: 'No protection product found. Create one first.' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      iconId,
      pricingMode,
      singlePrice,
      tiers = [],
      defaultOn,
      description,
    } = body;

    const shopDomain = store.shopDomain;
    const token = store.accessToken;
    const productGid = protectionConfig.productId;

    // Build effective tiers
    const effectiveTiers = (pricingMode ?? protectionConfig.pricingMode) === 'single'
      ? [{ price: singlePrice ?? protectionConfig.tiers?.[0]?.price ?? 199, maxCartValue: null }]
      : (tiers.length > 0 ? tiers : protectionConfig.tiers?.map((t: any) => ({ price: t.price, maxCartValue: t.maxValue })) ?? []);

    if (effectiveTiers.length === 0) {
      return NextResponse.json({ error: 'At least one tier/price is required' }, { status: 400 });
    }

    // 1. Update product title if changed
    if (title && title !== protectionConfig.title) {
      const updateResult = await shopifyGraphQL(shopDomain, token, `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors { field message }
          }
        }
      `, {
        input: { id: productGid, title },
      });
      const updateErrors = updateResult?.data?.productUpdate?.userErrors;
      if (updateErrors?.length > 0) {
        console.warn('[protection/update] Product title update warnings:', updateErrors);
      }
    }

    // 2. Get current variants from Shopify
    const productResult = await shopifyGraphQL(shopDomain, token, `
      query getProduct($id: ID!) {
        product(id: $id) {
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

    const currentVariants = productResult?.data?.product?.variants?.nodes ?? [];

    // 3. Determine what to update, create, delete
    const toUpdate: any[] = [];
    const toCreate: any[] = [];
    const toDeleteIds: string[] = [];

    for (let i = 0; i < Math.max(effectiveTiers.length, currentVariants.length); i++) {
      const tier = effectiveTiers[i];
      const existingVariant = currentVariants[i];

      if (tier && existingVariant) {
        // Update existing variant
        const newTitle = buildTierTitle(tier.maxCartValue, i, effectiveTiers.length);
        const newPrice = (tier.price / 100).toFixed(2);
        if (existingVariant.title !== newTitle || existingVariant.price !== newPrice) {
          toUpdate.push({
            id: existingVariant.id,
            title: newTitle,
            price: newPrice,
          });
        }
      } else if (tier && !existingVariant) {
        // New tier — needs variant creation
        toCreate.push({
          title: buildTierTitle(tier.maxCartValue, i, effectiveTiers.length),
          price: (tier.price / 100).toFixed(2),
          requiresShipping: false,
          taxable: false,
        });
      } else if (!tier && existingVariant) {
        // Extra variant — delete
        toDeleteIds.push(existingVariant.id);
      }
    }

    // 4a. Update existing variants
    if (toUpdate.length > 0) {
      const updateResult = await shopifyGraphQL(shopDomain, token, `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              title
              price
            }
            userErrors { field message }
          }
        }
      `, {
        productId: productGid,
        variants: toUpdate,
      });
      const errors = updateResult?.data?.productVariantsBulkUpdate?.userErrors;
      if (errors?.length > 0) {
        console.warn('[protection/update] Variant update warnings:', errors);
      }
    }

    // 4b. Create new variants
    if (toCreate.length > 0) {
      const createResult = await shopifyGraphQL(shopDomain, token, `
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            productVariants {
              id
              title
              price
            }
            userErrors { field message }
          }
        }
      `, {
        productId: productGid,
        variants: toCreate,
      });
      const errors = createResult?.data?.productVariantsBulkCreate?.userErrors;
      if (errors?.length > 0) {
        console.warn('[protection/update] Variant create warnings:', errors);
      }
    }

    // 4c. Delete extra variants
    if (toDeleteIds.length > 0) {
      const deleteResult = await shopifyGraphQL(shopDomain, token, `
        mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
          productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
            userErrors { field message }
          }
        }
      `, {
        productId: productGid,
        variantsIds: toDeleteIds,
      });
      const errors = deleteResult?.data?.productVariantsBulkDelete?.userErrors;
      if (errors?.length > 0) {
        console.warn('[protection/update] Variant delete warnings:', errors);
      }
    }

    // 5. Re-fetch variants to get final state
    const finalResult = await shopifyGraphQL(shopDomain, token, `
      query getProduct($id: ID!) {
        product(id: $id) {
          handle
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

    const finalVariants = finalResult?.data?.product?.variants?.nodes ?? [];
    const finalHandle = finalResult?.data?.product?.handle ?? protectionConfig.handle;

    // Build updated tier config
    const tierConfig = finalVariants.map((v: any, idx: number) => {
      const tier = effectiveTiers[idx] ?? effectiveTiers[effectiveTiers.length - 1];
      const variantNumericId = parseInt(v.id.replace(/\D/g, ''), 10);
      return {
        vid: variantNumericId,
        price: tier.price,
        maxValue: tier.maxCartValue ?? null,
      };
    });

    // Update store config
    const addons = config.addons ?? {};
    addons.shippingProtection = {
      ...protectionConfig,
      ...(title !== undefined && { title }),
      ...(iconId !== undefined && { iconId }),
      ...(pricingMode !== undefined && { pricingMode }),
      ...(defaultOn !== undefined && { defaultOn }),
      ...(description !== undefined && { description }),
      handle: finalHandle,
      tiers: tierConfig,
      updatedAt: new Date().toISOString(),
    };
    config.addons = addons;

    await prisma.store.update({
      where: { id },
      data: { config },
    });

    return NextResponse.json({
      success: true,
      tiers: tierConfig,
      variants: finalVariants.map((v: any) => ({
        id: v.id,
        numericId: parseInt(v.id.replace(/\D/g, ''), 10),
        title: v.title,
        price: v.price,
      })),
    });
  } catch (err: any) {
    console.error('[protection/update] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
