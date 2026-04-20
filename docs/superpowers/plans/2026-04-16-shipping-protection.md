# Shipping Protection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full shipping protection feature — auto-create Shopify product, tiered pricing, icon selection, dashboard config UI, and cart JS tier logic with silent swap.

**Architecture:** Backend API routes create/update a hidden Shopify product with variants per tier. Dashboard UI lets store owner configure pricing mode, tiers, and icons. Cart JS reads tier config from proxy and silently swaps variants as cart value changes.

**Tech Stack:** Next.js 15 (App Router), Prisma, Shopify Admin GraphQL API, React, vanilla JS (cart drawer extension)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `backend/src/lib/protection-icons.ts` | 5 built-in SVG icons + icon registry |
| Create | `backend/src/app/api/stores/[id]/protection/create/route.ts` | POST — create Shopify product + variants |
| Create | `backend/src/app/api/stores/[id]/protection/update/route.ts` | PUT — sync changes to Shopify product |
| Create | `backend/src/app/api/stores/[id]/protection/status/route.ts` | GET — check if protection product exists |
| Create | `backend/src/app/api/stores/[id]/upload/route.ts` | POST — upload custom icon to Shopify CDN |
| Create | `backend/src/app/dashboard/addons/protection-editor.tsx` | Dashboard UI: pricing, tiers, icons, create/sync |
| Modify | `backend/src/app/dashboard/addons/page.tsx` | Mount ProtectionEditor when shippingProtection selected |
| Modify | `backend/src/lib/addon-definitions.ts` | Update shippingProtection dimensions + ProtectionTier type |
| Modify | `extensions/cart-drawer/assets/v14-complete.js` | PROT_TIERS, getProtTier(), silent swap, icon from config |
| Modify | `tests/contract.test.js` | Contracts 30-37 for tier logic, silent swap, icon, API |

---

## Chunk 1: Backend Foundation

### Task 1: Protection Icon Registry

**Files:**
- Create: `backend/src/lib/protection-icons.ts`

- [ ] **Step 1: Create icon registry file**

```typescript
// backend/src/lib/protection-icons.ts

export interface ProtectionIcon {
  id: string;
  label: string;
  svg: string;
}

export const PROTECTION_ICONS: ProtectionIcon[] = [
  {
    id: 'box-shield',
    label: 'Box + Shield',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4c-1.1 0-2 .9-2 2v2h20V5c0-1.1-.9-2-2-2zM2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9H2v10zm8-8h4v2h-4v-2z"/><path d="M12 13l-2 2h1.5v3h1v-3H14l-2-2z" opacity=".6"/></svg>',
  },
  {
    id: 'shield-check',
    label: 'Shield Checkmark',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
  },
  {
    id: 'shield-lock',
    label: 'Shield Lock',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/><path d="M14.5 10h-1V9c0-.83-.67-1.5-1.5-1.5S10.5 8.17 10.5 9v1h-1c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5h5c.28 0 .5-.22.5-.5v-3c0-.28-.22-.5-.5-.5zm-1.5 0h-2V9c0-.55.45-1 1-1s1 .45 1 1v1z"/></svg>',
  },
  {
    id: 'umbrella',
    label: 'Umbrella',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12h2c0-2.15.84-4.17 2.34-5.66C7.84 4.84 9.85 4 12 4s4.16.84 5.66 2.34C19.16 7.83 20 9.85 20 12h2c0-5.52-4.48-10-10-10zm-1 14.5V20c0 1.1-.9 2-2 2s-2-.9-2-2h2v-3.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5z"/></svg>',
  },
  {
    id: 'hand-shield',
    label: 'Hand + Shield',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/><path d="M11 7v6l-3.16 1.89.75 1.26L12 14V7h-1z" fill="white"/></svg>',
  },
];

export function getProtectionIconSvg(iconId: string): string | null {
  const icon = PROTECTION_ICONS.find(i => i.id === iconId);
  return icon?.svg ?? null;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit src/lib/protection-icons.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/lib/protection-icons.ts
git commit -m "feat(protection): add built-in icon registry with 5 SVG icons"
```

---

### Task 2: Protection Create API Route

**Files:**
- Create: `backend/src/app/api/stores/[id]/protection/create/route.ts`

- [ ] **Step 1: Write the create route**

This route creates a Shopify product (service type, non-physical, unpublished from Online Store), creates variants for tiers, uploads icon image, and saves config to store DB.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProtectionIconSvg } from '@/lib/protection-icons';

interface TierInput {
  price: number;       // in cents
  maxCartValue: number | null; // in cents, null = unlimited
}

interface CreateInput {
  title: string;
  iconId: string;
  customIconBase64?: string | null;
  pricingMode: 'single' | 'tiered';
  singlePrice?: number | null;  // cents
  tiers?: TierInput[];
  defaultOn: boolean;
  description?: string;
}

