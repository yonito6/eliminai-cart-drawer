const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, accessToken: true, shopDomain: true, config: true, demoConfig: true }
  });

  async function gql(query, variables) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  }

  // Watch Case product GID
  const watchCaseGid = 'gid://shopify/Product/8959501435131';
  const code = 'GIFTCASE';

  // First check if it already exists
  const existing = await gql(`{
    codeDiscountNodes(first: 10, query: "title:Gift") {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } }
        }
      }
    }
  }`);

  const existingGift = existing?.data?.codeDiscountNodes?.nodes?.find(
    n => n.codeDiscount?.title?.includes('Gift')
  );
  if (existingGift) {
    console.log('Gift discount already exists:', JSON.stringify(existingGift, null, 2));
    await p.$disconnect();
    return;
  }

  // Create DiscountCodeBasic — 100% off the Watch Case product
  // Using code-based discount because the store's "1+1 FREE" and "1+2 FREE"
  // have combinesWith.productDiscounts: false, so an automatic gift BXGY won't stack.
  // Cart drawer will apply this code via /discount/GIFTCASE?redirect=/checkout
  const result = await gql(`
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount { ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } } }
        }
        userErrors { field message }
      }
    }
  `, {
    basicCodeDiscount: {
      title: 'Gift #2 — Eleganto Case',
      startsAt: new Date().toISOString(),
      usageLimit: null,
      code: code,
      customerSelection: { all: true },
      customerGets: {
        items: { products: { productsToAdd: [watchCaseGid] } },
        value: { percentage: 1.0 },
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
    },
  });

  const errors = result?.data?.discountCodeBasicCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('Errors:', JSON.stringify(errors, null, 2));
    await p.$disconnect();
    return;
  }

  const node = result?.data?.discountCodeBasicCreate?.codeDiscountNode;
  console.log('Created Gift #2 discount:', JSON.stringify(node, null, 2));
  console.log('Discount code:', code);

  // Store the gift code in both live and demo config
  const liveConfig = store.config || {};
  const demoConfig = store.demoConfig || {};
  liveConfig.giftDiscountCodes = [code];
  demoConfig.giftDiscountCodes = [code];

  await p.store.update({
    where: { id: store.id },
    data: { config: liveConfig, demoConfig: demoConfig }
  });
  console.log('Saved gift code to store config (both live and demo)');

  // Verify
  const verify = await gql(`{
    codeDiscountNodes(first: 10, query: "title:Gift") {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title status
            codes(first: 1) { nodes { code } }
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerGets {
              items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } }
              value { ... on DiscountPercentage { percentage } }
            }
          }
        }
      }
    }
  }`);

  console.log('\nVerification:');
  for (const n of verify?.data?.codeDiscountNodes?.nodes || []) {
    console.log(JSON.stringify(n.codeDiscount, null, 2));
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
