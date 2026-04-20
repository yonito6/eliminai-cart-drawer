const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const token = store.accessToken;
  const domain = store.shopDomain;

  // Check product by handle
  const res = await fetch(`https://${domain}/admin/api/2025-01/products.json?handle=geotrianglenecklace&fields=id,title,status,variants`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  console.log('Product data:', JSON.stringify(data, null, 2));

  // Also check variant directly
  const vRes = await fetch(`https://${domain}/admin/api/2025-01/variants/43471586820347.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  console.log('Variant status:', vRes.status);
  if (vRes.ok) {
    const vData = await vRes.json();
    console.log('Variant:', JSON.stringify(vData.variant, null, 2));
  } else {
    console.log('Variant response:', await vRes.text());
  }

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
