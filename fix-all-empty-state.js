const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// There are 4 places that toggle .ccd-empty display.
// ALL must use setProperty with !important to override CSS.

// Fix 1: refreshLight line ~1653 (rc === 0, show empty)
code = code.replace(
  "if (es) es.style.display = 'block';\n        if (id) id.style.display = 'none';\n        if (pb) pb.style.display = 'none';\n        if (ft) ft.style.display = 'none';\n      } else {\n        if (es) es.style.display = 'none';",
  "if (es) es.style.setProperty('display', 'flex', 'important');\n        if (id) id.style.display = 'none';\n        if (pb) pb.style.display = 'none';\n        if (ft) ft.style.display = 'none';\n      } else {\n        if (es) es.style.setProperty('display', 'none', 'important');"
);

// Fix 2: refresh line ~1764 (rc === 0, show empty) and ~1770 (hide empty)
code = code.replace(
  "if (es) es.style.display = 'block';\n          if (id) id.style.display = 'none';\n          if (pb) pb.style.display = 'none';\n          if (ft) ft.style.display = 'none';\n          protectionDone = false;\n        } else {\n          if (es) es.style.display = 'none';",
  "if (es) es.style.setProperty('display', 'flex', 'important');\n          if (id) id.style.display = 'none';\n          if (pb) pb.style.display = 'none';\n          if (ft) ft.style.display = 'none';\n          protectionDone = false;\n        } else {\n          if (es) es.style.setProperty('display', 'none', 'important');"
);

fs.writeFileSync(file, code, 'utf8');

// Verify ALL empty state toggles use setProperty
const result = fs.readFileSync(file, 'utf8');
const lines = result.split('\n');
let plain = 0, setprop = 0;
lines.forEach(function(line, i) {
  if (line.includes('ccd-empty') || (line.includes('(es)') && line.includes('display'))) {
    if (line.includes("es.style.display = ") || line.includes("es.style.display=")) {
      console.log('PLAIN (BAD) line ' + (i+1) + ': ' + line.trim());
      plain++;
    }
    if (line.includes("es.style.setProperty") || line.includes("_es.style.setProperty") || line.includes("_emptyEl.style.setProperty")) {
      console.log('setProperty (GOOD) line ' + (i+1) + ': ' + line.trim());
      setprop++;
    }
  }
});
console.log('\nPlain (bad):', plain, '| setProperty (good):', setprop);
