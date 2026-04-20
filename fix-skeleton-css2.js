const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

const trustTextIdx = code.indexOf("'.ccd-trust-text {");
const overlayIdx = code.indexOf("'.ccd-overlay", trustTextIdx + 100);

if (trustTextIdx > 0 && overlayIdx > trustTextIdx) {
  const before = code.substring(0, trustTextIdx);
  const after = code.substring(overlayIdx);
  
  const replacement = 
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
    "      ";

  code = before + replacement + after;
  fs.writeFileSync('v14-complete.js', code);
  console.log('Fixed! Replaced', (overlayIdx - trustTextIdx), 'chars');
} else {
  console.log('ERROR: Could not find boundaries');
}
