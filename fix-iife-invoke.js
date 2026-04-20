const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Fix: The IIFE in refresh() is never invoked — (function() { ... }); should be (function() { ... })();
// The closing }); on line ~1977 needs to be })();
// But actually, the cleanest fix is to just remove the IIFE wrapper entirely —
// there's no reason to wrap this code in an IIFE since it's already inside refresh()

// Replace the opening of the IIFE
code = code.replace(
  `      // Self-rendered: build items from JSON, no theme HTML dependency
      (function() {`,
  `      // Self-rendered: build items from JSON, no theme HTML dependency`
);

// Replace the closing }); of the IIFE — need to match carefully
// The IIFE closes right after checkOverflow() and before the refresh function's closing },
code = code.replace(
  `        CCD.checkWatchCase(cart);
        CCD.checkOverflow();
      });
    },`,
  `        CCD.checkWatchCase(cart);
        CCD.checkOverflow();
    },`
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
console.log('IIFE removed:', !result.includes('(function() {'));
// Check that the self-rendered code still exists
console.log('buildCartItemsContainer call:', result.includes('CCD.buildCartItemsContainer(cart)'));
console.log('morphDOM call:', result.includes('CCD.morphDOM(pc, ni)'));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
