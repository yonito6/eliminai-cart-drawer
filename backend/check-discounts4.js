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
      automaticDiscountNodes(first: 50) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
            ... on DiscountAutomaticBxgy {
              title
              status
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('GQL errors:', JSON.stringify(data.errors, null, 2));
  }
  const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
  console.log('Automatic discounts:', nodes.length);
  nodes.forEach(n => {
    const d = n.automaticDiscount;
    console.log('  ' + n.id + ' | ' + d.title + ' | ' + d.status + ' | combines=' + JSON.stringify(d.combinesWith));
  });
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
