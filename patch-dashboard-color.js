const fs = require('fs');
const filePath = 'backend/src/app/dashboard/addons/rewards-tier-editor.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const oldBlock = `                        <input
                          type="text"
                          value={config.freePriceLabel ?? 'Free'}
                          onChange={e => onConfigChange({ freePriceLabel: e.target.value })}
                          placeholder="Free"
                          style={{ ...inputStyle }}
                        />
                      </div>
                    )}`;

const newBlock = `                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              value={config.freePriceLabel ?? 'Free'}
                              onChange={e => onConfigChange({ freePriceLabel: e.target.value })}
                              placeholder="Free"
                              style={{ ...inputStyle }}
                            />
                          </div>
                          <div>
                            <span style={{ ...labelStyle, marginBottom: 2 }}>Color</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="color"
                                value={config.freePriceColor ?? '#111111'}
                                onChange={e => onConfigChange({ freePriceColor: e.target.value })}
                                style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, code);
  console.log('OK: Added color picker next to Free Price Label');
} else {
  console.log('WARN: block not found');
}
