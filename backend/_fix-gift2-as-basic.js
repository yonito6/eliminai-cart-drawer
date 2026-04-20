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

  // Step 1: Delete the old BXGY "Gift #2"
  console.log('Step 1: Deleting old BXGY "Gift #2"...');
  const delRes = await gql(`mutation {
    discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
      deletedAutomaticDiscountId
      userErrors { field message }
    }
  }`);
  const delErrors = delRes?.data?.discountAutomaticDelete?.userErrors;
  if (delErrors?.length > 0) {
    console.error('Delete errors:', JSON.stringify(delErrors));
  } else {
    console.log('Deleted:', delRes?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId || 'already gone');
  }

  // Step 2: Create new Basic automatic discount — 100% off Eleganto Case when 4+ items in cart
  console.log('\nStep 2: Creating Basic discount "Gift #2" (100% off case, min 4 items)...');
  const createRes = await gql(`mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title status
            minimumRequirement {
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              items {
                ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              }
              value { ... on DiscountPercentage { percentage } }
            }
          }
        }
      }
      userErrors { field code message }
    }
  }`, {
    automaticBasicDiscount: {
      title: "Gift #2",
      startsAt: new Date().toISOString(),
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity: "4"
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
    console.log('Created! ID:', node?.id);
    const d = node?.automaticDiscount;
    console.log('Title:', d?.title, '| Status:', d?.status);
    console.log('Min qty:', d?.minimumRequirement?.greaterThanOrEqualToQuantity);
    console.log('Products:', d?.customerGets?.items?.products?.nodes?.map(p => p.title).join(', '));
    console.log('Percentage:', d?.customerGets?.value?.percentage);
  }

  await p.$disconnect();
})();
