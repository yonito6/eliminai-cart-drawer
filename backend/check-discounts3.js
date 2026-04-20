const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Use REST API instead - simpler
  const res = await fetch(`https://${domain}/admin/api/2025-01/price_rules.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const priceRules = await res.json();
  console.log('Price rules:', JSON.stringify(priceRules, null, 2));

  // Also get automatic discounts via REST
  const res2 = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      discountNodes(first: 50, query: "type:automatic") {
        nodes {
          id
          discount {
            ... on DiscountAutomaticBasic {
              title
              status
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
            ... on DiscountAutomaticBxgy {
              title
              status
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
      }
    }` })
  });
  const data = await res2.json();
  if (data.errors) {
    console.error('GQL errors:', JSON.stringify(data.errors, null, 2));
  } else {
    const nodes = data?.data?.discountNodes?.nodes || [];
    console.log('\nAutomatic discounts:', nodes.length);
    nodes.forEach(n => {
      console.log('  ' + n.id + ' | ' + n.discount.title + ' | ' + n.discount.status + ' | combines=' + JSON.stringify(n.discount.combinesWith));
    });
  }

  // Now get FULL details for each discount individually
  const nodes2 = data?.data?.discountNodes?.nodes || [];
  for (const n of nodes2) {
    const numId = n.id.split('/').pop();
    // For BxGy, use the specific query
    const detailRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{
        discountNode(id: "${n.id}") {
          id
          discount {
            ... on DiscountAutomaticBasic {
              title
              customerGets {
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts { products(first: 5) { nodes { title handle } } }
                }
                value { ... on DiscountPercentage { percentage } }
              }
            }
            ... on DiscountAutomaticBxgy {
              title
              customerBuys {
                value { ... on DiscountQuantity { quantity } }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts { products(first: 5) { nodes { title handle } } }
                  ... on DiscountCollections { collections(first: 5) { nodes { title handle } } }
                }
              }
              customerGets {
                items {
                  ... on DiscountProducts { products(first: 5) { nodes { title handle } } }
                  ... on DiscountCollections { collections(first: 5) { nodes { title handle } } }
                }
              }
            }
          }
        }
      }` })
    });
    const detail = await detailRes.json();
    if (detail.errors) {
      console.log('\nDetail error for ' + n.discount.title + ':', JSON.stringify(detail.errors));
    } else {
      console.log('\n--- DETAIL: ' + n.discount.title + ' ---');
      console.log(JSON.stringify(detail.data.discountNode.discount, null, 2));
    }
  }

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
