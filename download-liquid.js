const https = require('https');
const fs = require('fs');
const store = 'eleganto-3011.myshopify.com';
const LIVE_THEME = 158577557755;
const STAGING_THEME = 158622155003;

function loadEnv() {
  var vars = {};
  try {
    var raw = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
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
        if (res.statusCode !== 200) { console.log(key + ': ' + res.statusCode); resolve(null); return; }
        try { resolve(JSON.parse(d).asset.value); } catch(e) { resolve(null); }
      });
    }); req.on('error', function() { resolve(null); }); req.end();
  });
}

(async function() {
  var env = loadEnv();
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

  var assets = [
    'snippets/cart-drawer.liquid',
    'snippets/cart-item.liquid',
    'templates/cart.ajax.liquid'
  ];

  for (var i = 0; i < assets.length; i++) {
    var key = assets[i];
    var fname = key.replace(/\//g, '-');

    var live = await getAsset(token, LIVE_THEME, key);
    if (live) {
      fs.writeFileSync('live-' + fname, live);
      console.log('LIVE ' + key + ': ' + live.length + ' chars');
    } else {
      console.log('LIVE ' + key + ': NOT FOUND');
    }

    var staging = await getAsset(token, STAGING_THEME, key);
    if (staging) {
      fs.writeFileSync('staging-' + fname, staging);
      console.log('STAGING ' + key + ': ' + staging.length + ' chars');
    } else {
      console.log('STAGING ' + key + ': NOT FOUND');
    }
  }
})();
