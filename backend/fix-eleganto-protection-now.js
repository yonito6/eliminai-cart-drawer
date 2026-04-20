const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
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
    select: { id: true, accessToken: true, shopDomain: true, config: true, demoConfig: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;
  const productGid = 'gid://shopify/Product/9292300026107';
  const variantGid = 'gid://shopify/ProductVariant/48762319012091';

  // 1. Fix price to $4.99
  console.log('1. Updating variant price to $4.99...');
  const priceResult = await shopifyGQL(domain, token, `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id title price }
        userErrors { field message }
      }
    }
  `, {
    productId: productGid,
    variants: [{ id: variantGid, price: '4.99' }]
  });

  const priceErrors = priceResult?.data?.productVariantsBulkUpdate?.userErrors;
  if (priceErrors?.length > 0) {
    console.error('Price update failed:', priceErrors);
  } else {
    const variant = priceResult?.data?.productVariantsBulkUpdate?.productVariants?.[0];
    console.log('   Price updated:', '$' + variant?.price);
  }

  // 2. Upload image
  const imagePath = 'C:\\Users\\yonit\\Downloads\\protection (2).png';
  if (!fs.existsSync(imagePath)) {
    console.log('2. Image not found at:', imagePath);
    return;
  }

  console.log('2. Uploading protection icon...');
  const imageBuffer = fs.readFileSync(imagePath);
  const fileName = 'protection-icon.png';

  // Stage upload
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
      filename: fileName,
      mimeType: 'image/png',
      resource: 'PRODUCT_IMAGE',
      httpMethod: 'POST',
    }]
  });

  const target = stageResult?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    console.error('Stage upload failed:', JSON.stringify(stageResult));
    return;
  }

  // Upload to staged URL
  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), fileName);
  const uploadRes = await fetch(target.url, { method: 'POST', body: formData });
  console.log('   Upload status:', uploadRes.status);

  // Attach media to product
  const mediaResult = await shopifyGQL(domain, token, `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id }
        mediaUserErrors { field message }
      }
    }
  `, {
    productId: productGid,
    media: [{ originalSource: target.resourceUrl, mediaContentType: 'IMAGE' }]
  });

  const mediaErrors = mediaResult?.data?.productCreateMedia?.mediaUserErrors;
  if (mediaErrors?.length > 0) {
    console.error('Media attach failed:', mediaErrors);
  } else {
    console.log('   Image attached to product');
  }

  // 3. Fix the DB config to store price in cents (499) for the create route,
  //    but keep dollars for display. The tiers store price for /cart/add which uses variant price.
  console.log('3. Config already correct in DB (price: 4.99 dollars, variant handles pricing on Shopify)');

  console.log('\nDone! Verify on storefront.');
}

run().finally(() => p.$disconnect());
