const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  // Get first 5 products from "All Watch" - no filter
  const r = await gql(`{
    collection(id: "gid://shopify/Collection/432470327547") {
      title
      productsCount { count }
      products(first: 5) {
        nodes {
          id title status
          variants(first: 1) {
            nodes { id title price inventoryQuantity availableForSale }
          }
        }
      }
    }
  }`);

  const coll = r?.data?.collection;
  console.log('Collection:', coll?.title, '| Products:', coll?.productsCount?.count);
  const products = coll?.products?.nodes || [];
  products.forEach(p => {
    const v = p.variants?.nodes?.[0];
    console.log('  ' + p.title + ' (' + p.status + ') | variant: ' + v?.id + ' | $' + v?.price + ' | qty: ' + v?.inventoryQuantity + ' | forSale: ' + v?.availableForSale);
  });

  // Try creating a draft order (not calculate) to test
  console.log('\n=== Trying draft order create ===');
  const draftR = await gql(`mutation {
    draftOrderCreate(input: {
      lineItems: [
        { variantId: "${products[0]?.variants?.nodes?.[0]?.id}", quantity: 1 }
        { variantId: "${products[1]?.variants?.nodes?.[0]?.id}", quantity: 1 }
        { variantId: "${products[2]?.variants?.nodes?.[0]?.id}", quantity: 1 }
        { variantId: "gid://shopify/ProductVariant/46941745742075", quantity: 1 }
      ]
    }) {
      draftOrder {
        id
        totalPriceSet { shopMoney { amount } }
        subtotalPriceSet { shopMoney { amount } }
        lineItems(first: 10) {
          nodes {
            title quantity
            originalTotalSet { shopMoney { amount } }
            discountedTotalSet { shopMoney { amount } }
            appliedDiscount { title value valueType }
          }
        }
      }
      userErrors { field message }
    }
  }`);

  if (draftR?.data?.draftOrderCreate?.userErrors?.length > 0) {
    console.log('Draft order errors:', JSON.stringify(draftR.data.draftOrderCreate.userErrors, null, 2));
  } else if (draftR?.errors) {
    console.log('GraphQL errors:', draftR.errors[0]?.message);
  } else {
    const draft = draftR?.data?.draftOrderCreate?.draftOrder;
    console.log('Total:', draft?.totalPriceSet?.shopMoney?.amount);
    console.log('Subtotal:', draft?.subtotalPriceSet?.shopMoney?.amount);
    draft?.lineItems?.nodes?.forEach(li => {
      const orig = li.originalTotalSet?.shopMoney?.amount;
      const disc = li.discountedTotalSet?.shopMoney?.amount;
      const appliedDisc = li.appliedDiscount ? ` | DISCOUNT: ${li.appliedDiscount.title} (${li.appliedDiscount.value} ${li.appliedDiscount.valueType})` : '';
      console.log('  ' + li.title + ' x' + li.quantity + ' | $' + orig + ' -> $' + disc + appliedDisc);
    });

    // Delete the draft order to clean up
    if (draft?.id) {
      await gql(`mutation { draftOrderDelete(input: { id: "${draft.id}" }) { deletedId userErrors { field message } } }`);
      console.log('Draft order deleted');
    }
  }

  await p.$disconnect();
})();
