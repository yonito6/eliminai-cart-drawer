const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Add a version stamp that's visible in the console AND on the page
// This will tell us definitively if the latest code is loaded

const oldInit = `    init: function() {
      this.fixMobileWidth();`;

const newInit = `    init: function() {
      // VERSION STAMP — remove after debugging
      console.log('%c[CCD v14.7] Cart drawer loaded', 'background:#6b21a8;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
      window.__ccd_version = '14.7';
      this.fixMobileWidth();`;

if (code.indexOf(oldInit) !== -1) {
  code = code.replace(oldInit, newInit);
  console.log('Added version stamp (LF)');
} else {
  const oldCR = oldInit.replace(/\n/g, '\r\n');
  const newCR = newInit.replace(/\n/g, '\r\n');
  if (code.indexOf(oldCR) !== -1) {
    code = code.replace(oldCR, newCR);
    console.log('Added version stamp (CRLF)');
  } else {
    console.log('ERROR: init not found');
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
