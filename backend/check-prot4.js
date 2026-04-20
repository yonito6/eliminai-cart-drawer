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

  // Check product publications via REST
  const res = await fetch(`https://${domain}/admin/api/2025-01/products/10181490475321.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  console.log('Title:', data.product.title);
  console.log('Status:', data.product.status);
  console.log('Published at:', data.product.published_at);
  console.log('Published scope:', data.product.published_scope);
  console.log('Tags:', data.product.tags);

  // Check via publications endpoint
  const pubRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        product(id: "gid://shopify/Product/10181490475321") {
          title
          status
          publishedOnCurrentPublication
          resourcePublicationsV2(first: 10) {
            edges { node { publication { name id } isPublished } }
          }
        }
      }`
    })
  });
  const pubData = await pubRes.json();
  console.log('\nPublications:', JSON.stringify(pubData, null, 2));
}
check().finally(() => p.$disconnect());
