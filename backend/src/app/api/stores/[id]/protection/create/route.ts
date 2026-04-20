import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/stores/:id/protection/create
 *
 * Creates a Shopify product for shipping protection + saves config.
 *
 * Input:
 *   title, iconId, customIconBase64, pricingMode ('single'|'tiered'),
 *   singlePrice (cents), tiers: [{price (cents), maxCartValue (cents)}],
 *   defaultOn, description
 *
 * Steps:
 *   1. Create Shopify product (type: Service, tags: _eliminai-cart-protection)
 *   2. Update default variant price + create additional variants for tiers 2+
 *   3. Unpublish from Online Store via publishableUnpublish
 *   4. Optionally upload icon via stagedUploadsCreate + productCreateMedia
 *   5. Save config to store DB under config.addons.shippingProtection
 */

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

function buildTierTitle(maxCartValue: number | null, index: number, total: number): string {
  if (total === 1) return 'Shipping Protection';
  if (index === total - 1) {
    return `$${Math.round((maxCartValue ?? 0) / 100)}+`;
  }
  return `Up to $${Math.round((maxCartValue ?? 0) / 100)}`;
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

    const body = await req.json();
    const {
      title = 'Shipping Protection',
      iconId = 'shield-filled',
      customIconBase64,
      pricingMode = 'single',
      singlePrice = 199, // cents
      tiers = [],
      defaultOn = true,
      description = '',
    } = body;

    const shopDomain = store.shopDomain;
    const token = store.accessToken;

    // Build effective tiers list
    const effectiveTiers = pricingMode === 'single'
      ? [{ price: singlePrice, maxCartValue: null }]
      : tiers;

    if (effectiveTiers.length === 0) {
      return NextResponse.json({ error: 'At least one tier/price is required' }, { status: 400 });
    }

    // 1. Create Shopify product (new API: product arg, no variants/requiresShipping inline)
    const createResult = await shopifyGraphQL(shopDomain, token, `
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            handle
            variants(first: 5) {
              nodes {
                id
                title
                price
              }
            }
          }
          userErrors { field message }
        }
      }
    `, {
      product: {
        title,
        productType: 'Service',
        tags: ['_eliminai-cart-protection'],
        descriptionHtml: description || `<p>${title} — protects your order against loss, damage, and theft during shipping.</p>`,
      },
    });

    const productErrors = createResult?.data?.productCreate?.userErrors;
    if (productErrors?.length > 0) {
      return NextResponse.json({ error: 'Failed to create product', details: productErrors }, { status: 400 });
    }

    const product = createResult?.data?.productCreate?.product;
    if (!product?.id) {
      console.error('[protection/create] Full response:', JSON.stringify(createResult));
      return NextResponse.json({ error: 'Product creation returned no product' }, { status: 500 });
    }

    const productGid = product.id;
    const defaultVariantId = product.variants.nodes[0]?.id;

    // 2. Update default variant with correct price and title
    const firstPriceDollars = (effectiveTiers[0].price / 100).toFixed(2);
    const firstTierTitle = buildTierTitle(effectiveTiers[0].maxCartValue, 0, effectiveTiers.length);

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
      variants: [{
        id: defaultVariantId,
        price: firstPriceDollars,
        title: firstTierTitle,
      }],
    });

    const allVariants = updateResult?.data?.productVariantsBulkUpdate?.productVariants ?? [product.variants.nodes[0]];

    // 2b. Create additional variants for tiers 2+
    if (effectiveTiers.length > 1) {
      const additionalVariants = effectiveTiers.slice(1).map((tier: any, idx: number) => ({
        title: buildTierTitle(tier.maxCartValue, idx + 1, effectiveTiers.length),
        price: (tier.price / 100).toFixed(2),
      }));

      const bulkResult = await shopifyGraphQL(shopDomain, token, `
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
        variants: additionalVariants,
      });

      const bulkErrors = bulkResult?.data?.productVariantsBulkCreate?.userErrors;
      if (bulkErrors?.length > 0) {
        console.warn('[protection/create] Variant bulk create warnings:', bulkErrors);
      }

      const newVariants = bulkResult?.data?.productVariantsBulkCreate?.productVariants ?? [];
      allVariants.push(...newVariants);
    }

    // 3. Unpublish from Online Store via REST API (doesn't need publications scope)
    try {
      const numericId = productGid.replace('gid://shopify/Product/', '');
      const unpubRes = await fetch(`https://${shopDomain}/admin/api/2025-01/products/${numericId}.json`, {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: { id: parseInt(numericId), published: false } }),
      });
      if (unpubRes.ok) {
        console.log('[protection/create] Unpublished product from Online Store');
      } else {
        console.warn('[protection/create] Unpublish failed:', unpubRes.status);
      }
    } catch (unpubErr) {
      console.warn('[protection/create] Unpublish warning:', unpubErr.message);
    }


    // 4. Optionally upload custom icon
    if (customIconBase64) {
      try {
        const mimeMatch = customIconBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        const fileName = `protection-icon.${extension}`;
        const base64Data = customIconBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const stagedResult = await shopifyGraphQL(shopDomain, token, `
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters { name value }
              }
              userErrors { field message }
            }
          }
        `, {
          input: [{
            filename: fileName,
            mimeType,
            resource: 'PRODUCT_IMAGE',
            httpMethod: 'POST',
          }],
        });

        const target = stagedResult?.data?.stagedUploadsCreate?.stagedTargets?.[0];
        if (target) {
          const formData = new FormData();
          for (const param of target.parameters) {
            formData.append(param.name, param.value);
          }
          formData.append('file', new Blob([buffer], { type: mimeType }), fileName);
          await fetch(target.url, { method: 'POST', body: formData });

          await shopifyGraphQL(shopDomain, token, `
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media { id }
                mediaUserErrors { field message }
              }
            }
          `, {
            productId: productGid,
            media: [{
              originalSource: target.resourceUrl,
              mediaContentType: 'IMAGE',
            }],
          });
        }
      } catch (uploadErr: any) {
        console.warn('[protection/create] Icon upload warning:', uploadErr.message);
      }
    }

    // 5. Save config to store DB
    const config = (store.config as any) ?? {};
    const addons = config.addons ?? {};

    const tierConfig = allVariants.map((v: any, idx: number) => {
      const tier = effectiveTiers[idx] ?? effectiveTiers[effectiveTiers.length - 1];
      const variantNumericId = parseInt(v.id.replace(/\D/g, ''), 10);
      return {
        vid: variantNumericId,
        price: tier.price,
        maxValue: tier.maxCartValue ?? null,
      };
    });

    addons.shippingProtection = {
      enabled: true,
      handle: product.handle,
      productId: productGid,
      iconId,
      pricingMode,
      defaultOn,
      description,
      title,
      tiers: tierConfig,
      createdAt: new Date().toISOString(),
    };

    config.addons = addons;
    await prisma.store.update({
      where: { id },
      data: { config },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: productGid,
        handle: product.handle,
        variants: allVariants.map((v: any) => ({
          id: v.id,
          numericId: parseInt(v.id.replace(/\D/g, ''), 10),
          title: v.title,
          price: v.price,
        })),
      },
    });
  } catch (err: any) {
    console.error('[protection/create] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
