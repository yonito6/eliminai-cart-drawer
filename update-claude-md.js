var fs = require('fs');
var content = fs.readFileSync('CLAUDE.md', 'utf8');
var startMarker = '## Store & API';
var endMarker = '## File Structure';
var startIdx = content.indexOf(startMarker);
var endIdx = content.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) { console.log('ERROR: markers not found'); process.exit(1); }

var lines = [
  '## Store & API',
  '',
  '- **Store**: eleganto-3011.myshopify.com',
  '- **API Version**: 2025-01',
  '- **Theme**: Impulse',
  '- **Auth**: OAuth Client Credentials from Eliminai app `.env` (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET). NEVER use hardcoded `shpat_` tokens.',
  '',
  '### Theme IDs',
  '| Theme | ID | Role |',
  '|---|---|---|',
  '| **Eliminai Cart Drawer Demo** | `158577557755` | **STAGING** - always deploy here |',
  '| Impulse custom claude drawer cart | `158546952443` | LIVE - only deploy when Yoni says "deploy to live" |',
  '',
  '## Staging/Live Workflow - MANDATORY',
  '',
  '**NEVER upload to the live theme unless Yoni explicitly says to.** Always upload to the Demo/Staging theme.',
  '',
  '1. **Develop** - edit files locally, syntax check',
  '2. **Upload to STAGING** (`node upload-v14.js`) - uploads to Demo theme by default',
  '3. **Yoni tests** - previews the demo theme on the store',
  '4. **Yoni approves** - publishes the demo theme as live, then duplicates a new demo theme',
  '5. **Upload to LIVE** - ONLY when Yoni says. Use: `node upload-v14.js --live`',
  '',
  '### Version History - Git Tags',
  '',
  '**Every upload MUST be preceded by a git commit + tag** so we can always trace and roll back.',
  '',
  '- Before uploading, commit all changes with a descriptive message',
  '- Tag format: `v14.XX-description` (e.g., `v14.15-case-qty-guard`)',
  '- To see all versions: `git log --oneline --tags`',
  '- To see what changed: `git diff v14.15..v14.16`',
  '- To roll back: checkout the old tag, upload those files',
  '',
  '**If something breaks:**',
  '1. `git log --oneline` - find the last working version',
  '2. `git diff v14.XX..v14.YY` - see exactly what changed',
  '3. `git checkout v14.XX -- v14-complete.js` - restore that file',
  '4. Upload the restored version to staging, verify, then go live',
  '',
  '',
];

var newSection = lines.join('\r\n');
content = content.substring(0, startIdx) + newSection + content.substring(endIdx);
fs.writeFileSync('CLAUDE.md', content);
console.log('CLAUDE.md updated successfully');
