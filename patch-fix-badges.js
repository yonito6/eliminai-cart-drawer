const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// Fix 1: _renderDiscountBadges should only show badges when discount amount > 0
// Current: shows badge for ALL line_level_discount_allocations regardless of amount
// Fix: skip allocations where amount is 0

const oldBadge = `    _renderDiscountBadges: function(item) {
      if (!item.line_level_discount_allocations || !item.line_level_discount_allocations.length) return '';
      var html = '';
      for (var i = 0; i < item.line_level_discount_allocations.length; i++) {
        var da = item.line_level_discount_allocations[i];
        var title = da.discount_application ? da.discount_application.title : '';
        if (!title) continue;`;

const newBadge = `    _renderDiscountBadges: function(item) {
      if (!item.line_level_discount_allocations || !item.line_level_discount_allocations.length) return '';
      var html = '';
      for (var i = 0; i < item.line_level_discount_allocations.length; i++) {
        var da = item.line_level_discount_allocations[i];
        var title = da.discount_application ? da.discount_application.title : '';
        if (!title) continue;
        // Only show badge if discount actually applies to this item (amount > 0)
        if (!da.amount || parseInt(da.amount, 10) <= 0) continue;`;

if (code.includes(oldBadge)) {
  code = code.replace(oldBadge, newBadge);
  fixes++;
  console.log('Fix 1: badges now only show when discount amount > 0');
} else {
  console.log('Fix 1: badge pattern not found');
}

// Fix 2: Also apply the filter to renderItemHTML's hasDiscount check
// to use item.discounts (which is used for showFree logic)
// Current line 547: var hasDiscount = item.discounts && item.discounts.length > 0;
// This should also check if any discount has amount > 0
const oldHasDiscount = 'var hasDiscount = item.discounts && item.discounts.length > 0;';
const newHasDiscount = 'var hasDiscount = item.discounts && item.discounts.some(function(d) { return d.amount > 0; });';
if (code.includes(oldHasDiscount)) {
  code = code.replace(oldHasDiscount, newHasDiscount);
  fixes++;
  console.log('Fix 2: hasDiscount now checks amount > 0');
} else {
  console.log('Fix 2: hasDiscount pattern not found');
}

fs.writeFileSync('v14-complete.js', code);
console.log('Applied', fixes, 'fixes');
