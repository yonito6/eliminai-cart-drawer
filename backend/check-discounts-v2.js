const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  async function gql(query) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  }

  console.log('=== ALL AUTOMATIC DISCOUNTS ===');
  const auto = await gql(`{
    automaticDiscountNodes(first: 30) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerBuys {
              items { ... on AllDiscountItems { allItems } ... on DiscountProducts { products(first: 10) { nodes { id title } } } ... on DiscountCollections { collections(first: 5) { nodes { id title } } } }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items { ... on AllDiscountItems { allItems } ... on DiscountProducts { products(first: 10) { nodes { id title } } } ... on DiscountCollections { collections(first: 5) { nodes { id title } } } }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
            usesPerOrderLimit
            combinesWith { orderDiscounts productDiscounts shippingDiscounts }
          }
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticApp { title status }
          ... on DiscountAutomaticFreeShipping { title status }
        }
      }
    }
  }`);

  for (const n of auto.data?.automaticDiscountNodes?.nodes || []) {
    const d = n.automaticDiscount;
    console.log('\n---');
    console.log('ID:', n.id);
    console.log('Title:', d.title, '| Status:', d.status);
    if (d.customerBuys) {
      console.log('  Buys:', JSON.stringify(d.customerBuys, null, 2));
      console.log('  Gets:', JSON.stringify(d.customerGets, null, 2));
      console.log('  usesPerOrderLimit:', d.usesPerOrderLimit);
      console.log('  combinesWith:', JSON.stringify(d.combinesWith));
    }
  }

  console.log('\n\n=== ALL CODE DISCOUNTS ===');
  const codes = await gql(`{
    codeDiscountNodes(first: 30) {
      nodes {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title status
            codes(first: 3) { nodes { code } }
            customerGets {
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } ... on AllDiscountItems { allItems } }
              value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
            }
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          }
          ... on DiscountCodeBxgy {
            title status
            codes(first: 3) { nodes { code } }
          }
          ... on DiscountCodeFreeShipping { title status }
        }
      }
    }
  }`);

  for (const n of codes.data?.codeDiscountNodes?.nodes || []) {
    const d = n.codeDiscount;
    console.log('\n---');
    console.log('ID:', n.id);
    console.log('Title:', d.title, '| Status:', d.status);
    if (d.codes) console.log('  Codes:', d.codes.nodes.map(c => c.code).join(', '));
    if (d.customerGets) console.log('  Gets:', JSON.stringify(d.customerGets, null, 2));
    if (d.combinesWith) console.log('  combinesWith:', JSON.stringify(d.combinesWith));
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
