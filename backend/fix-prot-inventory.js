const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fix() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { shopDomain: true, accessToken: true }
  });
  if (!store || !store.accessToken) { console.log('No token'); return; }

  // First get the inventory_item_id
  const varRes = await fetch('https://eliminai-test.myshopify.com/admin/api/2025-01/variants/52419785851193.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const varData = await varRes.json();
  const invItemId = varData.variant.inventory_item_id;
  console.log('Inventory item ID:', invItemId);
  console.log('Current tracking:', varData.variant.inventory_management);

  // Disable inventory tracking on the variant (services don't need inventory)
  const updateRes = await fetch('https://eliminai-test.myshopify.com/admin/api/2025-01/variants/52419785851193.json', {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      variant: {
        id: 52419785851193,
        inventory_management: null  // null = don't track inventory
      }
    })
  });
  if (!updateRes.ok) {
    console.log('Update failed:', updateRes.status, await updateRes.text());
    return;
  }
  const updated = await updateRes.json();
  console.log('Updated inventory_management:', updated.variant.inventory_management);
  console.log('Done — protection variant now has unlimited availability');
}

fix().finally(() => p.$disconnect());
