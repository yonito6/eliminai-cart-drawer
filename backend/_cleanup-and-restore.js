const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query, variables) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  };

  // Step 1: List ALL automatic discounts (active AND inactive)
  console.log('=== ALL Automatic Discounts ===');
  const all = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          __typename
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticFreeShipping { title status }
        }
      }
    }
  }`);
  const nodes = all?.data?.automaticDiscountNodes?.nodes || [];
  nodes.forEach(n => {
    const d = n.automaticDiscount;
    console.log('  ' + d.__typename + ': "' + d.title + '" (' + d.status + ') — ' + n.id);
  });

  // Step 2: Delete any "Gift #2" or duplicate case discounts
  const toDelete = nodes.filter(n => {
    const title = n.automaticDiscount.title || '';
    return title === 'Gift #2' || title === 'Eliminai Gift — Eleganto Case';
  });

  if (toDelete.length > 0) {
    console.log('\nStep 2: Deleting', toDelete.length, 'case-related discounts...');
    for (const n of toDelete) {
      const r = await gql(`mutation { discountAutomaticDelete(id: "${n.id}") { deletedAutomaticDiscountId userErrors { field message } } }`);
      console.log('  Deleted:', n.automaticDiscount.title, '(' + n.id + ')', r?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId ? 'OK' : 'FAILED');
    }
  } else {
    console.log('\nNo case discounts to delete');
  }

  // Step 3: Recreate the ORIGINAL working discount — Basic type
  console.log('\nStep 3: Creating original Basic discount...');
  const createRes = await gql(`mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title status
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            minimumRequirement { ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity } }
            customerGets {
              items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } }
              value { ... on DiscountPercentage { percentage } }
            }
          }
        }
      }
      userErrors { field message code }
    }
  }`, {
    automaticBasicDiscount: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity: "3"
        }
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        },
        value: {
          percentage: 1.0
        }
      }
    }
  });

  if (createRes?.data?.discountAutomaticBasicCreate?.userErrors?.length > 0) {
    console.error('Create errors:', JSON.stringify(createRes.data.discountAutomaticBasicCreate.userErrors, null, 2));
  } else if (createRes?.errors) {
    console.error('GraphQL errors:', JSON.stringify(createRes.errors, null, 2));
  } else {
    const node = createRes?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
    const d = node?.automaticDiscount;
    console.log('Created! ID:', node?.id);
    console.log('Title:', d?.title, '| Status:', d?.status);
    console.log('Min qty:', d?.minimumRequirement?.greaterThanOrEqualToQuantity);
    console.log('Products:', d?.customerGets?.items?.products?.nodes?.map(p => p.title).join(', '));
    console.log('Percentage:', d?.customerGets?.value?.percentage);
    console.log('Combines:', JSON.stringify(d?.combinesWith));
  }

  // Step 4: Final verification
  console.log('\n=== Final State ===');
  const final = await gql(`{
    automaticDiscountNodes(first: 50, query: "status:active") {
      nodes {
        id
        automaticDiscount {
          __typename
          ... on DiscountAutomaticBasic { title status }
          ... on DiscountAutomaticBxgy { title status }
          ... on DiscountAutomaticFreeShipping { title status }
        }
      }
    }
  }`);
  final?.data?.automaticDiscountNodes?.nodes?.forEach(n => {
    const d = n.automaticDiscount;
    console.log('  ' + d.__typename + ': "' + d.title + '" (' + d.status + ') — ' + n.id);
  });

  await p.$disconnect();
})();
