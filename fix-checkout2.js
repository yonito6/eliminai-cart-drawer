const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// Add fallback /checkout redirect when no gift in cart
const old = `          if (hasGift) {
            e.preventDefault();
            e.stopPropagation();
            var codes = GIFT_DISCOUNT_CODES.length > 0 ? GIFT_DISCOUNT_CODES.join(',') : '';
            window.location.href = codes ? '/discount/' + codes + '?redirect=/checkout' : '/checkout';
            return;
          }
        }
      });`;

const fixed = `          if (hasGift) {
            e.preventDefault();
            e.stopPropagation();
            var codes = GIFT_DISCOUNT_CODES.length > 0 ? GIFT_DISCOUNT_CODES.join(',') : '';
            window.location.href = codes ? '/discount/' + codes + '?redirect=/checkout' : '/checkout';
            return;
          }
          // No gift — go straight to checkout
          window.location.href = '/checkout';
        }
      });`;

if (js.includes(old)) {
  js = js.replace(old, fixed);
  console.log('OK: added fallback /checkout redirect');
} else {
  console.log('FAILED: pattern not found');
}

fs.writeFileSync('v14-complete.js', js);
console.log('Done');
