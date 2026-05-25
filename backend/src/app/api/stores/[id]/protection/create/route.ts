import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PROTECTION_ICON_BASE64 } from '@/lib/protection-icon-default';

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
 *   1. Create Shopify product (type: Service, tags: _eliminai-cart-protection, _eliminai-hidden)
 *   2. Update default variant price + create additional variants for tiers 2+
 *   3. Keep product PUBLISHED (required for /cart/add.js) but HIDE from customers:
 *      - Tag: _eliminai-hidden (used by theme patch to exclude from recommendations)
 *      - Metafield: seo.hidden = 1 (noindex for search engines)
 *   3b. Patch theme product-recommendations.liquid to skip hidden products (all themes)
 *   4. Optionally upload icon via stagedUploadsCreate + productCreateMedia
 *   5. Save config to store DB under config.addons.shippingProtection (BOTH live + demo)
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
  // maxCartValue comes from editor in DOLLARS
  if (index === total - 1) {
    return `$${Math.round(maxCartValue ?? 0)}+`;
  }
  return `Up to $${Math.round(maxCartValue ?? 0)}`;
}

/**
 * Patches all themes' product-recommendations.liquid to exclude products
 * tagged with _eliminai-hidden. Idempotent — skips themes already patched.
 */
async function patchThemeRecommendations(shopDomain: string, token: string) {
  try {
    const themesRes = await fetch(`https://${shopDomain}/admin/api/2025-01/themes.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    });
    if (!themesRes.ok) return;
    const { themes } = await themesRes.json();

    const PATCH_LINE = `{%- if product.tags contains "_eliminai-hidden" -%}{%- continue -%}{%- endif -%}`;

    for (const theme of themes) {
      try {
        const assetRes = await fetch(
          `https://${shopDomain}/admin/api/2025-01/themes/${theme.id}/assets.json?asset[key]=sections/product-recommendations.liquid`,
          { headers: { 'X-Shopify-Access-Token': token } },
        );
        if (!assetRes.ok) continue;
        const { asset } = await assetRes.json();
        if (!asset?.value) continue;

        // Already patched?
        if (asset.value.includes('_eliminai-hidden')) continue;

        // Find the for loop over recommendations and inject our continue
        const patched = asset.value.replace(
          /(\{%-?\s*for\s+product\s+in\s+recommendations\.products\s*-?%\})/,
          `$1\n        ${PATCH_LINE}`,
        );

        if (patched === asset.value) continue; // no match found, skip

        await fetch(`https://${shopDomain}/admin/api/2025-01/themes/${theme.id}/assets.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ asset: { key: 'sections/product-recommendations.liquid', value: patched } }),
        });
        console.log(`[protection/create] Patched recommendations in theme ${theme.id} (${theme.name})`);
      } catch (themeErr: any) {
        console.warn(`[protection/create] Could not patch theme ${theme.id}:`, themeErr.message);
      }
    }
  } catch (err: any) {
    console.warn('[protection/create] Theme patch warning:', err.message);
  }
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

    const body = await req.json();
    const {
      title = 'Shipping Protection',
      iconId = 'shield-filled',
      customIconBase64,
      pricingMode = 'single',
      singlePrice = 4.99, // dollars (editor sends dollars)
      tiers = [],
      defaultOn = true,
      description = '',
    } = body;

    // Strip HTML entities from user input (e.g. &nbsp; from rich text editors)
    const cleanDescription = (description || '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    const shopDomain = store.shopDomain;
    const token = store.accessToken;

    // Build effective tiers list
    const effectiveTiers = pricingMode === 'single'
      ? [{ price: singlePrice, maxCartValue: null }]
      : tiers;

    if (effectiveTiers.length === 0) {
      return NextResponse.json({ error: 'At least one tier/price is required' }, { status: 400 });
    }

    // 1. Create Shopify product with hidden tags (published but invisible to customers)
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
        tags: ['_eliminai-cart-protection', '_eliminai-hidden'],
        descriptionHtml: cleanDescription || `<p>${title} — protects your order against loss, damage, and theft during shipping.</p>`,
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

    // Wait for Shopify to fully register the product+variant before updating
    await new Promise(r => setTimeout(r, 2000));

    // 2. Update default variant price via REST API (more reliable than GraphQL for newly-created products)
    const firstPriceDollars = Number(effectiveTiers[0].price).toFixed(2);
    console.log('[protection/create] PRICE DEBUG: singlePrice=', singlePrice, 'tierPrice=', effectiveTiers[0].price, 'dollars=', firstPriceDollars, 'pricingMode=', pricingMode);
    const firstTierTitle = buildTierTitle(effectiveTiers[0].maxCartValue, 0, effectiveTiers.length);

    // Extract numeric variant ID for REST API
    const variantNumericId = defaultVariantId.replace(/\D/g, '');
    const variantRestRes = await fetch(
      `https://${shopDomain}/admin/api/2025-01/variants/${variantNumericId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant: {
            id: Number(variantNumericId),
            price: firstPriceDollars,
            title: firstTierTitle,
            requires_shipping: false,
          },
        }),
      },
    );
    const variantRestData = await variantRestRes.json();
    console.log('[protection/create] REST variant update:', variantRestRes.status, 'price=', variantRestData?.variant?.price);

    const allVariants = variantRestData?.variant
      ? [{ id: defaultVariantId, title: variantRestData.variant.title, price: variantRestData.variant.price }]
      : [product.variants.nodes[0]];

    // 2b. Create additional variants for tiers 2+
    if (effectiveTiers.length > 1) {
      const additionalVariants = effectiveTiers.slice(1).map((tier: any, idx: number) => ({
        title: buildTierTitle(tier.maxCartValue, idx + 1, effectiveTiers.length),
        price: Number(tier.price).toFixed(2),
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

    // 3. Product stays PUBLISHED (required for /cart/add.js to work).
    // Hide from customers via: _eliminai-hidden tag + noindex metafield.
    // Theme patch (step 3b) ensures it's excluded from product recommendations.
    console.log('[protection/create] Product stays published (required for cart add). Hiding via tags + metafield.');

    // 3a. Set noindex metafield so search engines don't index it
    try {
      await shopifyGraphQL(shopDomain, token, `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors { field message }
          }
        }
      `, {
        input: {
          id: productGid,
          metafields: [{
            namespace: 'seo',
            key: 'hidden',
            value: '1',
            type: 'number_integer',
          }],
        },
      });
    } catch (metaErr: any) {
      console.warn('[protection/create] Metafield warning:', metaErr.message);
    }

    // 3b. Patch all themes to exclude _eliminai-hidden products from recommendations
    // Runs in background — don't block the API response
    patchThemeRecommendations(shopDomain, token).catch((err) => {
      console.warn('[protection/create] Background theme patch error:', err.message);
    });

    // 4. Upload icon image (custom from editor OR default embedded icon)
    const iconBase64 = customIconBase64 || DEFAULT_PROTECTION_ICON_BASE64;
    {
      try {
        const mimeMatch = iconBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        const fileName = `protection-icon.${extension}`;
        const base64Data = iconBase64.replace(/^data:image\/\w+;base64,/, '');
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

    // 5. Save config to store DB (BOTH live config AND demo config)
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

    const protectionData = {
      enabled: true,
      handle: product.handle,
      productId: productGid,
      tiers: tierConfig,
      createdAt: new Date().toISOString(),
      config: {
        tiers: tierConfig,
        variantId: tierConfig[0]?.vid,
        handle: product.handle,
        productId: productGid,
        iconId,
        pricingMode,
        defaultOn,
        description: cleanDescription,
        productName: title,
      },
    };

    addons.shippingProtection = {
      ...(addons.shippingProtection || {}),
      ...protectionData,
      config: {
        ...(addons.shippingProtection?.config || {}),
        ...protectionData.config,
      },
    };
    config.addons = addons;

    // Also update demoConfig so protection works on demo theme too
    const demoConfig = (store.demoConfig as any) ?? {};
    const demoAddons = demoConfig.addons ?? {};
    demoAddons.shippingProtection = {
      ...(demoAddons.shippingProtection || {}),
      ...protectionData,
      config: {
        ...(demoAddons.shippingProtection?.config || {}),
        ...protectionData.config,
      },
    };
    demoConfig.addons = demoAddons;

    await prisma.store.update({
      where: { id },
      data: { config, demoConfig },
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
