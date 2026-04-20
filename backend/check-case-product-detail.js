const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      product(id: "gid://shopify/Product/8959501435131") {
        title
        handle
        status
        productType
        tags
        vendor
        giftCardTemplateSuffix
        isGiftCard
        publishedOnCurrentPublication
        availablePublicationsCount { count }
        variants(first: 5) {
          nodes {
            id
            title
            price
            availableForSale
            inventoryPolicy
            inventoryQuantity
            selectedOptions { name value }
          }
        }
        collections(first: 10) {
          nodes { title handle }
        }
      }
    }` })
  });
  const data = await res.json();
  if (data.errors) console.error(JSON.stringify(data.errors, null, 2));
  console.log(JSON.stringify(data.data?.product, null, 2));
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