async function shopifyGQL(domain: string, token: string, query: string, variables?: any) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true, config: true },
  });
  if (!store?.accessToken) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body: CreateInput = await req.json();
  const { title, iconId, customIconBase64, pricingMode, singlePrice, tiers, defaultOn, description } = body;

  // Build tiers array
  let tierList: TierInput[] = [];
  if (pricingMode === 'tiered' && tiers && tiers.length > 0) {
    tierList = [...tiers].sort((a, b) => {
      if (a.maxCartValue === null) return 1;
      if (b.maxCartValue === null) return -1;
      return a.maxCartValue - b.maxCartValue;
    });
  } else {
    tierList = [{ price: singlePrice || 499, maxCartValue: null }];
  }

  try {
    // 1. Create product with first variant
    const firstTierPrice = (tierList[0].price / 100).toFixed(2);
    const firstTierTitle = tierList.length > 1
      ? (tierList[0].maxCartValue !== null ? `Up to $${(tierList[0].maxCartValue / 100).toFixed(0)}` : 'All carts')
      : 'Default';

    const createResult = await shopifyGQL(store.shopDomain, store.accessToken, `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            handle
            variants(first: 1) {
              edges { node { id title price } }
            }
          }
          userErrors { field message }
        }
      }
    `, {
      input: {
        title: title || 'Shipping Protection',
        productType: 'Service',
        status: 'ACTIVE',
        tags: ['_eliminai-cart-protection'],
        variants: [{
          price: firstTierPrice,
          title: firstTierTitle,
          requiresShipping: false,
          taxable: false,
          inventoryManagement: null,
        }],
      },
    });

    const product = createResult?.data?.productCreate?.product;
    const errors = createResult?.data?.productCreate?.userErrors;
    if (!product || (errors && errors.length > 0)) {
      return NextResponse.json({ error: 'Failed to create product', details: errors }, { status: 400 });
    }

    const productId = product.id;
    const productHandle = product.handle;
    const firstVariantId = product.variants.edges[0]?.node?.id;

    // 2. Create additional variants for tiers 2+
    const variantIds: { gid: string; price: number; maxCartValue: number | null }[] = [
      { gid: firstVariantId, price: tierList[0].price, maxCartValue: tierList[0].maxCartValue },
    ];

    if (tierList.length > 1) {
      const additionalVariants = tierList.slice(1).map(t => ({
        productId,
        price: (t.price / 100).toFixed(2),
        title: t.maxCartValue !== null ? `Up to $${(t.maxCartValue / 100).toFixed(0)}` : `$${((tierList[tierList.length - 2]?.maxCartValue || 0) / 100).toFixed(0)}+`,
        requiresShipping: false,
        taxable: false,
        inventoryManagement: null,
      }));

      const bulkResult = await shopifyGQL(store.shopDomain, store.accessToken, `
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            productVariants { id title price }
            userErrors { field message }
          }
        }
      `, { productId, variants: additionalVariants });

      const newVariants = bulkResult?.data?.productVariantsBulkCreate?.productVariants || [];
      for (let i = 0; i < newVariants.length; i++) {
        variantIds.push({
          gid: newVariants[i].id,
          price: tierList[i + 1].price,
          maxCartValue: tierList[i + 1].maxCartValue,
        });
      }
    }

    // 3. Unpublish from Online Store
    try {
      // Get Online Store publication ID
      const pubResult = await shopifyGQL(store.shopDomain, store.accessToken, `{
        publications(first: 10) {
          edges { node { id name } }
        }
      }`);
      const onlineStorePub = pubResult?.data?.publications?.edges?.find(
        (e: any) => e.node.name === 'Online Store'
      );
      if (onlineStorePub) {
        await shopifyGQL(store.shopDomain, store.accessToken, `
          mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
            publishableUnpublish(id: $id, input: $input) {
              userErrors { field message }
            }
          }
        `, { id: productId, input: [{ publicationId: onlineStorePub.node.id }] });
      }
    } catch (e) {
      console.warn('[protection/create] Failed to unpublish:', e);
    }

    // 4. Upload icon image
    let iconUrl: string | null = null;
    if (customIconBase64) {
      // Custom icon upload via stagedUploads
      try {
        iconUrl = await uploadIconToProduct(store.shopDomain, store.accessToken, productId, customIconBase64);
      } catch (e) {
        console.warn('[protection/create] Icon upload failed:', e);
      }
    }
    // For built-in icons, we use inline SVG in the cart JS — no Shopify image needed

    // 5. Save to store config
    const config = (store.config as any) || {};
    const addons = config.addons || {};
    const protTiers = variantIds.map(v => ({
      vid: parseInt(v.gid.replace('gid://shopify/ProductVariant/', ''), 10),
      price: v.price,
      maxValue: v.maxCartValue,
    }));

    addons.shippingProtection = {
      ...addons.shippingProtection,
      enabled: true,
      config: {
        ...(addons.shippingProtection?.config || {}),
        productId,
        handle: productHandle,
        iconId,
        iconUrl: iconUrl || addons.shippingProtection?.config?.iconUrl || null,
        defaultOn,
        description: description || 'Covers lost, stolen, or damaged packages',
        pricingMode,
        price: tierList[0].price,
        variantId: protTiers[0]?.vid || 0,
        tiers: protTiers,
      },
    };

    await prisma.store.update({
      where: { id },
      data: { config: { ...config, addons } },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: productId,
        handle: productHandle,
        variants: protTiers,
      },
    });
  } catch (e: any) {
    console.error('[protection/create] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function uploadIconToProduct(domain: string, token: string, productId: string, base64Data: string): Promise<string> {
  // Determine mime type
  const isPng = base64Data.startsWith('data:image/png') || !base64Data.startsWith('data:image/svg');
  const mimeType = isPng ? 'image/png' : 'image/svg+xml';
  const filename = isPng ? 'protection-icon.png' : 'protection-icon.svg';

  // Strip data URI prefix if present
  const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(rawBase64, 'base64');

  // Step 1: Create staged upload
  const stageResult = await shopifyGQL(domain, token, `
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
      filename,
      mimeType,
      resource: 'PRODUCT_IMAGE',
      fileSize: String(buffer.length),
      httpMethod: 'POST',
    }],
  });

  const target = stageResult?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) throw new Error('Staged upload failed');

  // Step 2: Upload to staged URL
  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);

  const uploadRes = await fetch(target.url, { method: 'POST', body: formData });
  if (!uploadRes.ok && uploadRes.status !== 201) {
    throw new Error(`Upload failed: ${uploadRes.status}`);
  }

  // Step 3: Attach to product
  await shopifyGQL(domain, token, `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id }
        mediaUserErrors { field message }
      }
    }
  `, {
    productId,
    media: [{
      originalSource: target.resourceUrl,
      mediaContentType: 'IMAGE',
      alt: 'Shipping Protection',
    }],
  });

  return target.resourceUrl;
}
```

