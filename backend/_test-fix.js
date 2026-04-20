const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const domain of ['eleganto-3011.myshopify.com', 'eliminai-test.myshopify.com']) {
    const store = await p.store.findUnique({ where: { shopDomain: domain }, select: { id: true, accessToken: true } });
    if (!store) { console.log(domain, 'NOT FOUND'); continue; }
    console.log(domain, '=> ID:', store.id);
    const res = await fetch('https://' + domain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ products(first:3, query:"status:active") { edges { node { title featuredImage { url } variants(first:1) { edges { node { title price } } } } } } }' }),
    });
    const data = await res.json();
    const edges = data?.data?.products?.edges || [];
    console.log('  Products:', edges.length);
    edges.forEach(e => {
      const n = e.node;
      console.log('   -', n.title, '| img:', n.featuredImage?.url ? 'YES' : 'NONE', '| price:', n.variants?.edges?.[0]?.node?.price);
    });
    if (data.errors) console.log('  ERRORS:', JSON.stringify(data.errors));
  }
  await p.$disconnect();
})();
