const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  var numericId = '9001277718779';
  
  // Re-publish the product to Online Store
  console.log('Re-publishing Shipping Protection to Online Store...');
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/products/' + numericId + '.json', {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product: {
        id: parseInt(numericId),
        published: true
      }
    })
  });
  var data = await res.json();
  if (data.product) {
    console.log('DONE!');
    console.log('Title:', data.product.title);
    console.log('Status:', data.product.status);
    console.log('Published at:', data.product.published_at);
  } else {
    console.log('ERROR:', JSON.stringify(data));
  }
  
  // Verify it can be found via storefront
  console.log('\nVerifying variant is accessible...');
  var varRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/products/' + numericId + '.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var varData = await varRes.json();
  console.log('Variant ID:', varData.product.variants[0].id);
  console.log('Price: $' + varData.product.variants[0].price);
  console.log('Available:', varData.product.variants[0].inventory_quantity > 0 || varData.product.variants[0].inventory_policy === 'continue' ? 'YES' : 'CHECK INVENTORY');
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
