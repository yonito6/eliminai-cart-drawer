const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  // Check the new Gift #2
  console.log('=== New Gift #2 (Basic) ===');
  const r = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787622359291") {
      automaticDiscount {
        ... on DiscountAutomaticBasic {
          title status startsAt endsAt
          combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          minimumRequirement {
            ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
          }
          customerGets {
            items {
              ... on DiscountProducts { products(first: 5) { nodes { id title status } } }
              ... on AllDiscountItems { allItems }
            }
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
            }
          }
        }
      }
    }
  }`);
  console.log(JSON.stringify(r?.data?.automaticDiscountNode?.automaticDiscount, null, 2));

  // Also verify old BXGY Gift #2 is gone
  console.log('\n=== Old BXGY Gift #2 (should be gone) ===');
  const old = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
      automaticDiscount { ... on DiscountAutomaticBxgy { title status } }
    }
  }`);
  console.log('Old:', old?.data?.automaticDiscountNode ? 'STILL EXISTS!' : 'Deleted (good)');

  // List ALL active discounts
  console.log('\n=== ALL Active Automatic Discounts ===');
  const all = await gql(`{
    automaticDiscountNodes(first: 20, query: "status:active") {
      nodes {
        id
        automaticDiscount {
          __typename
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticFreeShipping { title status }
        }
      }
    }
  }`);
  all?.data?.automaticDiscountNodes?.nodes?.forEach(n => {
    const d = n.automaticDiscount;
    console.log('  ' + d.__typename + ': "' + d.title + '" | ' + d.status + ' | ' + n.id);
  });

  await p.$disconnect();
})();
