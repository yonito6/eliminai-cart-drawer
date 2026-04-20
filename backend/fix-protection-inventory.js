const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Fix 1: Change inventory policy to "continue" (allow overselling — it's a service product)
  console.log('Fixing protection variant inventory policy...');
  const res = await fetch(`https://${domain}/admin/api/2025-01/variants/47779174023419.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      variant: {
        id: 47779174023419,
        inventory_policy: 'continue'
      }
    })
  });
  const data = await res.json();
  console.log('Updated policy:', data.variant?.inventory_policy);
  console.log('Price:', data.variant?.price);
  console.log('Inventory:', data.variant?.inventory_quantity);

  // Fix 2: Also reset inventory to a positive number so it looks clean
  // Get the inventory item ID first
  const invRes = await fetch(`https://${domain}/admin/api/2025-01/variants/47779174023419.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const invData = await invRes.json();
  const inventoryItemId = invData.variant.inventory_item_id;
  console.log('\nInventory item ID:', inventoryItemId);

  // Get location
  const locRes = await fetch(`https://${domain}/admin/api/2025-01/locations.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const locData = await locRes.json();
  const locationId = locData.locations[0].id;
  console.log('Location ID:', locationId);

  // Set inventory to a large number
  const setRes = await fetch(`https://${domain}/admin/api/2025-01/inventory_levels/set.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: 999999
    })
  });
  const setData = await setRes.json();
  console.log('Inventory reset:', setData.inventory_level?.available);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const verifyRes = await fetch(`https://${domain}/admin/api/2025-01/variants/47779174023419.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const verifyData = await verifyRes.json();
  console.log('Policy:', verifyData.variant.inventory_policy);
  console.log('Inventory:', verifyData.variant.inventory_quantity);
  console.log('Price:', verifyData.variant.price);

  await p.$disconnect();
  console.log('\nDone! Protection should now work at checkout.');
})().catch(e => { console.error(e); process.exit(1); });
