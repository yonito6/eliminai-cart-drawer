const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

const PRODUCT_ID = 'gid://shopify/Product/9001277718779';

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

  // Step 1: Find all publications (sales channels)
  console.log('=== STEP 1: List all publications ===');
  const pubsResult = await gql(`{
    publications(first: 20) {
      nodes { id name }
    }
  }`);
  console.log(JSON.stringify(pubsResult, null, 2));

  if (!pubsResult.data || !pubsResult.data.publications) {
    console.log('Cannot list publications, trying REST API...');

    // Use REST API to unpublish
    const numericId = PRODUCT_ID.split('/').pop();

    // First check current product
    const prodRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/products/' + numericId + '.json', {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });
    const prodData = await prodRes.json();
    console.log('\nProduct:', prodData.product.title);
    console.log('Status:', prodData.product.status);
    console.log('Published at:', prodData.product.published_at);

    // Set published_at to null to unpublish from Online Store
    console.log('\n=== Unpublishing from Online Store ===');
    const updateRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/products/' + numericId + '.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: {
          id: parseInt(numericId),
          published: false
        }
      })
    });
    const updateData = await updateRes.json();
    if (updateData.product) {
      console.log('DONE!');
      console.log('Product:', updateData.product.title);
      console.log('Status:', updateData.product.status);
      console.log('Published at:', updateData.product.published_at);
    } else {
      console.log('ERROR:', JSON.stringify(updateData));
    }

    // Verify it's still addable to cart
    console.log('\n=== Verify: product still ACTIVE ===');
    const verifyRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/products/' + numericId + '.json', {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });
    const verifyData = await verifyRes.json();
    console.log('Title:', verifyData.product.title);
    console.log('Status:', verifyData.product.status);
    console.log('Published:', verifyData.product.published_at ? 'YES' : 'NO (hidden from storefront)');
    console.log('Variant ID:', verifyData.product.variants[0].id);
    console.log('Price: $' + verifyData.product.variants[0].price);
  } else {
    const pubs = pubsResult.data.publications.nodes;
    pubs.forEach(function(pub) { console.log('  ' + pub.name + ' — ' + pub.id); });

    const onlineStore = pubs.find(function(pub) {
      return pub.name === 'Online Store';
    });

    if (!onlineStore) {
      console.log('No "Online Store" publication found');
      await p.$disconnect();
      return;
    }

    console.log('\n=== STEP 2: Unpublish from "' + onlineStore.name + '" ===');
    const unpubResult = await gql(`
      mutation unpublish($id: ID!, $input: [PublicationInput!]!) {
        publishableUnpublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }
    `, { id: PRODUCT_ID, input: [{ publicationId: onlineStore.id }] });

    console.log(JSON.stringify(unpubResult, null, 2));
  }

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
