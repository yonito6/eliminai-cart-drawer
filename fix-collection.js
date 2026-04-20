const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const COLLECTION_ID = "gid://shopify/Collection/399056961787";
  const GIFT_PRODUCT_IDS = [
    "gid://shopify/Product/9290097656059",   // gift-eleganto-case
    "gid://shopify/Product/9290097688827"    // gift-golden-love-heart-necklace
  ];

  // Remove gift products from "All items" collection using collectionRemoveProducts
  const mutation = `mutation removeGiftsFromCollection($collectionId: ID!, $productIds: [ID!]!) {
    collectionRemoveProducts(id: $collectionId, productIds: $productIds) {
      job { id }
      userErrors { field message }
    }
  }`;

  console.log('Removing gift products from "All items" collection...');
  console.log('  Gift products:', GIFT_PRODUCT_IDS);

  const res = await fetch("https://" + store.shopDomain + "/admin/api/2025-01/graphql.json", {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        collectionId: COLLECTION_ID,
        productIds: GIFT_PRODUCT_IDS
      }
    }),
  });

  const data = await res.json();
  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
  } else {
    const result = data.data.collectionRemoveProducts;
    if (result.userErrors && result.userErrors.length > 0) {
      console.error('User errors:', JSON.stringify(result.userErrors, null, 2));
    } else {
      console.log('SUCCESS — Gift products removed from "All items" collection');
      console.log('Job:', result.job);
    }
  }

  // Verify
  const verifyQuery = `{
    giftCase: product(id: "gid://shopify/Product/9290097656059") {
      title handle
      inCollection(id: "${COLLECTION_ID}")
    }
    giftNecklace: product(id: "gid://shopify/Product/9290097688827") {
      title handle
      inCollection(id: "${COLLECTION_ID}")
    }
  }`;

  // Wait a moment for the job to complete
  await new Promise(r => setTimeout(r, 2000));

  const verifyRes = await fetch("https://" + store.shopDomain + "/admin/api/2025-01/graphql.json", {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: verifyQuery }),
  });

  const verifyData = await verifyRes.json();
  console.log('\nVerification:');
  console.log('  gift-eleganto-case in collection:', verifyData.data.giftCase.inCollection);
  console.log('  gift-golden-love-heart-necklace in collection:', verifyData.data.giftNecklace.inCollection);

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
