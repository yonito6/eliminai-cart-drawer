const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Check the specific new discount
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787500134651") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            minimumRequirement {
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              items {
                ... on DiscountProducts { products(first: 5) { nodes { title handle } } }
              }
              value { ... on DiscountPercentage { percentage } }
            }
          }
        }
      }
      automaticDiscountNodes(first: 50) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic { title status }
            ... on DiscountAutomaticBxgy { title status }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  if (data.errors) console.error('Errors:', JSON.stringify(data.errors, null, 2));
  console.log('Direct lookup:', JSON.stringify(data.data?.automaticDiscountNode, null, 2));
  console.log('\nAll discounts:', data.data?.automaticDiscountNodes?.nodes?.length);
  data.data?.automaticDiscountNodes?.nodes?.forEach(n => {
    console.log('  ' + n.id + ' | ' + n.automaticDiscount.title + ' | ' + n.automaticDiscount.status);
  });
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
