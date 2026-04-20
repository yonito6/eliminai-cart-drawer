const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: { contains: 'eleganto-3011' } },
    select: { shopDomain: true, accessToken: true },
  });
  var r = await gql(store.shopDomain, store.accessToken, `{
    node(id: "gid://shopify/DiscountAutomaticNode/1788644819195") {
      ... on DiscountAutomaticNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticBasic { title status }
        }
      }
    }
  }`);
  console.log('1+1 node:', JSON.stringify(r?.data?.node));

  // List ALL discounts
  var all = await gql(store.shopDomain, store.accessToken, `{
    automaticDiscountNodes(first: 20) {
      nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } ... on DiscountAutomaticBasic { title status } } }
    }
  }`);
  console.log('\nAll:', all?.data?.automaticDiscountNodes?.nodes?.map(function(n){ return n.id + ' ' + (n.automaticDiscount?.title || '?') + ' ' + (n.automaticDiscount?.status || '?'); }));

  await p.$disconnect();
})();
