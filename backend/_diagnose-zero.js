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

  // Check "1+1 FREE" — does it have usesPerOrderLimit?
  console.log('=== 1+1 FREE details ===');
  const d1 = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1622934880507") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status usesPerOrderLimit
          customerBuys { value { ... on DiscountQuantity { quantity } } }
          customerGets { value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } } }
        }
      }
    }
  }`);
  const bxgy1 = d1?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('Title:', bxgy1?.title);
  console.log('Buy qty:', bxgy1?.customerBuys?.value?.quantity);
  console.log('Get qty:', bxgy1?.customerGets?.value?.quantity?.quantity);
  console.log('Get %:', bxgy1?.customerGets?.value?.effect?.percentage);
  console.log('Uses per order limit:', bxgy1?.usesPerOrderLimit);

  // Check "1+2 FREE"
  console.log('\n=== 1+2 FREE details ===');
  const d2 = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787605647611") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title status usesPerOrderLimit
          customerBuys { value { ... on DiscountQuantity { quantity } } }
          customerGets { value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } } }
        }
      }
    }
  }`);
  const bxgy2 = d2?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('Title:', bxgy2?.title);
  console.log('Buy qty:', bxgy2?.customerBuys?.value?.quantity);
  console.log('Get qty:', bxgy2?.customerGets?.value?.quantity?.quantity);
  console.log('Get %:', bxgy2?.customerGets?.value?.effect?.percentage);
  console.log('Uses per order limit:', bxgy2?.usesPerOrderLimit);

  // With 2 watches:
  // 1+1 FREE (buy 1, get 1 free, unlimited): watch A is buy, watch B is free
  // 1+2 FREE (buy 1, get 2 free, unlimited): needs 3 items (1+2), only 2 available
  // But if BOTH 1+1 and 1+2 combine...
  // 1+1 uses: 1 buy + 1 get = 2 watches
  // Then 1+2 can't fire (0 watches left)
  // Total should be: 1 watch price, not $0

  console.log('\n=== Scenario with 2 watches ===');
  console.log('1+1 FREE: buy 1, get 1 free → uses both watches. Total = 1 watch price.');
  console.log('1+2 FREE: needs 3 items → cannot fire.');
  console.log('Expected total: ~$130-140, NOT $0');
  console.log('\nIf checkout shows $0, something else is wrong.');

  // Check "sun and moon" discount
  console.log('\n=== sun and moon details ===');
  const sm = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1445180309755") {
      automaticDiscount {
        ... on DiscountAutomaticBasic {
          title status
          minimumRequirement {
            ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
          }
          customerGets {
            items {
              ... on AllDiscountItems { allItems }
              ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              ... on DiscountCollections { collections(first: 5) { nodes { id title } } }
            }
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
            }
          }
        }
      }
    }
  }`);
  console.log(JSON.stringify(sm?.data?.automaticDiscountNode?.automaticDiscount, null, 2));

  await p.$disconnect();
})();
