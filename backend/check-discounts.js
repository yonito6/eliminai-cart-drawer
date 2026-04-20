const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
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
              minimumRequirement {
                ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
                ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
              }
              customerGets {
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 5) { nodes { title handle } }
                  }
                  ... on DiscountCollections {
                    collections(first: 5) { nodes { title handle } }
                  }
                }
                value {
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount { amount { amount currencyCode } }
                }
              }
            }
            ... on DiscountAutomaticBxgy {
              title
              status
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
              customerBuys {
                value {
                  ... on DiscountQuantity { quantity }
                  ... on DiscountPurchaseAmount { amount }
                }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 5) { nodes { title handle } }
                  }
                  ... on DiscountCollections {
                    collections(first: 5) { nodes { title handle } }
                  }
                }
              }
              customerGets {
                value {
                  ... on DiscountQuantity { quantity }
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount { amount { amount currencyCode } }
                }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 5) { nodes { title handle } }
                  }
                  ... on DiscountCollections {
                    collections(first: 5) { nodes { title handle } }
                  }
                }
              }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
    await p.$disconnect();
    return;
  }
  const nodes = data?.data?.discountNodes?.nodes || [];
  console.log('Total automatic discounts:', nodes.length);
  nodes.forEach(n => {
    console.log('\n=== ' + n.id + ' ===');
    console.log(JSON.stringify(n.discount, null, 2));
  });

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
