const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation {
        discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
          deletedAutomaticDiscountId
          userErrors { field message }
        }
      }`
    })
  });
  const data = await res.json();
  const errors = data?.data?.discountAutomaticDelete?.userErrors;
  if (errors && errors.length > 0) {
    console.error('Errors:', JSON.stringify(errors));
  } else {
    console.log('Deleted "Watch Oganizer" discount:', data?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId);
  }
  await p.$disconnect();
})();
