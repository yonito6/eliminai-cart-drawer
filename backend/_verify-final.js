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

  // Check the specific discount
  const r = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787625341179") {
      automaticDiscount {
        ... on DiscountAutomaticBasic {
          title status startsAt endsAt
          combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          minimumRequirement { ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity } }
          customerGets {
            items {
              ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              ... on AllDiscountItems { allItems }
            }
            value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
          }
        }
      }
    }
  }`);
  console.log('Discount details:');
  console.log(JSON.stringify(r?.data?.automaticDiscountNode?.automaticDiscount, null, 2));

  // Also list ALL discounts (not just active)
  console.log('\n=== ALL Discounts (any status) ===');
  const all = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          __typename
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticBxgy { title status }
        }
      }
    }
  }`);
  all?.data?.automaticDiscountNodes?.nodes?.forEach(n => {
    const d = n.automaticDiscount;
    console.log('  ' + (d.title || '?') + ' (' + d.status + ') ' + d.__typename + ' — ' + n.id);
  });

  await p.$disconnect();
})();