- [ ] **Step 2: Verify route compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/app/api/stores/\[id\]/protection/create/route.ts
git commit -m "feat(protection): add create API route — Shopify product + variants + unpublish"
```

---

### Task 3: Protection Update API Route

**Files:**
- Create: `backend/src/app/api/stores/[id]/protection/update/route.ts`

- [ ] **Step 1: Write the update route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TierInput {
  price: number;
  maxCartValue: number | null;
}

async function shopifyGQL(domain: string, token: string, query: string, variables?: any) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true, config: true },
  });
  if (!store?.accessToken) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body = await req.json();
  const { title, iconId, customIconBase64, pricingMode, singlePrice, tiers, defaultOn, description } = body;

  const config = (store.config as any) || {};
  const protConfig = config.addons?.shippingProtection?.config;
  if (!protConfig?.productId) {
    return NextResponse.json({ error: 'No protection product exists. Create one first.' }, { status: 400 });
  }

  const productId = protConfig.productId;

  // Build new tier list
  let newTiers: TierInput[] = [];
  if (pricingMode === 'tiered' && tiers && tiers.length > 0) {
    newTiers = [...tiers].sort((a, b) => {
      if (a.maxCartValue === null) return 1;
      if (b.maxCartValue === null) return -1;
      return a.maxCartValue - b.maxCartValue;
    });
  } else {
    newTiers = [{ price: singlePrice || 499, maxCartValue: null }];
  }

  try {
    // 1. Update product title if changed
    if (title && title !== protConfig.title) {
      await shopifyGQL(store.shopDomain, store.accessToken, `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id title }
            userErrors { field message }
          }
        }
      `, { input: { id: productId, title } });
    }

    // 2. Get existing variants
    const varResult = await shopifyGQL(store.shopDomain, store.accessToken, `{
      product(id: "${productId}") {
        variants(first: 20) {
          edges { node { id title price } }
        }
      }
    }`);
    const existingVariants = varResult?.data?.product?.variants?.edges?.map((e: any) => e.node) || [];

    // 3. Determine variant changes
    const existingCount = existingVariants.length;
    const newCount = newTiers.length;

    // Update existing variants (price + title)
    const toUpdate = Math.min(existingCount, newCount);
    if (toUpdate > 0) {
      const updateVariants = [];
      for (let i = 0; i < toUpdate; i++) {
        const tierTitle = newTiers.length > 1
          ? (newTiers[i].maxCartValue !== null
            ? `Up to $${(newTiers[i].maxCartValue! / 100).toFixed(0)}`
            : `$${((newTiers[i - 1]?.maxCartValue || 0) / 100).toFixed(0)}+`)
          : 'Default';
        updateVariants.push({
          id: existingVariants[i].id,
          price: (newTiers[i].price / 100).toFixed(2),
          title: tierTitle,
        });
      }
      await shopifyGQL(store.shopDomain, store.accessToken, `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id title price }
            userErrors { field message }
          }
        }
      `, { productId, variants: updateVariants });
    }

    // Add new variants if needed
    let addedVariants: any[] = [];
    if (newCount > existingCount) {
      const toAdd = newTiers.slice(existingCount).map((t, idx) => ({
        productId,
        price: (t.price / 100).toFixed(2),
        title: t.maxCartValue !== null
          ? `Up to $${(t.maxCartValue / 100).toFixed(0)}`
          : `$${((newTiers[existingCount + idx - 1]?.maxCartValue || 0) / 100).toFixed(0)}+`,
        requiresShipping: false,
        taxable: false,
        inventoryManagement: null,
      }));
      const addResult = await shopifyGQL(store.shopDomain, store.accessToken, `
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            productVariants { id title price }
            userErrors { field message }
          }
        }
      `, { productId, variants: toAdd });
      addedVariants = addResult?.data?.productVariantsBulkCreate?.productVariants || [];
    }

    // Delete extra variants if tiers reduced
    if (existingCount > newCount) {
      const toDelete = existingVariants.slice(newCount).map((v: any) => v.id);
      await shopifyGQL(store.shopDomain, store.accessToken, `
        mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
          productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
            product { id }
            userErrors { field message }
          }
        }
      `, { productId, variantsIds: toDelete });
    }

    // 4. Build final variant list
    const finalVariants = [
      ...existingVariants.slice(0, toUpdate),
      ...addedVariants,
    ];
    const protTiers = newTiers.map((t, i) => ({
      vid: parseInt((finalVariants[i]?.id || '0').replace('gid://shopify/ProductVariant/', ''), 10),
      price: t.price,
      maxValue: t.maxCartValue,
    }));

    // 5. Update store config
    const addons = config.addons || {};
    addons.shippingProtection = {
      ...addons.shippingProtection,
      config: {
        ...protConfig,
        iconId: iconId || protConfig.iconId,
        defaultOn: defaultOn !== undefined ? defaultOn : protConfig.defaultOn,
        description: description || protConfig.description,
        pricingMode,
        price: newTiers[0].price,
        variantId: protTiers[0]?.vid || 0,
        tiers: protTiers,
      },
    };

    await prisma.store.update({
      where: { id },
      data: { config: { ...config, addons } },
    });

    return NextResponse.json({ success: true, tiers: protTiers });
  } catch (e: any) {
    console.error('[protection/update] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/app/api/stores/\[id\]/protection/update/route.ts
git commit -m "feat(protection): add update API route — sync tiers/title/icon to Shopify"
```

