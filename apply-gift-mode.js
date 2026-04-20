const fs = require('fs');

const editorPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/rewards-tier-editor.tsx';
let code = fs.readFileSync(editorPath, 'utf8');

// ═══ STEP 1: Remove the old "Let Customer Choose" toggle block (lines 912-952 area) ═══
// Find the block from the comment to the closing tag
const oldToggleStart = '                    {/* Let Customer Choose Gift';
const oldToggleEnd = '                    {/* Free Price Label';

const startIdx = code.indexOf(oldToggleStart);
const endIdx = code.indexOf(oldToggleEnd);

if (startIdx === -1 || endIdx === -1) {
  console.log('ERROR: Could not find old toggle block', startIdx, endIdx);
  process.exit(1);
}

// Remove everything from old toggle start to Free Price Label (exclusive)
code = code.substring(0, startIdx) + '\n' + code.substring(endIdx);
console.log('1. Removed old "Let Customer Choose" toggle block');

// ═══ STEP 2: Replace the subtitle + add Gift Mode selector cards ═══
const oldSubtitle = "                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: -2, marginBottom: 4 }}>Auto-added to cart when tier is reached. You can add multiple gifts.</div>";

const giftModeSelector = [
  // Subtitle
  "                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: -2, marginBottom: 4 }}>Add gifts that unlock when this tier is reached</div>",
  "                        </div>",
  "                      </div>",
  "",
  "                      {/* Gift Mode — Auto-add vs Customer Choice */}",
  "                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>",
  "                        <button",
  "                          onClick={() => onConfigChange({ giftCustomerChoice: false })}",
  "                          style={{",
  "                            flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',",
  "                            border: config.giftCustomerChoice !== true ? '2px solid #7c3aed' : '1px solid #e5e7eb',",
  "                            background: config.giftCustomerChoice !== true ? '#f5f3ff' : '#fff',",
  "                            textAlign: 'left', transition: 'all 0.15s',",
  "                          }}",
  "                        >",
  "                          <div style={{ fontSize: 12, fontWeight: 600, color: config.giftCustomerChoice !== true ? '#7c3aed' : '#374151' }}>Auto-add</div>",
  "                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Gift is added to cart automatically</div>",
  "                        </button>",
  "                        <button",
  "                          onClick={() => onConfigChange({ giftCustomerChoice: true })}",
  "                          style={{",
  "                            flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',",
  "                            border: config.giftCustomerChoice === true ? '2px solid #7c3aed' : '1px solid #e5e7eb',",
  "                            background: config.giftCustomerChoice === true ? '#f5f3ff' : '#fff',",
  "                            textAlign: 'left', transition: 'all 0.15s',",
  "                          }}",
  "                        >",
  "                          <div style={{ fontSize: 12, fontWeight: 600, color: config.giftCustomerChoice === true ? '#7c3aed' : '#374151' }}>Customer chooses</div>",
  "                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Customer picks their preferred gift</div>",
  "                        </button>",
  "                      </div>",
  "",
  "                      {/* Picker Title — shown in Customer Choice mode */}",
  "                      {config.giftCustomerChoice === true && (",
  "                        <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>",
  "                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Picker Title <span style={{ fontWeight: 400, color: '#9ca3af' }}>(shown to customer)</span></span>",
  "                          <input",
  "                            type=\"text\"",
  "                            value={config.giftPickerTitle || 'Choose your free gift'}",
  "                            onChange={e => onConfigChange({ giftPickerTitle: e.target.value })}",
  "                            placeholder=\"Choose your free gift\"",
  "                            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, color: '#374151', outline: 'none', boxSizing: 'border-box' }}",
  "                          />",
  "                        </div>",
  "                      )}",
].join('\n');

// We need to replace the old subtitle AND the closing </div></div> that follows it
// Old structure:
//   <div style={{ fontSize: 10 ...}}>Auto-added...</div>
//         </div>
//       </div>
// New structure replaces that subtitle and adds the mode selector before the gift list

const oldBlock = oldSubtitle + '\n                        </div>\n                      </div>';

if (!code.includes(oldBlock)) {
  console.log('ERROR: Could not find subtitle block to replace');
  // Try with \r\n
  const oldBlockCRLF = oldSubtitle + '\r\n                        </div>\r\n                      </div>';
  if (code.includes(oldBlockCRLF)) {
    code = code.replace(oldBlockCRLF, giftModeSelector);
    console.log('2. Gift Mode selector added (CRLF)');
  } else {
    console.log('Trying partial match...');
    if (code.includes('Auto-added to cart when tier is reached')) {
      console.log('Found the old subtitle text');
    }
    process.exit(1);
  }
} else {
  code = code.replace(oldBlock, giftModeSelector);
  console.log('2. Gift Mode selector added');
}

fs.writeFileSync(editorPath, code);
console.log('\nDone! Verifying...');

const final = fs.readFileSync(editorPath, 'utf8');
console.log('  Gift Mode cards:', final.includes('Auto-add') && final.includes('Customer chooses'));
console.log('  Picker Title input:', final.includes('Picker Title'));
console.log('  Old toggle removed:', !final.includes('Let Customer Choose Gift'));
console.log('  giftCustomerChoice used:', final.includes('giftCustomerChoice'));
