const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
const origLen = code.length;

// Fix BOTH protection qty>1 enforcers to use _origFetch
// These use bare `fetch` which goes through the interceptor, causing a
// second protection add (interceptor sees protection at qty=1 and tries to
// add it again, resulting in 2 protection items = $10 instead of $4.99)

const oldProt = "      if (protItem && protItem.quantity > 1) {\n        fetch('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });";

const newProt = "      if (protItem && protItem.quantity > 1) {\n        var _oFP = CCD._origFetch || fetch;\n        _oFP('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });";

let count = 0;
while (code.includes(oldProt)) {
  code = code.replace(oldProt, newProt);
  count++;
}

if (count === 0) {
  console.log('ERROR: Protection qty>1 enforcer not found');
  process.exit(1);
}

fs.writeFileSync('v14-complete.js', code);
console.log('Fixed ' + count + ' protection qty>1 enforcers to use _origFetch');
console.log('File size: ' + origLen + ' -> ' + code.length);
