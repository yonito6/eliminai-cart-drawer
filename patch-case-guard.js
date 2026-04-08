var fs = require('fs');
var code = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add fetch interceptor to block adding case when already in cart
var marker1 = "          return origFetch.call(this, url, opts).then(function(resp) {";
var guardCode = [
  "",
  "          // Gift case guard: block adding case if already in cart",
  "          try {",
  "            var addBody = JSON.parse(opts.body);",
  "            var addList = addBody.items || [addBody];",
  "            var caseAlreadyInCart = CCD._caseKey != null;",
  "            var tryingToAddCase = addList.some(function(ai) {",
  "              return parseInt(ai.id) === WATCH_CASE_VID || String(ai.id) === String(WATCH_CASE_VID);",
  "            });",
  "            if (caseAlreadyInCart && tryingToAddCase) {",
  "              return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));",
  "            }",
  "          } catch(caseEx) {}",
  "",
  marker1
].join("\n");

if (code.indexOf("Gift case guard") !== -1) {
  console.log("Guard already added, skipping");
} else if (code.indexOf(marker1) === -1) {
  console.log("ERROR: marker not found");
  process.exit(1);
} else {
  code = code.replace(marker1, guardCode);
  console.log("OK - fetch interceptor guard added");
}

fs.writeFileSync('v14-complete.js', code);

// Verify
var result = fs.readFileSync('v14-complete.js', 'utf8');
console.log("Has case guard:", result.indexOf("Gift case guard") !== -1);
console.log("Has qty cap:", result.indexOf("GUARD: If someone got qty > 1") !== -1);
