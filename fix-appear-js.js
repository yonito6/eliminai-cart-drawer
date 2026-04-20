const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Fix 1: Add cache-buster to CSS URL injection
code = code.replace(
  "var cssUrl = jsEl.src.replace(/v14-complete\\.js.*/, 'v14-css.css');",
  "var cssUrl = jsEl.src.replace(/v14-complete\\.js.*/, 'v14-css.css?v=' + Date.now());"
);

// Fix 2: After adding ccd-* classes in initDrawer, force-show appear-animation elements
// Find the spot right after the class mapping loop
code = code.replace(
  "el.classList.remove('drawer', 'drawer--right', 'drawer--left');",
  `el.classList.remove('drawer', 'drawer--right', 'drawer--left');
        // Kill theme appear-animation (opacity:0 + translateY:60) that won't trigger after ID rename
        el.querySelectorAll('.appear-animation').forEach(function(ae) {
          ae.style.setProperty('opacity', '1', 'important');
          ae.style.setProperty('transform', 'none', 'important');
          ae.style.setProperty('animation', 'none', 'important');
        });`
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
console.log('Cache-buster:', result.includes("'v14-css.css?v=' + Date.now()"));
console.log('appear-animation fix:', result.includes("appear-animation"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
