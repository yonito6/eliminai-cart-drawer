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

  // Get first 10 products from "All Watch" collection that are active and in stock
  const r = await gql(`{
    collection(id: "gid://shopify/Collection/432470327547") {
      products(first: 10, filters: {available: true}) {
        nodes {
          id title status
          variants(first: 1) {
            nodes { id title price inventoryQuantity }
          }
        }
      }
    }
  }`);

  const products = r?.data?.collection?.products?.nodes || [];
  console.log('In-stock watches in "All Watch":');
  products.forEach(p => {
    const v = p.variants?.nodes?.[0];
    console.log('  ' + p.title + ' | ' + v?.id + ' | $' + v?.price + ' | qty: ' + v?.inventoryQuantity);
  });

  // Also check the case variant inventory
  const caseR = await gql(`{
    productVariant(id: "gid://shopify/ProductVariant/46941745742075") {
      title price inventoryQuantity
      product { title status }
    }
  }`);
  const cv = caseR?.data?.productVariant;
  console.log('\nCase:', cv?.product?.title, '| $' + cv?.price, '| qty:', cv?.inventoryQuantity, '| status:', cv?.product?.status);

  // Check access scopes
  const scopeR = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/access_scopes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const scopes = await scopeR.json();
  const scopeList = scopes?.access_scopes?.map(s => s.handle) || [];
  console.log('\nAccess scopes:', scopeList.filter(s => s.includes('draft') || s.includes('discount') || s.includes('order')).join(', '));

  await p.$disconnect();
})();
