const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// FIX 1: In _doRefresh, add _userToggledOff guard to pre-set toggle
const oldPreset = "if (shouldDefaultOn && CCD.getRealCount(cart) > 0) {\n        CCD.setToggleNoTransition(true);\n      }";
const newPreset = "if (shouldDefaultOn && CCD.getRealCount(cart) > 0 && !_userToggledOff) {\n        CCD.setToggleNoTransition(true);\n      }";

if (code.includes(oldPreset)) {
  code = code.replace(oldPreset, newPreset);
  fixes++;
  console.log('1. Fixed _doRefresh pre-set toggle — added _userToggledOff guard');
} else {
  console.log('1. SKIP — _doRefresh pre-set already fixed or not found');
}

// VERIFY: refreshLight already has the guard (line 2406)
if (code.includes('!_userToggledOff && !protItem && CCD.getRealCount(cart) > 0')) {
  console.log('2. VERIFIED — refreshLight already checks _userToggledOff');
} else {
  console.log('2. WARNING — refreshLight guard not found, check manually');
}

if (fixes > 0) {
  fs.writeFileSync('v14-complete.js', code);
  console.log('\n' + fixes + ' fix(es) applied.');
} else {
  console.log('\nNo changes needed.');
}
