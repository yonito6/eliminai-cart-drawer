const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true },
  });

  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNodes(first: 20, query: "title:Gift*") {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
              startsAt
              endsAt
              minimumRequirement {
                ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
              }
              customerGets {
                items {
                  ... on DiscountProducts {
                    products(first: 3) { nodes { title handle } }
                  }
                }
                value {
                  ... on DiscountPercentage { percentage }
                }
              }
              combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            }
          }
        }
      }
    }` }),
  });
  const data = await res.json();
  const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
  console.log('Gift discounts found:', nodes.length);
  for (const n of nodes) {
    const d = n.automaticDiscount;
    console.log('\n---', d.title, '---');
    console.log('  Status:', d.status);
    console.log('  Starts:', d.startsAt, '| Ends:', d.endsAt || 'never');
    console.log('  Min qty:', d.minimumRequirement?.greaterThanOrEqualToQuantity || 'none');
    console.log('  Discount:', d.customerGets?.value?.percentage ? (d.customerGets.value.percentage * 100) + '%' : 'unknown');
    console.log('  Products:', d.customerGets?.items?.products?.nodes?.map(p => p.title).join(', ') || 'none');
    console.log('  Combines:', JSON.stringify(d.combinesWith));
  }

  if (data.errors) console.log('\nErrors:', JSON.stringify(data.errors));
  await p.$disconnect();
})();
