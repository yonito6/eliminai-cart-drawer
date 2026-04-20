const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const s = await p.store.findUnique({
    where: { id: 'cmnyt3rca074juiqqf5z1whrg' },
    select: { shopDomain: true, accessToken: true, config: true, demoConfig: true }
  });

  // Find leftover code discounts with "Gift" in title
  const res = await fetch(`https://${s.shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': s.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        codeDiscountNodes(first: 20) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic { title }
              ... on DiscountCodeBxgy { title }
            }
          }
        }
      }`
    })
  });
  const data = await res.json();

  for (const n of data.data.codeDiscountNodes.nodes) {
    if (n.codeDiscount.title && n.codeDiscount.title.startsWith('Gift')) {
      console.log('Deleting leftover code discount:', n.id, n.codeDiscount.title);
      await fetch(`https://${s.shopDomain}/admin/api/2025-10/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': s.accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { discountCodeDelete(id: "${n.id}") { userErrors { field message } } }`
        })
      });
    }
  }

  // Clear giftDiscountCodes from config
  const cfg = s.config || {};
  const demo = s.demoConfig || {};
  delete cfg.giftDiscountCodes;
  delete demo.giftDiscountCodes;
  await p.store.update({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, data: { config: cfg, demoConfig: demo } });
  console.log('Cleared giftDiscountCodes from config');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
