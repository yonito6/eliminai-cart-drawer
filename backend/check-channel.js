const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;

  // Use GraphQL to check publication status
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `{
        productByIdentifier(identifier: { handle: "geotrianglenecklace" }) {
          id
          title
          status
          publishedOnCurrentPublication
          availablePublicationsCount { count }
        }
      }`
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
