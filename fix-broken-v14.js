const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/v14-complete.js';
let code = fs.readFileSync(path, 'utf8');
const lines = code.split('\n');

// Find key line numbers
let brokenStart = -1;
let hidePickerLine = -1;
let checkWatchLines = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('_showGiftPicker: function(options, shouldHave)') && brokenStart === -1) {
    brokenStart = i;
  }
  if (lines[i].includes('_hideGiftPicker: function()')) {
    hidePickerLine = i;
  }
  if (lines[i].trim().startsWith('checkWatchCase: function(cart)')) {
    checkWatchLines.push(i);
  }
}

console.log('Broken _showGiftPicker starts at line:', brokenStart + 1);
console.log('_hideGiftPicker at line:', hidePickerLine + 1);
console.log('checkWatchCase definitions at lines:', checkWatchLines.map(l => l + 1));

// Show context around lines 3726-3778
console.log('\n--- Lines 3726-3780 ---');
for (let i = 3725; i < Math.min(3780, lines.length); i++) {
  console.log((i+1) + ': ' + lines[i].substring(0, 100));
}

// Show what's before the broken _showGiftPicker
console.log('\n--- Lines before brokenStart (2200-2204) ---');
for (let i = brokenStart - 4; i <= brokenStart; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
