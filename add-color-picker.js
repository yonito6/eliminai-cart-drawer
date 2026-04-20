const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/protection-editor.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add iconColor to ProtectionConfig interface
code = code.replace(
  `  defaultOn?: boolean;\n}`,
  `  defaultOn?: boolean;\n  iconColor?: string;\n}`
);

// 2. Add iconColor state (after iconId state)
code = code.replace(
  `  const [customIconUrl, setCustomIconUrl] = useState(config.customIconUrl ?? '');`,
  `  const [customIconUrl, setCustomIconUrl] = useState(config.customIconUrl ?? '');\n  const [iconColor, setIconColor] = useState(config.iconColor ?? '#8b5cf6');`
);

// 3. Add iconColor to buildPayload
code = code.replace(
  `    const curDefaultOn = overrides.defaultOn ?? defaultOn;`,
  `    const curDefaultOn = overrides.defaultOn ?? defaultOn;\n    const curIconColor = overrides.iconColor ?? iconColor;`
);

code = code.replace(
  `      customIconUrl: curCustomIconUrl || undefined,`,
  `      customIconUrl: curCustomIconUrl || undefined,\n      iconColor: curIconColor,`
);

// 4. Add color picker UI after the icon selector </div> and before Product Name
// Find the closing of icon selector section
const iconSelectorEnd = `        </div>
      </div>

      {/* ── Product Name ── */}`;

const colorPickerUI = `        </div>

        {/* ── Icon Color ── */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 6 }}>
            Icon Color
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={iconColor}
              onChange={(e) => {
                setIconColor(e.target.value);
                pushPreview({ iconColor: e.target.value });
              }}
              style={{
                width: 40,
                height: 40,
                border: '2px solid #e5e7eb',
                borderRadius: 10,
                cursor: 'pointer',
                padding: 2,
                background: '#fff',
              }}
            />
            <input
              type="text"
              value={iconColor}
              onChange={(e) => {
                const v = e.target.value;
                setIconColor(v);
                // Only push preview if it looks like a valid color
                if (/^#[0-9a-fA-F]{6}$/.test(v) || /^rgb/.test(v)) {
                  pushPreviewDebounced({ iconColor: v });
                }
              }}
              onBlur={() => pushPreview({ iconColor })}
              placeholder="#8b5cf6"
              style={{
                width: 120,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                color: '#374151',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#8b5cf6')}
            />
            {/* Quick preset colors */}
            {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#000000'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  setIconColor(c);
                  pushPreview({ iconColor: c });
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: c,
                  border: iconColor === c ? '2px solid #374151' : '2px solid #e5e7eb',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'border-color 0.15s, transform 0.15s',
                  transform: iconColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Product Name ── */}`;

code = code.replace(iconSelectorEnd, colorPickerUI);

fs.writeFileSync(path, code);
console.log('✓ Color picker added to protection editor');

// Verify
const updated = fs.readFileSync(path, 'utf8');
console.log('iconColor state:', updated.includes("useState(config.iconColor ?? '#8b5cf6')"));
console.log('color input:', updated.includes('type="color"'));
console.log('preset colors:', updated.includes("'#3b82f6'"));
console.log('payload includes iconColor:', updated.includes('iconColor: curIconColor'));
