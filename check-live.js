var fs = require('fs');
var https = require('https');
var env = {};
try {
  var lines = fs.readFileSync('C:/\u05D9\u05D5\u05E0\u05D9/\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D5\u05EA/Eleganto AI customer support/app/.env', 'utf8').split('\n');
  for (var l of lines) { var m = l.match(/^([A-Z_]+)=(.*)/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').trim(); }
} catch(e) {}
var body = JSON.stringify({ client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET, grant_type: 'client_credentials' });
var req = https.request({ hostname: 'eleganto-3011.myshopify.com', path: '/admin/oauth/access_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
  var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
    var token = JSON.parse(d).access_token;
    var req2 = https.request({ hostname: 'eleganto-3011.myshopify.com', path: '/admin/api/2025-01/themes/158546952443/assets.json?asset[key]=assets/custom-cart-drawer.js', method: 'GET', headers: { 'X-Shopify-Access-Token': token } }, function(res2) {
      var d2 = ''; res2.on('data', function(c) { d2 += c; }); res2.on('end', function() {
        var asset = JSON.parse(d2).asset;
        var val = asset.value;
        console.log('Has case guard:', val.indexOf('GUARD: If someone got qty') > -1);
        console.log('Has sticky logic:', val.indexOf('STICKY LOGIC') > -1);
        console.log('Has Gift case guard:', val.indexOf('Gift case guard') > -1);
        console.log('JS length on LIVE:', val.length);
        console.log('JS length LOCAL:', fs.readFileSync('v14-complete.js', 'utf8').length);
      });
    }); req2.end();
  });
}); req.write(body); req.end();
