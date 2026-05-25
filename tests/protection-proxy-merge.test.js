/**
 * CONTRACT TEST: Protection config from backend proxy must update the DOM
 * 
 * RULE: Dashboard changes MUST be visible in the cart drawer.
 * The proxy returns the latest config — v14 must apply it to both
 * JS variables AND existing DOM elements (since HTML is built before proxy responds).
 *
 * Regression: 2026-04-20 — title/description from dashboard not rendering because
 * _mergeTiersFromConfig only set CFG.* but didn't update already-rendered DOM.
 */

const fs = require('fs');
const path = require('path');

// Load v14
const v14Path = path.join(__dirname, '..', 'v14-complete.js');
const v14Code = fs.readFileSync(v14Path, 'utf8');

describe('Protection proxy merge contract', () => {

  test('_mergeTiersFromConfig updates PROT, PROT_VID, PROT_ENABLED from proxy config', () => {
    // The merge code must set these vars — search for them in the function
    const mergeFunc = v14Code.substring(
      v14Code.indexOf('_mergeTiersFromConfig: function(config)'),
      v14Code.indexOf('_isExcludedHandle:')
    );
    
    expect(mergeFunc).toContain('PROT = spCfg.handle');
    expect(mergeFunc).toContain('PROT_ENABLED = true');
    expect(mergeFunc).toContain('PROT_VID = PROT_TIERS[0].vid');
    expect(mergeFunc).toContain('PROT_VID_SINGLE = PROT_TIERS[0].vid');
  });

  test('_mergeTiersFromConfig converts price from dollars to cents', () => {
    const mergeFunc = v14Code.substring(
      v14Code.indexOf('_mergeTiersFromConfig: function(config)'),
      v14Code.indexOf('_isExcludedHandle:')
    );
    
    // Must multiply by 100 (backend stores dollars, cart needs cents)
    expect(mergeFunc).toContain('* 100');
    expect(mergeFunc).toMatch(/parseFloat\(t\.price\).*\* 100/);
  });

  test('_mergeTiersFromConfig updates DOM elements for title and description', () => {
    const mergeFunc = v14Code.substring(
      v14Code.indexOf('_mergeTiersFromConfig: function(config)'),
      v14Code.indexOf('_isExcludedHandle:')
    );
    
    // CRITICAL: Must update DOM directly (not just CFG.*) because HTML is already rendered
    expect(mergeFunc).toContain("querySelector('.ccd-shipping-protection__title')");
    expect(mergeFunc).toContain("querySelector('.ccd-shipping-protection__desc')");
    expect(mergeFunc).toContain('_ptEl');  // title element var
    expect(mergeFunc).toContain('_pdEl');  // desc element var
    expect(mergeFunc).toContain('textContent');
  });

  test('_mergeTiersFromConfig sets CFG.protectionTitle and CFG.protectionDesc', () => {
    const mergeFunc = v14Code.substring(
      v14Code.indexOf('_mergeTiersFromConfig: function(config)'),
      v14Code.indexOf('_isExcludedHandle:')
    );
    
    expect(mergeFunc).toContain('CFG.protectionTitle = spCfg.productName');
    expect(mergeFunc).toContain('CFG.protectionDesc = spCfg.description');
  });

  test('protection merge code is wrapped in try/catch (never breaks cart)', () => {
    const mergeFunc = v14Code.substring(
      v14Code.indexOf('_mergeTiersFromConfig: function(config)'),
      v14Code.indexOf('_isExcludedHandle:')
    );
    
    // Protection section must be in try/catch
    const protSection = mergeFunc.substring(mergeFunc.indexOf('shippingProtection'));
    expect(mergeFunc).toContain('try {');
    expect(mergeFunc).toContain('} catch(e) {}');
  });

  test('CFG.protectionPrice must be stored in cents not dollars (prevents $0.04 bug)', () => {
    // Bug: backend sends price as dollars (4.99), parseInt(4.99)=4 → shows $0.04
    // Fix: convert to cents with Math.round(parseFloat(x) * 100)
    const code = fs.readFileSync(path.join(__dirname, '..', 'v14-complete.js'), 'utf8');
    const priceAssignments = code.match(/CFG\.protectionPrice\s*=\s*[^;]+/g) || [];
    for (const assignment of priceAssignments) {
      // Must NOT be a direct dollar assignment — must convert or use already-converted value
      expect(assignment).toMatch(/Math\.round|_mergedPrice/);
    }
  });

  test('_mergeTiersFromConfig updates DOM price element after setting tiers', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'v14-complete.js'), 'utf8');
    expect(code).toContain("_ppEl.textContent");
    expect(code).toContain("_ppEl.setAttribute");
  });

  test('protection product must stay published and be hidden via tags (not unpublished)', () => {
    const createRoute = fs.readFileSync(
      path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'protection', 'create', 'route.ts'),
      'utf8'
    );
    // Must NOT unpublish (breaks /cart/add.js)
    expect(createRoute).not.toContain('published: false');
    expect(createRoute).not.toContain('published:false');
    // Must hide via tags instead
    expect(createRoute).toContain('_eliminai-hidden');
    // Must stay published (comment or code confirming this)
    expect(createRoute).toContain('stays published');
    expect(createRoute).toContain('required for cart add');
  });
});
