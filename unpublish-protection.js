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

  // Step 1: Check current publications (sales channels)
  console.log('=== STEP 1: Check current sales channels ===');
  const pubResult = await gql(`{
    product(id: "${PRODUCT_ID}") {
      id title status
      publishedOnCurrentPublication
      resourcePublicationsV2(first: 10) {
        nodes {
          publication { id name }
          isPublished
        }
      }
    }
  }`);

  const prod = pubResult.data.product;
  console.log('Product:', prod.title, '(' + prod.status + ')');
  console.log('Publications:');
  prod.resourcePublicationsV2.nodes.forEach(function(n) {
    console.log('  ' + n.publication.name + ': ' + (n.isPublished ? 'PUBLISHED' : 'not published'));
  });

  // Step 2: Unpublish from Online Store only
  console.log('\n=== STEP 2: Unpublish from Online Store ===');

  // Find the Online Store publication ID
  const onlineStore = prod.resourcePublicationsV2.nodes.find(function(n) {
    return n.publication.name === 'Online Store';
  });

  if (!onlineStore) {
    console.log('Not published on Online Store — nothing to do!');
    await p.$disconnect();
    return;
  }

  const pubId = onlineStore.publication.id;
  console.log('Online Store publication ID:', pubId);

  const unpublishResult = await gql(`
    mutation productChangeStatus($productId: ID!, $input: [PublicationInput!]!) {
      publishableUnpublish(id: $productId, input: $input) {
        userErrors { field message }
        publishable {
          ... on Product { id title status }
        }
      }
    }
  `, {
    productId: PRODUCT_ID,
    input: [{ publicationId: pubId }]
  });

  const errors = unpublishResult.data.publishableUnpublish.userErrors;
  if (errors.length > 0) {
    console.log('ERROR:', JSON.stringify(errors));
  } else {
    console.log('DONE — unpublished from Online Store');
  }

  // Step 3: Verify — product still ACTIVE, just not on storefront
  console.log('\n=== STEP 3: Verify ===');
  const verifyResult = await gql(`{
    product(id: "${PRODUCT_ID}") {
      id title status
      variants(first: 1) { nodes { id price } }
      resourcePublicationsV2(first: 10) {
        nodes {
          publication { name }
          isPublished
        }
      }
    }
  }`);

  const v = verifyResult.data.product;
  console.log('Product:', v.title);
  console.log('Status:', v.status, v.status === 'ACTIVE' ? '— STILL ACTIVE' : '');
  console.log('Variant:', v.variants.nodes[0].id, '($' + v.variants.nodes[0].price + ')');
  console.log('Publications after:');
  v.resourcePublicationsV2.nodes.forEach(function(n) {
    console.log('  ' + n.publication.name + ': ' + (n.isPublished ? 'PUBLISHED' : 'HIDDEN'));
  });

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
