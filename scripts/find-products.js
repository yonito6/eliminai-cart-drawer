var PrismaClient = require('../backend/node_modules/@prisma/client').PrismaClient;
var p = new PrismaClient();
p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } }).then(function(s) {
  return fetch('https://'+s.shopDomain+'/admin/api/2025-01/products.json?title=Eleganto&status=active&limit=10&fields=id,title,handle,variants', { headers: { 'X-Shopify-Access-Token': s.accessToken } }).then(function(r){return r.json()});
}).then(function(d){
  d.products.forEach(function(pr){ console.log(pr.title+' | '+pr.handle+' | $'+pr.variants[0].price) });
  // Also test the exact scenario: add Luxe + Barrel via storefront API
  var luxe = d.products.find(function(pr) { return pr.title.toLowerCase().indexOf('luxe') !== -1; });
  var barrel = d.products.find(function(pr) { return pr.title.toLowerCase().indexOf('barrel') !== -1; });
  if (luxe) console.log('\nLuxe variant:', luxe.variants[0].id, 'price:', luxe.variants[0].price);
  if (barrel) console.log('Barrel variant:', barrel.variants[0].id, 'price:', barrel.variants[0].price);
  p.$disconnect();
}).catch(function(e){ console.error(e); p.$disconnect(); });