---

### Task 4: Protection Status API Route

**Files:**
- Create: `backend/src/app/api/stores/[id]/protection/status/route.ts`

- [ ] **Step 1: Write the status route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function shopifyGQL(domain: string, token: string, query: string) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}`);
  return res.json();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true, config: true },
  });
  if (!store?.accessToken) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const config = (store.config as any) || {};
  const protConfig = config.addons?.shippingProtection?.config;

  if (!protConfig?.productId) {
    return NextResponse.json({ exists: false });
  }

  // Verify product still exists on Shopify
  try {
    const result = await shopifyGQL(store.shopDomain, store.accessToken, `{
      product(id: "${protConfig.productId}") {
        id
        handle
        status
        variants(first: 20) {
          edges { node { id title price } }
        }
      }
    }`);

    const product = result?.data?.product;
    if (!product) {
      return NextResponse.json({
        exists: false,
        warning: 'Product was deleted from Shopify',
      });
    }

    return NextResponse.json({
      exists: true,
      productId: product.id,
      handle: product.handle,
      status: product.status,
      variants: product.variants.edges.map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        price: e.node.price,
      })),
      config: protConfig,
    });
  } catch (e: any) {
    return NextResponse.json({
      exists: false,
      warning: 'Could not verify product on Shopify',
      error: e.message,
    });
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/app/api/stores/\[id\]/protection/status/route.ts
git commit -m "feat(protection): add status API route — verify Shopify product exists"
```

---

### Task 5: Custom Icon Upload Route

**Files:**
- Create: `backend/src/app/api/stores/[id]/upload/route.ts`

- [ ] **Step 1: Write the upload route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    select: { shopDomain: true, accessToken: true },
  });
  if (!store?.accessToken) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
  }

  const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `protection-icon-${Date.now()}.${file.type.split('/')[1]}`;

    // Staged upload to Shopify
    const stageRes = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets { url resourceUrl parameters { name value } }
            userErrors { field message }
          }
        }`,
        variables: {
          input: [{
            filename,
            mimeType: file.type,
            resource: 'FILE',
            fileSize: String(buffer.length),
            httpMethod: 'POST',
          }],
        },
      }),
    });

    const stageData = await stageRes.json();
    const target = stageData?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      return NextResponse.json({ error: 'Staged upload failed' }, { status: 500 });
    }

    // Upload to staged URL
    const uploadForm = new FormData();
    for (const p of target.parameters) {
      uploadForm.append(p.name, p.value);
    }
    uploadForm.append('file', new Blob([buffer], { type: file.type }), filename);

    const uploadRes = await fetch(target.url, { method: 'POST', body: uploadForm });
    if (!uploadRes.ok && uploadRes.status !== 201) {
      return NextResponse.json({ error: 'Upload to CDN failed' }, { status: 500 });
    }

    return NextResponse.json({ url: target.resourceUrl });
  } catch (e: any) {
    console.error('[upload] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/app/api/stores/\[id\]/upload/route.ts
git commit -m "feat(protection): add custom icon upload route via Shopify staged uploads"
```

---

## Chunk 2: Dashboard UI

### Task 6: Protection Editor Component

**Files:**
- Create: `backend/src/app/dashboard/addons/protection-editor.tsx`
- Modify: `backend/src/app/dashboard/addons/page.tsx`
- Modify: `backend/src/lib/addon-definitions.ts`

- [ ] **Step 1: Add ProtectionTier type to addon-definitions.ts**

Add after the `RewardTier` interface:

```typescript
export interface ProtectionTier {
  vid: number;
  price: number;     // cents
  maxValue: number | null; // cents, null = unlimited
}
```

- [ ] **Step 2: Create protection-editor.tsx**

Full component with:
- Icon selector (5 built-in + custom upload, click-to-toggle cards)
- Pricing mode toggle (single vs tiered)
- Tiered pricing editor (add/remove tiers, max 10, auto-sort)
- Product name input
- Default on toggle
- "Create Protection Product" / "Sync to Shopify" button
- Confirmation modal (same design as gift discount)
- Green status dot when product exists
- Description text input

