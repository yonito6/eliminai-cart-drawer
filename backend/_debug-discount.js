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

  // 1. Check if Eleganto Case (8959501435131) is in the "All Watch" collection
  console.log('=== Is Eleganto Case in "All Watch" collection? ===');
  const caseData = await gql(`{
    product(id: "gid://shopify/Product/8959501435131") {
      title status
      collections(first: 10) { nodes { id title } }
    }
  }`);
  const caseProduct = caseData?.data?.product;
  console.log('Product:', caseProduct?.title, '| Status:', caseProduct?.status);
  console.log('Collections:', caseProduct?.collections?.nodes?.map(c => c.title).join(', ') || 'NONE');

  const isInAllWatch = caseProduct?.collections?.nodes?.some(c => c.id === 'gid://shopify/Collection/432470327547');
  console.log('In "All Watch"?', isInAllWatch ? 'YES (could be an issue)' : 'NO (good)');

  // 2. Check full Gift #2 discount details including all conditions
  console.log('\n=== Full Gift #2 discount details ===');
  const discData = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status startsAt endsAt
          combinesWith { productDiscounts orderDiscounts shippingDiscounts }
          customerBuys {
            items {
              ... on DiscountCollections { collections(first: 5) { nodes { id title } } }
              ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              ... on AllDiscountItems { allItems }
            }
            value { ... on DiscountQuantity { quantity } ... on DiscountPurchaseAmount { amount } }
          }
          customerGets {
            items {
              ... on DiscountProducts { products(first: 5) { nodes { id title status } } productVariants(first: 5) { nodes { id title } } }
            }
            value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
          }
          usesPerOrderLimit
          asyncUsageCount
        }
      }
    }
  }`);
  const disc = discData?.data?.automaticDiscountNode?.automaticDiscount;
  console.log(JSON.stringify(disc, null, 2));

  // 3. Check if Eleganto Case product is ACTIVE and has the right variant
  console.log('\n=== Eleganto Case product details ===');
  const prodData = await gql(`{
    product(id: "gid://shopify/Product/8959501435131") {
      title status
      variants(first: 5) { nodes { id title price inventoryQuantity } }
    }
  }`);
  console.log(JSON.stringify(prodData?.data?.product, null, 2));

  // 4. Check "Watch Oganizer" discount — does it conflict?
  console.log('\n=== Watch Oganizer discount (potential conflict) ===');
  const wo = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status
          customerBuys {
            items { ... on DiscountCollections { collections(first: 5) { nodes { title } } } }
            value { ... on DiscountQuantity { quantity } }
          }
          customerGets {
            items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } }
            value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
          }
        }
      }
    }
  }`);
  const woDisc = wo?.data?.automaticDiscountNode?.automaticDiscount;
  console.log(JSON.stringify(woDisc, null, 2));

  await p.$disconnect();
})();
