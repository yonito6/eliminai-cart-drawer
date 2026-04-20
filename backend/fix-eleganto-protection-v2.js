const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function shopifyGQL(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function run() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, accessToken: true, shopDomain: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;
  const productGid = 'gid://shopify/Product/9292303532283';
  const variantGid = 'gid://shopify/ProductVariant/48762430128379';

  // 1. Fix price
  console.log('1. Setting price to $4.99...');
  const priceResult = await shopifyGQL(domain, token, `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price }
        userErrors { field message }
      }
    }
  `, { productId: productGid, variants: [{ id: variantGid, price: '4.99' }] });
  console.log('   Result:', priceResult?.data?.productVariantsBulkUpdate?.productVariants?.[0]?.price);

  // 2. Upload image
  const imagePath = 'C:\\Users\\yonit\\Downloads\\protection (2).png';
  if (!fs.existsSync(imagePath)) { console.log('Image not found'); return; }
  console.log('2. Uploading image...');
  const imageBuffer = fs.readFileSync(imagePath);

  const stageResult = await shopifyGQL(domain, token, `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `, { input: [{ filename: 'protection-icon.png', mimeType: 'image/png', resource: 'PRODUCT_IMAGE', httpMethod: 'POST' }] });

  const target = stageResult?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) { console.error('Stage failed'); return; }

  const formData = new FormData();
  for (const param of target.parameters) formData.append(param.name, param.value);
  formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'protection-icon.png');
  await fetch(target.url, { method: 'POST', body: formData });

  const mediaResult = await shopifyGQL(domain, token, `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id }
        mediaUserErrors { field message }
      }
    }
  `, { productId: productGid, media: [{ originalSource: target.resourceUrl, mediaContentType: 'IMAGE' }] });

  const mediaErrors = mediaResult?.data?.productCreateMedia?.mediaUserErrors;
  if (mediaErrors?.length) console.error('Media error:', mediaErrors);
  else console.log('   Image uploaded');

  // 3. Also delete the old orphaned product (9292300026107) from previous attempt
  console.log('3. Deleting old orphaned product (9292300026107)...');
  const delResult = await shopifyGQL(domain, token, `
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
      }
    }
  `, { input: { id: 'gid://shopify/Product/9292300026107' } });
  console.log('   Deleted:', delResult?.data?.productDelete?.deletedProductId || 'failed');

  console.log('\nDone!');
}

run().finally(() => p.$disconnect());
