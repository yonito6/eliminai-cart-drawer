const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true, config: true }
  });

  async function gql(query) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  }

  // 1. ALL automatic discounts
  const auto = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            combinesWith { productDiscounts }
            usesPerOrderLimit
            customerBuys { value { ... on DiscountQuantity { quantity } } }
            customerGets {
              items { ... on DiscountProducts { products(first: 10) { nodes { id title handle } } } }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
          ... on DiscountAutomaticBasic {
            title status
            combinesWith { productDiscounts }
            minimumRequirement { ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity } }
            customerGets {
              items { ... on DiscountProducts { products(first: 10) { nodes { id title handle } } } }
              value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount currencyCode } } }
            }
          }
        }
      }
    }
  }`);

  console.log('=== AUTOMATIC DISCOUNTS ===');
  for (const node of auto?.data?.automaticDiscountNodes?.nodes || []) {
    console.log(JSON.stringify({ id: node.id, ...node.automaticDiscount }, null, 2));
    console.log('---');
  }

  // 2. Code discounts with "Gift" in title
  const codes = await gql(`{
    codeDiscountNodes(first: 50, query: "title:Gift") {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBxgy { title status codes(first: 1) { nodes { code } } }
          ... on DiscountCodeBasic {
            title status codes(first: 1) { nodes { code } }
            customerGets {
              items { ... on DiscountProducts { products(first: 10) { nodes { id title handle } } } }
            }
          }
        }
      }
    }
  }`);

  console.log('\n=== CODE DISCOUNTS WITH "Gift" ===');
  for (const node of codes?.data?.codeDiscountNodes?.nodes || []) {
    if (node.codeDiscount?.title) {
      console.log(JSON.stringify({ id: node.id, ...node.codeDiscount }, null, 2));
    }
  }

  // 3. Also check "Eliminai" and "Cart Drawer" named discounts
  const eliminai = await gql(`{
    automaticDiscountNodes(first: 10, query: "title:Eliminai OR title:Cart") {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticBasic { title status }
        }
      }
    }
  }`);

  console.log('\n=== "Eliminai" or "Cart" DISCOUNTS ===');
  for (const node of eliminai?.data?.automaticDiscountNodes?.nodes || []) {
    console.log(JSON.stringify({ id: node.id, ...node.automaticDiscount }, null, 2));
  }

  // 4. Store config reward tiers
  const cfg = store.config || {};
  const addons = cfg.addons || {};
  const rewardConfig = addons.freeShippingBar?.config || {};
  console.log('\n=== REWARD TIERS CONFIG ===');
  console.log(JSON.stringify(rewardConfig.tiers, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
