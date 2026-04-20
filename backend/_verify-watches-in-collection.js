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

  // Check which products the 3 test variants belong to, and if they're in "All Watch"
  const variants = [
    'gid://shopify/ProductVariant/45167742681339',
    'gid://shopify/ProductVariant/45175479304443',
    'gid://shopify/ProductVariant/45167917367547'
  ];

  for (const vid of variants) {
    const r = await gql(`{
      productVariant(id: "${vid}") {
        id title price
        product {
          id title status
          collections(first: 20) { nodes { id title } }
        }
      }
    }`);
    const v = r?.data?.productVariant;
    const colls = v?.product?.collections?.nodes || [];
    const inAllWatch = colls.some(c => c.id === 'gid://shopify/Collection/432470327547');
    console.log(v?.product?.title, '| variant:', v?.title, '| $' + v?.price, '| status:', v?.product?.status);
    console.log('  Collections:', colls.map(c => c.title).join(', '));
    console.log('  In "All Watch"?', inAllWatch ? 'YES' : '*** NO ***');
    console.log();
  }

  // Also test via storefront - create a cart and check discount allocations
  console.log('=== Testing storefront cart ===');
  const sfRes = await fetch('https://' + store.shopDomain + '/cart.json', {
    headers: { 'Accept': 'application/json' }
  });
  console.log('Storefront cart status:', sfRes.status);

  await p.$disconnect();
})();
