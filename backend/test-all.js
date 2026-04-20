const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  
  // Try creating a test discount with all: true
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation($d: DiscountAutomaticBxgyInput!) { discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) { automaticDiscountNode { id } userErrors { field message } } }',
      variables: {
        d: {
          title: 'TEST ALL ITEMS',
          startsAt: new Date().toISOString(),
          customerBuys: {
            items: { all: true },
            value: { quantity: "2" }
          },
          customerGets: {
            items: { products: { productsToAdd: ['gid://shopify/Product/10168411947321'] } },
            value: { discountOnQuantity: { quantity: "1", effect: { percentage: 1.0 } } }
          },
          combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true }
        }
      }
    })
  });
  var data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  // If it worked, delete it immediately
  if (data.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.id) {
    var id = data.data.discountAutomaticBxgyCreate.automaticDiscountNode.id;
    console.log('Success! Deleting test discount...');
    await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
        variables: { id: id }
      })
    });
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
