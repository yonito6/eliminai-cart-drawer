const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true },
  });

  // Get ALL automatic discounts to see what's there
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNodes(first: 30) {
        nodes {
          id
          automaticDiscount {
            __typename
            ... on DiscountAutomaticBasic {
              title
              status
              minimumRequirement {
                ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
              }
              customerGets {
                items {
                  ... on DiscountProducts {
                    products(first: 3) { nodes { title } }
                  }
                  ... on AllDiscountItems { allItems }
                }
                value {
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount { amount { amount } }
                }
              }
            }
            ... on DiscountAutomaticBxgy {
              title
              status
              customerBuys {
                items {
                  ... on AllDiscountItems { allItems }
                }
                value {
                  ... on DiscountQuantity { quantity }
                }
              }
              customerGets {
                items {
                  ... on DiscountProducts {
                    products(first: 3) { nodes { title } }
                  }
                }
                value {
                  ... on DiscountOnQuantity {
                    quantity { quantity }
                    effect {
                      ... on DiscountPercentage { percentage }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }` }),
  });
  const data = await res.json();
  const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
  console.log('All automatic discounts:', nodes.length);
  for (const n of nodes) {
    const d = n.automaticDiscount;
    console.log('\n---', d.title || '(no title)', '---');
    console.log('  Type:', d.__typename);
    console.log('  Status:', d.status);
    console.log('  ID:', n.id);
    if (d.__typename === 'DiscountAutomaticBasic') {
      console.log('  Min qty:', d.minimumRequirement?.greaterThanOrEqualToQuantity || 'none');
      console.log('  Products:', d.customerGets?.items?.products?.nodes?.map(p => p.title).join(', ') || d.customerGets?.items?.allItems ? 'ALL' : 'none');
      console.log('  Percentage:', d.customerGets?.value?.percentage);
      console.log('  Amount:', d.customerGets?.value?.amount?.amount);
    }
    if (d.__typename === 'DiscountAutomaticBxgy') {
      console.log('  Buy qty:', d.customerBuys?.value?.quantity);
      console.log('  Buy items:', d.customerBuys?.items?.allItems ? 'ALL' : 'specific');
      console.log('  Get products:', d.customerGets?.items?.products?.nodes?.map(p => p.title).join(', ') || 'none');
      console.log('  Get qty:', d.customerGets?.value?.quantity?.quantity);
      console.log('  Get effect %:', d.customerGets?.value?.effect?.percentage);
    }
  }
  if (data.errors) console.log('\nErrors:', JSON.stringify(data.errors, null, 2));
  await p.$disconnect();
})();
