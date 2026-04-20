const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');

// Add gift variant block to form submit handler, right after scarcity check
const afterScarcityForm = `        if (formVid === sVid) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || "Only 1 left — already in your cart!");
          return;
        }
      }, true); // useCapture=true to fire BEFORE theme handlers`;

const withGiftFormBlock = `        if (formVid === sVid) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || "Only 1 left — already in your cart!");
          return;
        }
      }, true); // useCapture=true to fire BEFORE theme handlers

      // GUARD: Block form-based adds of gift variants
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;
        var vidInput = form.querySelector("input[name=id], select[name=id]");
        var formVid = vidInput ? String(vidInput.value) : null;
        if (formVid && GIFT_VIDS[formVid]) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast("This gift is automatically added when you qualify \u2728");
        }
      }, true);`;

if (code.includes(afterScarcityForm)) {
  code = code.replace(afterScarcityForm, withGiftFormBlock);
  fs.writeFileSync(file, code);
  console.log('PATCHED: Added gift block to form submit handler');
} else {
  console.log('SKIP: Could not find form submit scarcity block');
}
