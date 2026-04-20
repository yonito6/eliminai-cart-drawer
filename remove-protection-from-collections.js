const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

const PRODUCT_ID = 'gid://shopify/Product/9001277718779'; // ACTIVE $4.99 Shipping Protection

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  async function gql(query, variables) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  }

  // Step 1: Get all collections this product is in
  console.log('=== STEP 1: Get collections for Shipping Protection ===');
  const result = await gql(`{
    product(id: "${PRODUCT_ID}") {
      id title status
      collections(first: 50) { nodes { id title } }
    }
  }`);

  const product = result.data.product;
  console.log('Product:', product.title);
  console.log('Status:', product.status);
  console.log('Collections:', product.collections.nodes.map(c => c.title).join(', '));

  // Step 2: Remove from ALL collections
  console.log('\n=== STEP 2: Remove from all collections (product NOT deleted) ===');
  for (const coll of product.collections.nodes) {
    console.log('  Removing from "' + coll.title + '" (' + coll.id + ')...');
    const removeResult = await gql(`
      mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }
    `, { id: coll.id, productIds: [PRODUCT_ID] });

    const errors = removeResult.data.collectionRemoveProducts.userErrors;
    if (errors.length > 0) {
      console.log('    ERROR:', JSON.stringify(errors));
    } else {
      console.log('    DONE');
    }
  }

  // Step 3: Verify product still exists and is ACTIVE
  console.log('\n=== STEP 3: Verify product still exists ===');
  const verify = await gql(`{
    product(id: "${PRODUCT_ID}") {
      id title status
      variants(first: 1) { nodes { id price } }
      collections(first: 10) { nodes { id title } }
    }
  }`);

  const p2 = verify.data.product;
  console.log('Product:', p2.title);
  console.log('Status:', p2.status, p2.status === 'ACTIVE' ? '— STILL ACTIVE' : '— WARNING');
  console.log('Price: $' + p2.variants.nodes[0].price);
  console.log('Variant ID:', p2.variants.nodes[0].id);
  console.log('Collections:', p2.collections.nodes.length === 0 ? 'NONE (removed from all)' : p2.collections.nodes.map(c => c.title).join(', '));

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
