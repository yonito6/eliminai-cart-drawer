const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode { automaticDiscount { ... on DiscountAutomaticBasic { title status } } }
          userErrors { field message }
        }
      }`,
      variables: {
        id: "gid://shopify/DiscountAutomaticNode/1787625341179",
        automaticBasicDiscount: { title: "Gift #2" }
      }
    })
  });
  const data = await res.json();
  const d = data?.data?.discountAutomaticBasicUpdate;
  if (d?.userErrors?.length > 0) console.error('Errors:', JSON.stringify(d.userErrors));
  else console.log('Renamed to:', d?.automaticDiscountNode?.automaticDiscount?.title);
  await p.$disconnect();
})();
