const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// The broken part starts after the trust-text line and ends before .ccd-overlay
// We need to replace the multi-line string literals with proper \n concatenation

const newSkeletonCSS = 
      "'.ccd-trust-text { font-size: 11px !important; color: var(--ccd-text-muted, #999) !important; letter-spacing: 0.02em !important; }\n' +\n" +
      "      '@keyframes ccdShimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }\n' +\n" +
      "      '.ccd-skeleton { display: flex; gap: 12px; padding: 12px 16px; }\n' +\n" +
      "      '.ccd-skeleton__img { width: 64px; height: 64px; border-radius: 8px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; flex-shrink: 0; }\n' +\n" +
      "      '.ccd-skeleton__lines { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }\n' +\n" +
      "      '.ccd-skeleton__line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }\n' +\n" +
      "      '.ccd-skeleton__line--short { width: 60%; }\n' +\n" +
      "      '.ccd-skeleton__line--medium { width: 80%; }\n' +\n" +
      "      '.ccd-skeleton__footer { padding: 12px 16px; }\n' +\n" +
      "      '.ccd-skeleton__btn { height: 48px; border-radius: 8px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }\n' +\n" +
      "      '.ccd-skeleton__progress { height: 32px; margin: 0 16px 8px; border-radius: 6px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }\n' +\n" +
      "      '.ccd-loading-skeleton { display: block; }\n' +\n" +
      "      '.ccd-overlay";

// Find the broken block - from trust-text line to .ccd-overlay
// Match everything from trust-text CSS rule through to .ccd-overlay
const regex = /'\.ccd-trust-text \{[^}]+\}\n' \+\s*\n\s*'@keyframes ccdShimmer[\s\S]*?'\.ccd-overlay/;
const match = code.match(regex);

if (match) {
  console.log('Found broken block, length:', match[0].length);
  code = code.replace(match[0], newSkeletonCSS);
  fs.writeFileSync('v14-complete.js', code);
  console.log('Fixed! File written.');
} else {
  console.log('Pattern not found, trying alternative approach...');
  // Let's find the exact boundaries
  const trustTextIdx = code.indexOf("'.ccd-trust-text {");
  const overlayIdx = code.indexOf("'.ccd-overlay", trustTextIdx + 100);
  console.log('trust-text at:', trustTextIdx);
  console.log('overlay at:', overlayIdx);
  if (trustTextIdx > 0 && overlayIdx > trustTextIdx) {
    const block = code.substring(trustTextIdx, overlayIdx);
    console.log('Block preview (first 200):', block.substring(0, 200));
    console.log('Block preview (last 100):', block.substring(block.length - 100));
  }
}
