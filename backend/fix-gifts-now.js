const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query, variables) {
  var res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function main() {
  var s = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  var domain = s.shopDomain, token = s.accessToken;

  // 1. Delete ALL existing automatic gift discounts
  console.log('Step 1: Finding existing discounts...');
  var existing = await gql(domain, token, '{ automaticDiscountNodes(first: 50, query: "title:Gift OR title:Free") { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } ... on DiscountAutomaticBasic { title } } } } }');
  var nodes = existing.data.automaticDiscountNodes.nodes;
  for (var n of nodes) {
    var title = n.automaticDiscount.title || '';
    if (title.includes('Gift') || title.includes('Free Gift')) {
      console.log('  Deleting:', n.id, title);
      await gql(domain, token, 'mutation d($id: ID!) { discountAutomaticDelete(id: $id) { userErrors { field message } } }', { id: n.id });
    }
  }

  // 2. Get all active product GIDs (for customerBuys)
  console.log('Step 2: Getting all active products...');
  var allGids = [];
  var cursor = null;
  for (var page = 0; page < 10; page++) {
    var afterClause = cursor ? ', after: "'+cursor+'"' : '';
    var prods = await gql(domain, token, '{ products(first: 50, query: "status:active"'+afterClause+') { pageInfo { hasNextPage endCursor } nodes { id } } }');
    var pnodes = prods.data.products.nodes;
    for (var pn of pnodes) allGids.push(pn.id);
    if (!prods.data.products.pageInfo.hasNextPage) break;
    cursor = prods.data.products.pageInfo.endCursor;
  }
  console.log('  Found', allGids.length, 'active products');

  // 3. The 3 gift product GIDs (verified earlier)
  var giftGids = [
    'gid://shopify/Product/10168411947321',  // Compare at Price Snowboard
    'gid://shopify/Product/10168412045625',  // Videographer Snowboard
    'gid://shopify/Product/10168411914553',  // Inventory Not Tracked Snowboard
  ];
  console.log('Step 3: Creating single BXGY discount with', giftGids.length, 'gift products...');

  // 4. Create ONE single BXGY discount
  var result = await gql(domain, token, `
    mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
        automaticDiscountNode {
          id
          automaticDiscount { ... on DiscountAutomaticBxgy { title status } }
        }
        userErrors { field message }
      }
    }
  `, {
    automaticBxgyDiscount: {
      title: 'Free Gifts',
      startsAt: new Date().toISOString(),
      customerBuys: {
        items: { products: { productsToAdd: allGids } },
        value: { quantity: "1" },
      },
      customerGets: {
        items: { products: { productsToAdd: giftGids } },
        value: { discountOnQuantity: { quantity: String(giftGids.length), effect: { percentage: 1.0 } } },
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
    },
  });

  if (result.errors) {
    console.log('GraphQL errors:', JSON.stringify(result.errors));
    return;
  }
  var userErrors = result.data.discountAutomaticBxgyCreate.userErrors;
  if (userErrors && userErrors.length > 0) {
    console.log('User errors:', JSON.stringify(userErrors));
    return;
  }
  var node = result.data.discountAutomaticBxgyCreate.automaticDiscountNode;
  console.log('SUCCESS! Created discount:', node.id, node.automaticDiscount.title, '['+node.automaticDiscount.status+']');

  // 5. Verify
  console.log('\nStep 5: Verifying...');
  var verify = await gql(domain, token, '{ automaticDiscountNodes(first: 5, query: "title:Free Gifts") { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerBuys { value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }');
  var vn = verify.data.automaticDiscountNodes.nodes[0];
  if (vn) {
    var d = vn.automaticDiscount;
    console.log('  Title:', d.title, '['+d.status+']');
    console.log('  Customer buys qty:', d.customerBuys.value.quantity);
    var giftProducts = d.customerGets.items.products.nodes;
    console.log('  Gift products ('+giftProducts.length+'):');
    for (var gp of giftProducts) console.log('    -', gp.title, gp.id);
    console.log('  Gets qty:', d.customerGets.value.quantity.quantity, 'at', (d.customerGets.value.effect.percentage*100)+'% off');
  }
}

main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
