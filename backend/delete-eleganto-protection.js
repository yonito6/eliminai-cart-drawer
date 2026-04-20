const { PrismaClient } = require('@prisma/client');
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
    select: { id: true, accessToken: true, shopDomain: true, config: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;
  const productGid = 'gid://shopify/Product/9292303532283';

  // 1. Delete product from Shopify
  console.log('Deleting Shopify product...');
  const del = await shopifyGQL(domain, token, `
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) { deletedProductId userErrors { field message } }
    }
  `, { input: { id: productGid } });
  console.log('Deleted:', del?.data?.productDelete?.deletedProductId || 'failed', del?.data?.productDelete?.userErrors);

  // 2. Clear protection config from DB (so the editor shows "Create" button)
  const cfg = store.config || {};
  const addons = cfg.addons || {};
  delete addons.shippingProtection;
  cfg.addons = addons;

  await p.store.update({
    where: { id: store.id },
    data: { config: cfg }
  });
  console.log('DB config cleared — editor will show Create button');
}

run().finally(() => p.$disconnect());
