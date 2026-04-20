const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  // Check what collections the gift products are in
  const query = `{
    giftCase: product(id: "gid://shopify/Product/9290097656059") {
      title handle
      collections(first: 10) {
        nodes { id title }
      }
    }
    giftNecklace: product(id: "gid://shopify/Product/9290097688827") {
      title handle
      collections(first: 10) {
        nodes { id title }
      }
    }
  }`;

  const res = await fetch("https://" + store.shopDomain + "/admin/api/2025-01/graphql.json", {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data.data, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