```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PROTECTION_ICONS } from '@/lib/protection-icons';

interface ProtectionTierLocal {
  price: string; // display string for input
  maxCartValue: string; // display string for input
}

interface ProtectionEditorProps {
  storeId: string;
  config: any;
  onConfigChange: (patch: Record<string, any>) => void;
}

export function ProtectionEditor({ storeId, config, onConfigChange }: ProtectionEditorProps) {
  const [productName, setProductName] = useState(config?.title || 'Shipping Protection');
  const [iconId, setIconId] = useState(config?.iconId || 'box-shield');
  const [customIconUrl, setCustomIconUrl] = useState(config?.iconUrl || '');
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(config?.pricingMode || 'single');
  const [singlePrice, setSinglePrice] = useState(config?.price ? (config.price / 100).toFixed(2) : '4.99');
  const [defaultOn, setDefaultOn] = useState(config?.defaultOn !== false);
  const [description, setDescription] = useState(config?.description || 'Covers lost, stolen, or damaged packages');
  const [tiers, setTiers] = useState<ProtectionTierLocal[]>(() => {
    if (config?.tiers && config.tiers.length > 1) {
      return config.tiers.map((t: any) => ({
        price: (t.price / 100).toFixed(2),
        maxCartValue: t.maxValue !== null ? (t.maxValue / 100).toFixed(0) : '',
      }));
    }
    return [
      { price: '1.99', maxCartValue: '50' },
      { price: '3.99', maxCartValue: '100' },
      { price: '5.99', maxCartValue: '' },
    ];
  });
  const [productExists, setProductExists] = useState(!!config?.productId);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Check product status on mount
  useEffect(() => {
    fetch(`/api/stores/${storeId}/protection/status`)
      .then(r => r.json())
      .then(data => setProductExists(data.exists))
      .catch(() => {});
  }, [storeId]);

  const handleAddTier = () => {
    if (tiers.length >= 10) return;
    const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].maxCartValue : '';
    // Insert before the final (unlimited) tier
    const newTier = { price: '2.99', maxCartValue: String(parseInt(lastMax || '100') + 50) };
    const updated = [...tiers];
    updated.splice(tiers.length - 1, 0, newTier);
    setTiers(updated);
    setIsDirty(true);
  };

  const handleRemoveTier = (idx: number) => {
    if (tiers.length <= 1) return;
    // Don't remove the last tier (unlimited)
    if (idx === tiers.length - 1) return;
    const updated = tiers.filter((_, i) => i !== idx);
    setTiers(updated);
    setIsDirty(true);
  };

  const handleTierChange = (idx: number, field: 'price' | 'maxCartValue', value: string) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setTiers(updated);
    setIsDirty(true);
  };

  const buildPayload = () => {
    const tierData = pricingMode === 'tiered'
      ? tiers.map((t, i) => ({
          price: Math.round(parseFloat(t.price || '0') * 100),
          maxCartValue: i === tiers.length - 1 ? null : Math.round(parseFloat(t.maxCartValue || '0') * 100),
        }))
      : undefined;

    return {
      title: productName,
      iconId,
      customIconBase64: null,
      pricingMode,
      singlePrice: pricingMode === 'single' ? Math.round(parseFloat(singlePrice) * 100) : null,
      tiers: tierData,
      defaultOn,
      description,
    };
  };

  const handleCreate = async () => {
    setShowConfirm(false);
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/stores/${storeId}/protection/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setProductExists(true);
      setIsDirty(false);
      onConfigChange({
        productId: data.product.id,
        handle: data.product.handle,
        tiers: data.product.variants,
        iconId,
        defaultOn,
        description,
        pricingMode,
        price: pricingMode === 'single' ? Math.round(parseFloat(singlePrice) * 100) : data.product.variants[0]?.price,
        variantId: data.product.variants[0]?.vid,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch(`/api/stores/${storeId}/protection/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setIsDirty(false);
      onConfigChange({
        tiers: data.tiers,
        iconId,
        defaultOn,
        description,
        pricingMode,
        price: pricingMode === 'single' ? Math.round(parseFloat(singlePrice) * 100) : data.tiers[0]?.price,
        variantId: data.tiers[0]?.vid,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large (max 2MB)');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/stores/${storeId}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomIconUrl(data.url);
      setIconId('custom');
      setIsDirty(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const priceSummary = pricingMode === 'single'
    ? `$${singlePrice}`
    : tiers.map((t, i) => `$${t.price}${i < tiers.length - 1 ? ` up to $${t.maxCartValue}` : '+'}`).join(', ');

  // Styles
  const cardStyle = (selected: boolean): React.CSSProperties => ({
    width: 52, height: 52, borderRadius: 8, border: `2px solid ${selected ? '#7c3aed' : '#e5e7eb'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: selected ? '#f5f3ff' : '#fff',
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status */}
      {productExists && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Active on Shopify
        </div>
      )}

      {/* Product Name */}
      <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
        Product Name
        <input
          type="text"
          value={productName}
          onChange={e => { setProductName(e.target.value); setIsDirty(true); }}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
        />
      </label>

      {/* Description */}
      <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
        Description
        <input
          type="text"
          value={description}
          onChange={e => { setDescription(e.target.value); setIsDirty(true); }}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          placeholder="Covers lost, stolen, or damaged packages"
        />
      </label>

      {/* Icon Selector */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Icon</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROTECTION_ICONS.map(icon => (
            <div
              key={icon.id}
              onClick={() => { setIconId(icon.id); setIsDirty(true); }}
              style={cardStyle(iconId === icon.id)}
              title={icon.label}
            >
              <div style={{ width: 24, height: 24, color: iconId === icon.id ? '#7c3aed' : '#6b7280' }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
            </div>
          ))}
          {/* Custom upload card */}
          <label style={{ ...cardStyle(iconId === 'custom'), position: 'relative' }} title="Upload Custom">
            {customIconUrl ? (
              <img src={customIconUrl} alt="Custom" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 18, color: '#9ca3af' }}>+</span>
            )}
            <input
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              onChange={handleCustomUpload}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>
        {uploading && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Uploading...</div>}
      </div>

      {/* Pricing Mode */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Pricing</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['single', 'tiered'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setPricingMode(mode); setIsDirty(true); }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${pricingMode === mode ? '#7c3aed' : '#d1d5db'}`,
                background: pricingMode === mode ? '#f5f3ff' : '#fff',
                color: pricingMode === mode ? '#7c3aed' : '#6b7280',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {mode === 'single' ? 'Single Price' : 'Tiered'}
            </button>
          ))}
        </div>
      </div>

      {/* Single Price */}
      {pricingMode === 'single' && (
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
          Price ($)
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="99.99"
            value={singlePrice}
            onChange={e => { setSinglePrice(e.target.value); setIsDirty(true); }}
            style={{ display: 'block', width: 120, marginTop: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          />
        </label>
      )}

      {/* Tiered Pricing */}
      {pricingMode === 'tiered' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Tiers (max 10):</div>
          {tiers.map((tier, idx) => {
            const isLast = idx === tiers.length - 1;
            const prevMax = idx > 0 ? tiers[idx - 1].maxCartValue : '0';
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafafa',
              }}>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 48, flexShrink: 0 }}>Tier {idx + 1}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tier.price}
                  onChange={e => handleTierChange(idx, 'price', e.target.value)}
                  style={{ width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                />
                {isLast ? (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>for carts above ${prevMax}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>for carts up to $</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tier.maxCartValue}
                      onChange={e => handleTierChange(idx, 'maxCartValue', e.target.value)}
                      style={{ width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                    />
                  </>
                )}
                {!isLast && tiers.length > 1 && (
                  <button
                    onClick={() => handleRemoveTier(idx)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '2px 6px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {tiers.length < 10 && (
            <button
              onClick={handleAddTier}
              style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
            >
              + Add Tier
            </button>
          )}
        </div>
      )}

      {/* Default On */}
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}
        onClick={() => { setDefaultOn(!defaultOn); setIsDirty(true); }}
      >
        <div style={{
          width: 36, height: 20, borderRadius: 10, background: defaultOn ? '#7c3aed' : '#d1d5db',
          position: 'relative', transition: 'background 0.2s',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2,
            left: defaultOn ? 18 : 2, transition: 'left 0.2s',
          }} />
        </div>
        Enabled by default (pre-checked when cart opens)
      </label>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* Action Buttons */}
      {!productExists ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={creating}
          style={{
            padding: '10px 20px', borderRadius: 8, background: '#7c3aed', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 13, cursor: creating ? 'wait' : 'pointer',
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? 'Creating...' : 'Create Protection Product'}
        </button>
      ) : isDirty ? (
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '10px 20px', borderRadius: 8, background: '#7c3aed', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 13, cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? 'Syncing...' : 'Sync to Shopify'}
        </button>
      ) : null}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#1f2937', borderRadius: 12, padding: '24px 28px', maxWidth: 420, width: '90%',
            color: '#e5e7eb', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#fff' }}>Create Shipping Protection Product</h3>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#9ca3af', margin: '0 0 8px' }}>
              We'll create a hidden product in your Shopify store:
            </p>
            <ul style={{ fontSize: 12, color: '#d1d5db', margin: '0 0 16px', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Name: "{productName}"</li>
              <li>Price: {priceSummary}</li>
              <li>Not visible to customers browsing</li>
              <li>Used only inside the cart drawer</li>
            </ul>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>
              This product will appear in your Shopify admin under Products but won't show on your online store.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #4b5563', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount ProtectionEditor in page.tsx**

In `backend/src/app/dashboard/addons/page.tsx`, find where the addon config panel renders for the selected addon. Add a conditional that renders `<ProtectionEditor>` when the selected addon is `shippingProtection` — similar to how `<RewardsTierEditorWithSave>` renders for `freeShippingBar`.

Import at the top:
```typescript
import { ProtectionEditor } from './protection-editor';
```

Add in the addon detail panel area (where RewardsTierEditorWithSave is conditionally rendered):
```tsx
{selectedAddon === 'shippingProtection' && (
  <ProtectionEditor
    storeId={storeId}
    config={currentConfig}
    onConfigChange={(patch) => {
      // merge patch into config and save
      handleConfigChange({ ...currentConfig, ...patch });
    }}
  />
)}
```

- [ ] **Step 4: Verify compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/app/dashboard/addons/protection-editor.tsx backend/src/app/dashboard/addons/page.tsx
git commit -m "feat(protection): add dashboard UI — icon selector, tier editor, confirmation modal"
```

---

## Chunk 3: Cart JS Changes

### Task 7: Cart JS — PROT_TIERS + getProtTier() + Silent Swap

**Files:**
- Modify: `extensions/cart-drawer/assets/v14-complete.js`

- [ ] **Step 1: Add PROT_TIERS and getProtTier() function**

Near the top of the IIFE (after `var PROT_VID = ...` at ~line 59), replace/add:

```javascript
// OLD:
var PROT_VID = parseInt(_sp.variantId || CFG.protectionVariantId) || 0;

// NEW:
var PROT_TIERS = _sp.tiers || [];
var PROT_VID_SINGLE = parseInt(_sp.variantId || CFG.protectionVariantId) || 0;
if (PROT_TIERS.length === 0 && PROT_VID_SINGLE) {
  PROT_TIERS = [{ vid: PROT_VID_SINGLE, price: parseInt(_sp.price || CFG.protectionPrice) || 499, maxValue: null }];
}
// Backwards compat alias — used by guards that just check "is protection configured?"
var PROT_VID = PROT_TIERS.length > 0 ? PROT_TIERS[0].vid : 0;
```

Add `getProtTier` function right after (before the `protectionDone` variable):

```javascript
function getProtTier(cartValueCents) {
  for (var i = 0; i < PROT_TIERS.length; i++) {
    if (PROT_TIERS[i].maxValue === null || cartValueCents <= PROT_TIERS[i].maxValue) {
      return PROT_TIERS[i];
    }
  }
  return PROT_TIERS[PROT_TIERS.length - 1] || null;
}
```

- [ ] **Step 2: Replace all PROT_VID usages with getProtTier() calls**

Per the migration table in the spec (Section 8), update each location:

1. Toggle-on add (~L927): `id: PROT_VID` → `id: getProtTier(CCD.getAdjustedTotal(cart)).vid`
2. ensureProtection (~L984): `id: PROT_VID` → `id: getProtTier(CCD.getAdjustedTotal(cart)).vid`
3. Interceptor JSON (~L1024): `it.id === PROT_VID` → keep for detection (any tier VID), add: `id: getProtTier(CCD.getAdjustedTotal(cart)).vid` for piggyback add
4. Interceptor form (~L1050): `id: PROT_VID` → `id: getProtTier(0).vid` (cheapest, swap corrects later)
5. Response handler add (~L1129-1134): `PROT_VID` → `getProtTier(CCD.getAdjustedTotal(cart)).vid`
6. Response handler qty>1 fix (~L1148): `PROT_VID` → `protItem.variant_id` (already in cart)
7. Cart-open inline (~L2136-2144): `PROT_VID` → `getProtTier(CCD.getAdjustedTotal(cart)).vid`

For PROT_VID detection checks (e.g., `it.id === PROT_VID`), replace with handle-based detection which already exists: `i.handle === PROT`.

- [ ] **Step 3: Add silent tier swap logic**

In both `refresh()` and `refreshLight()`, after fetching cart and before rendering, add:

```javascript
// Silent tier swap — check if protection is on correct tier
var protItem = cart.items.find(function(i) { return i.handle === PROT; });
if (protItem && PROT_TIERS.length > 1) {
  var cartValExProt = CCD.getAdjustedTotal(cart);
  var correctTier = getProtTier(cartValExProt);
  if (correctTier && protItem.variant_id !== correctTier.vid) {
    await _origFetch('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) });
    await _origFetch('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTier.vid, quantity: 1 }] }) });
    var _swapRes = await _origFetch('/cart.js');
    cart = await _swapRes.json();
  }
}
```

- [ ] **Step 4: Add icon from config**

In the toggle render section, replace the hardcoded SVG with:

```javascript
var protIconHtml = _sp.iconUrl
  ? '<img src="' + _sp.iconUrl + '" style="width:20px;height:20px" alt="" />'
  : '<svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>';
```

- [ ] **Step 5: Add dynamic price display**

In the toggle price element, replace static price with:

```javascript
var currentTier = getProtTier(CCD.getAdjustedTotal(cart));
var displayPrice = currentTier ? (currentTier.price / 100).toFixed(2) : '0.00';
// Update price text element
var _protPriceEl = document.querySelector('[data-prot-price]');
if (_protPriceEl) _protPriceEl.textContent = '$' + displayPrice;
```

- [ ] **Step 6: Verify no raw PROT_VID remains (except PROT_VID_SINGLE definition and guard alias)**

Run: `grep -n "PROT_VID" extensions/cart-drawer/assets/v14-complete.js`

Expected: Only 3 occurrences — the `PROT_VID_SINGLE` definition, the `PROT_TIERS` fallback build, and the `PROT_VID` alias for guards.

- [ ] **Step 7: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add extensions/cart-drawer/assets/v14-complete.js
git commit -m "feat(protection): add tiered pricing — getProtTier(), silent swap, dynamic price, icon from config"
```

---

## Chunk 4: Contract Tests

### Task 8: Add Contract Tests 30-37

**Files:**
- Modify: `tests/contract.test.js`

- [ ] **Step 1: Add 8 new contract tests at the end of the file**

```javascript
// ═══════ SHIPPING PROTECTION — TIERED PRICING ═══════

test('Contract 30: getProtTier function exists and iterates tiers', function () {
  assert(src.includes('function getProtTier'), 'Missing getProtTier function');
  assert(src.includes('PROT_TIERS[i].maxValue'), 'getProtTier must check maxValue');
  assert(src.includes('cartValueCents'), 'getProtTier must accept cartValueCents parameter');
});

test('Contract 31: Tier lookup returns correct variant by comparing cart value', function () {
  assert(src.includes('cartValueCents <= PROT_TIERS[i].maxValue'), 'Must compare cartValue to tier maxValue');
  assert(src.includes('PROT_TIERS[PROT_TIERS.length - 1]'), 'Must fallback to last tier');
});

test('Contract 32: Silent tier swap when variant changes', function () {
  assert(src.includes('protItem.variant_id !== correctTier.vid'), 'Must detect wrong tier by comparing variant_id to correctTier.vid');
  assert(src.includes('cart/change.js') && src.includes('cart/add.js'), 'Must remove old + add correct tier variant');
});

test('Contract 33: Single-tier fallback builds PROT_TIERS from PROT_VID_SINGLE', function () {
  assert(src.includes('PROT_VID_SINGLE'), 'Must define PROT_VID_SINGLE for backwards compat');
  assert(src.includes('PROT_TIERS.length === 0 && PROT_VID_SINGLE'), 'Must build PROT_TIERS from single VID when no tiers configured');
});

test('Contract 34: Toggle price reads from current tier', function () {
  assert(src.includes('getProtTier(') && src.includes('displayPrice'), 'Must calculate displayPrice from current tier');
  assert(src.includes('data-prot-price'), 'Must have data-prot-price element for dynamic price');
});

test('Contract 35: Icon URL from config supported', function () {
  assert(src.includes('_sp.iconUrl'), 'Must read iconUrl from shipping protection config');
  assert(src.includes('protIconHtml') || src.includes('iconUrl'), 'Must support custom icon image');
});

test('Contract 36: Protection product API creates non-physical product', function () {
  const routeFile = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'protection', 'create', 'route.ts'), 'utf8');
  assert(routeFile.includes('requiresShipping: false'), 'Create route must set requiresShipping: false');
  assert(routeFile.includes('Service') || routeFile.includes('service'), 'Must set product type to Service');
  assert(routeFile.includes('_eliminai-cart-protection'), 'Must tag product with _eliminai-cart-protection');
});

test('Contract 37: Protection product API unpublishes from Online Store', function () {
  const routeFile = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'protection', 'create', 'route.ts'), 'utf8');
  assert(routeFile.includes('publishableUnpublish'), 'Create route must call publishableUnpublish');
  assert(routeFile.includes('Online Store'), 'Must find Online Store publication');
});
```

- [ ] **Step 2: Update existing contracts per Section 10 migration**

Update Contract 8 (PROT_VID everywhere) to check for getProtTier instead:
```javascript
// Replace existing Contract 8 assertion:
assert((src.match(/getProtTier\(/g) || []).length >= 3, 'getProtTier must be called 3+ times');
```

Update Contract 12 (PROT_VID constant) to check both PROT_VID_SINGLE and PROT_TIERS:
```javascript
assert(src.includes('PROT_VID_SINGLE') && src.includes('PROT_TIERS'), 'Must have PROT_VID_SINGLE and PROT_TIERS');
```

- [ ] **Step 3: Run contract tests**

Run: `cd C:/Projects/eliminai-cart-drawer && node tests/contract.test.js`
Expected: All new tests (30-37) pass. Pre-existing failures remain unchanged.

- [ ] **Step 4: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add tests/contract.test.js
git commit -m "test(protection): add contracts 30-37 — tier logic, silent swap, icon, API structure"
```

---

## Chunk 5: Integration & Config Wiring

### Task 9: Wire Protection Config to Proxy Response

**Files:**
- Modify: `backend/src/app/api/proxy/config/route.ts` (review only — config already passes through `cartConfig`)

- [ ] **Step 1: Verify proxy config passes protection tiers**

Read `proxy/config/route.ts`. The route returns `cartConfig` which is the full store config. Since the create/update routes save `tiers` inside `config.addons.shippingProtection.config.tiers`, the cart JS reads it as `CFG.addons.shippingProtection.tiers`.

**Verify:** The `_sp.tiers` reference in v14-complete.js matches the config path. Check that `CFG.addons.shippingProtection.config` has the `tiers` array. If the JS reads `_sp = CFG.addons.shippingProtection` (not `.config`), then tiers need to be at `CFG.addons.shippingProtection.tiers`.

Look at v14-complete.js line ~57: `var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};`

The config is stored as `addons.shippingProtection.config.tiers`, so JS reads `_sp.config.tiers` which won't work. Fix: in the create/update routes, store tiers at `addons.shippingProtection.tiers` (same level as `enabled`), OR in the JS read `_sp.config.tiers`.

**Decision:** Change JS to read from config sub-object: `var _spCfg = _sp.config || _sp || {};` and read `_spCfg.tiers`.

- [ ] **Step 2: Update v14-complete.js config reading**

Replace:
```javascript
var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};
```
With:
```javascript
var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};
var _spCfg = _sp.config || _sp;
```

Then update all `_sp.` references for config fields to use `_spCfg.`:
- `_spCfg.handle` → handle
- `_spCfg.tiers` → tiers
- `_spCfg.variantId` → variantId
- `_spCfg.price` → price
- `_spCfg.iconUrl` → iconUrl

- [ ] **Step 3: Run contract tests to verify nothing broke**

Run: `cd C:/Projects/eliminai-cart-drawer && node tests/contract.test.js`

- [ ] **Step 4: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add extensions/cart-drawer/assets/v14-complete.js
git commit -m "fix(protection): read config from _sp.config sub-object to match stored structure"
```

---

### Task 10: Update addon-definitions.ts

**Files:**
- Modify: `backend/src/lib/addon-definitions.ts`

- [ ] **Step 1: Remove `style` dimension and update shippingProtection definition**

Replace the shippingProtection entry's dimensions — remove `style` (per user: "display style remove for now"), keep `description` and `defaultOn`, update `price` to note it's for single mode only:

```typescript
{
  key: 'shippingProtection',
  label: 'Shipping Protection',
  icon: '🔒',
  description: 'Offer optional shipping protection as a cart line item to boost revenue.',
  estimatedImpact: '+15-25% attach rate',
  impactMetric: 'attach_rate',
  dimensions: [
    {
      key: 'description',
      label: 'Description Text',
      type: 'text',
      testable: true,
      default: 'Covers lost, stolen, or damaged packages',
      placeholder: 'Describe what the protection covers',
    },
    {
      key: 'defaultOn',
      label: 'Enabled by Default',
      type: 'toggle',
      testable: true,
      default: true,
    },
  ],
  defaultConfig: {
    description: 'Covers lost, stolen, or damaged packages',
    defaultOn: true,
    pricingMode: 'single',
    price: 499,
    tiers: [],
    iconId: 'box-shield',
    iconUrl: null,
    productId: null,
    handle: null,
    variantId: 0,
  },
},
```

- [ ] **Step 2: Verify compiles**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd C:/Projects/eliminai-cart-drawer && git add backend/src/lib/addon-definitions.ts
git commit -m "feat(protection): update addon definition — remove style, add tiered defaults"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Run full contract test suite**

Run: `cd C:/Projects/eliminai-cart-drawer && node tests/contract.test.js`
Expected: All 37 contracts pass (except pre-existing failures)

- [ ] **Step 2: Run TypeScript check**

Run: `cd C:/Projects/eliminai-cart-drawer/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test on localhost**

1. Start backend: `cd C:/Projects/eliminai-cart-drawer/backend && npm run dev`
2. Navigate to dashboard → Addons → Shipping Protection
3. Verify icon selector shows 5 icons + upload
4. Verify pricing mode toggle works (single ↔ tiered)
5. Verify tier editor: add/remove tiers, max 10
6. Click "Create Protection Product" → confirmation modal appears
7. Confirm → product created on Shopify
8. Verify green "Active on Shopify" status
9. Change price → "Sync to Shopify" button appears
10. Sync → verify product updated on Shopify admin

- [ ] **Step 4: Test cart JS tiers**

1. Open test store cart with protection enabled
2. Add items to change cart value across tier thresholds
3. Verify protection variant silently swaps
4. Verify toggle price display updates

- [ ] **Step 5: Final commit if any fixes needed**

```bash
cd C:/Projects/eliminai-cart-drawer && git add -A
git commit -m "fix(protection): end-to-end verification fixes"
```
