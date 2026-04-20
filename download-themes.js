const https = require('https');
const fs = require('fs');
const store = 'eleganto-3011.myshopify.com';
const LIVE_THEME = 158577557755;
const STAGING_THEME = 158622155003;

function loadEnv() {
  const vars = {};
  try {
    const raw = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
    raw.split('\n').forEach(function(line) {
      var m = line.match(/^([A-Z_]+)=(.*)/);
      if (m) vars[m[1]] = m[2].replace(/^"|"$/g, '').trim();
    });
  } catch(e) {}
  return vars;
}

function getToken(cid, csec) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });
    var req = https.request({ hostname: store, path: '/admin/oauth/access_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        if (res.statusCode !== 200) { reject(new Error('OAuth: ' + res.statusCode)); return; }
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

function getAsset(token, themeId, key) {
  return new Promise(function(resolve, reject) {
    var path = '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=' + encodeURIComponent(key);
    var req = https.request({ hostname: store, path: path, method: 'GET', headers: { 'X-Shopify-Access-Token': token } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        if (res.statusCode !== 200) { resolve(null); return; }
        try { resolve(JSON.parse(d).asset.value); } catch(e) { resolve(null); }
      });
    }); req.on('error', function() { resolve(null); }); req.end();
  });
}

(async function() {
  var env = loadEnv();
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

  console.log('Downloading LIVE theme assets...');
  var liveJs = await getAsset(token, LIVE_THEME, 'assets/custom-cart-drawer.js');
  var liveCss = await getAsset(token, LIVE_THEME, 'assets/custom-cart-drawer.css');

  if (liveJs) { fs.writeFileSync('live-cart-drawer.js', liveJs); console.log('LIVE JS: ' + liveJs.length + ' chars'); }
  else console.log('LIVE JS: NOT FOUND');
  if (liveCss) { fs.writeFileSync('live-cart-drawer.css', liveCss); console.log('LIVE CSS: ' + liveCss.length + ' chars'); }
  else console.log('LIVE CSS: NOT FOUND');

  console.log('Downloading STAGING theme assets...');
  var stagingJs = await getAsset(token, STAGING_THEME, 'assets/custom-cart-drawer.js');
  var stagingCss = await getAsset(token, STAGING_THEME, 'assets/custom-cart-drawer.css');

  if (stagingJs) { fs.writeFileSync('staging-cart-drawer.js', stagingJs); console.log('STAGING JS: ' + stagingJs.length + ' chars'); }
  else console.log('STAGING JS: NOT FOUND');
  if (stagingCss) { fs.writeFileSync('staging-cart-drawer.css', stagingCss); console.log('STAGING CSS: ' + stagingCss.length + ' chars'); }
  else console.log('STAGING CSS: NOT FOUND');
})();
