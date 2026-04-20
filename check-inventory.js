const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  // Check inventory for variant 47779174023419
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/variants/47779174023419.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  var data = await res.json();
  console.log('Variant:', data.variant.title);
  console.log('Inventory policy:', data.variant.inventory_policy);
  console.log('Inventory quantity:', data.variant.inventory_quantity);
  console.log('Inventory management:', data.variant.inventory_management);
  console.log('Requires shipping:', data.variant.requires_shipping);
  
  // If inventory_policy is 'deny' and quantity is 0, it can't be added to cart
  if (data.variant.inventory_policy === 'deny' && data.variant.inventory_quantity <= 0) {
    console.log('\nWARNING: Cannot be added to cart — inventory is 0 with deny policy!');
    console.log('Fixing: setting inventory_policy to continue...');
    var fixRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/variants/47779174023419.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ variant: { id: 47779174023419, inventory_policy: 'continue' } })
    });
    var fixData = await fixRes.json();
    console.log('Fixed:', fixData.variant.inventory_policy);
  } else {
    console.log('\nOK — product can be added to cart');
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
