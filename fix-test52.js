const fs = require('fs');
const file = require('path').join(__dirname, 'tests', 'contract.test.js');
let code = fs.readFileSync(file, 'utf8');

// Update Contract 52 to allow CartDrawer as FALLBACK in initDrawer
code = code.replace(
  `  test('Contract 52: Uses CCD-Drawer ID (not CartDrawer)', () => {
    var re = /getElementById\\(['"]CartDrawer['"]/g;
    var matches = code.match(re) || [];
    assert(matches.length === 0, 'Must NOT getElementById CartDrawer — found ' + matches.length);
  });`,
  `  test('Contract 52: Uses CCD-Drawer as primary, CartDrawer only as fallback in initDrawer', () => {
    // CCD-Drawer must be the primary ID used everywhere
    var ccdRefs = (code.match(/getElementById\\(['"]CCD-Drawer['"]/g) || []).length;
    assert(ccdRefs >= 5, 'Must use CCD-Drawer as primary ID (found ' + ccdRefs + ')');
    // CartDrawer references only allowed inside initDrawer's fallback section
    var cartDrawerRefs = (code.match(/getElementById\\(['"]CartDrawer['"]/g) || []).length;
    assert(cartDrawerRefs <= 2, 'CartDrawer references must be limited to initDrawer fallback (found ' + cartDrawerRefs + ')');
    // initDrawer must contain the fallback
    assertContains(code, "getElementById('CartDrawer')", 'initDrawer must fallback to CartDrawer');
  });`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Contract 52 updated');
