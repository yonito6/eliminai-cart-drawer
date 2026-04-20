const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { shopDomain: true, accessToken: true }
  });
  if (!store || !store.accessToken) { console.log('No token'); return; }
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Check product publications (sales channels)
  const gqlRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        product(id: "gid://shopify/Product/10181490475321") {
          title
          status
          publishedOnCurrentPublication
          resourcePublicationV2(first: 10) {
            edges { node { publication { name id } isPublished } }
          }
        }
      }`
    })
  });
  const gqlData = await gqlRes.json();
  console.log(JSON.stringify(gqlData, null, 2));
}
check().finally(() => p.$disconnect());
