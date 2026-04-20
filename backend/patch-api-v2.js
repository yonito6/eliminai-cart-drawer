const fs = require('fs');
const file = 'src/app/api/stores/[id]/gift-discounts/route.ts';
let code = fs.readFileSync(file, 'utf8');

// Normalize line endings for matching
let lf = code.replace(/\r\n/g, '\n');

// Find the section between "// 4. Recreate" and "// 5. Store gift discount"
const start = lf.indexOf('    // 4. Recreate with correct types');
const end = lf.indexOf('    // 5. Store gift discount codes');

if (start < 0 || end < 0) {
  console.log('ERROR: Section markers not found. start=' + start + ' end=' + end);
  process.exit(1);
}

const oldSection = lf.substring(start, end);
console.log('Found section (' + oldSection.length + ' chars)');

const newSection = `    // 4. Recreate as CODE discounts (one per gift product).
    // IMPORTANT: Cannot use automatic BXGY because stores already have their own
    // automatic BXGY discounts (e.g. "1+2 FREE") and Shopify can't stack them.
    // Code discounts are applied via /discount/CODE1,CODE2?redirect=/checkout.
    const results: { tier: number; handle: string; title: string; gid: string; discountId: string; type: 'code'; code: string }[] = [];
    const giftCodes: string[] = [];
    const errors: any[] = [];

    for (const want of desired) {
      const codeResult = await createCodeDiscount(
        store.shopDomain, token, want.productGid, want.tierGoal, want.tierNumber, [],
      );

      if (codeResult?.error) {
        errors.push({ handle: want.handle, error: codeResult.error });
      } else if (codeResult?.id) {
        const discountCode = (codeResult as any).code;
        giftCodes.push(discountCode);
        results.push({
          tier: want.tierGoal, handle: want.handle, title: want.title,
          gid: want.productGid, discountId: codeResult.id as string, type: 'code', code: discountCode,
        });
      }
    }

`;

lf = lf.substring(0, start) + newSection + lf.substring(end);

// Convert back to CRLF (Windows)
const result = lf.replace(/\n/g, '\r\n');
fs.writeFileSync(file, result);
console.log('Patched: automatic BXGY -> code discounts per gift');
console.log('File size:', result.length);
