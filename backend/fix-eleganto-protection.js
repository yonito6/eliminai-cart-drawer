const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function run() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, accessToken: true, shopDomain: true, config: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;
  const cfg = store.config || {};
  const sp = (cfg.addons || {}).shippingProtection || {};
  const productGid = sp.productId;
  const variantId = sp.config.variantId;

  console.log('Product GID:', productGid);
  console.log('Variant ID:', variantId);

  // Check actual Shopify product
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        product(id: "${productGid}") {
          title
          status
          variants(first: 5) {
            nodes { id title price }
          }
          media(first: 3) {
            nodes { mediaContentType ... on MediaImage { image { url } } }
          }
        }
      }`
    })
  });

  const data = await res.json();
  const product = data.data.product;
  console.log('\n--- Shopify Product ---');
  console.log('Title:', product.title);
  console.log('Status:', product.status);
  console.log('Variants:');
  product.variants.nodes.forEach(v => console.log('  ', v.id, v.title, '$' + v.price));
  console.log('Media:', product.media.nodes.length, 'items');
  product.media.nodes.forEach(m => console.log('  ', m.mediaContentType, m.image?.url || ''));
}

run().finally(() => p.$disconnect());
