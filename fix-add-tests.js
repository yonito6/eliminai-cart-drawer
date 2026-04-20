const fs = require('fs');
let c = fs.readFileSync('tests/contract.test.js', 'utf8');

const insertBefore = `  // ================================================================
  // RESULTS
  // ================================================================`;

const newTests = `  // ================================================================
  // SECTION: SMOOTH REFRESH — No collapse animation, no ghost elements
  // ================================================================
  console.log('\\n--- Smooth Refresh ---');

  test('Contract 57: Remove handler dims item (no collapse animation)', () => {
    // Remove click must set opacity to 0.3 for instant dim, NOT maxHeight/paddingTop/etc collapse
    assertContains(code, "item.style.opacity = '0.3'", 'Remove handler must dim item to 0.3 opacity');
    assertContains(code, "item.style.pointerEvents = 'none'", 'Remove handler must disable pointer events on dimmed item');
  });

  test('Contract 58: Remove handler does NOT use collapse animation', () => {
    // The remove click handler must NOT set maxHeight to 0 (that was the old collapse animation)
    // Check specifically in the removeBtn handler block (not in other code)
    // We verify by checking there's no "item.style.maxHeight = '0'" near "removeBtn"
    var removeSection = code.substring(
      code.indexOf('if (removeBtn)'),
      code.indexOf('if (removeBtn)') + 600
    );
    assert(!removeSection.includes("item.style.maxHeight = '0'"), 'Remove handler must NOT collapse items (no maxHeight = 0)');
    assert(!removeSection.includes("setTimeout(function() { if (item.parentNode) item.remove()"), 'Remove handler must NOT setTimeout-remove DOM elements');
  });

  test('Contract 59: Remove handler calls showLoading immediately', () => {
    // Loading overlay must appear BEFORE the API call, not after
    var removeSection = code.substring(
      code.indexOf('if (removeBtn)'),
      code.indexOf('if (removeBtn)') + 800
    );
    assertContains(removeSection, 'CCD.showLoading()', 'Remove handler must call showLoading immediately on click');
  });

  test('Contract 60: morphDOM removes unmatched items immediately (no ghost elements)', () => {
    // morphDOM must el.remove() items not in new cart — NOT skip them or animate them
    var morphSection = code.substring(
      code.indexOf('morphDOM: function'),
      code.indexOf('morphDOM: function') + 2000
    );
    // Must have el.remove() for items not found in new list
    assertContains(morphSection, 'el.remove()', 'morphDOM must remove unmatched items immediately');
    // Must NOT skip ccd-item--removing elements (old behavior that caused ghost items)
    assert(!morphSection.includes("if (el.classList.contains('ccd-item--removing')) { return; }"),
      'morphDOM must NOT skip ccd-item--removing elements (causes ghost items)');
  });

  test('Contract 61: morphDOM does NOT use collapse animation for removals', () => {
    var morphSection = code.substring(
      code.indexOf('morphDOM: function'),
      code.indexOf('morphDOM: function') + 2000
    );
    // morphDOM must NOT set maxHeight/opacity/padding for collapse animation
    assert(!morphSection.includes("el.style.maxHeight = '0'"), 'morphDOM must NOT collapse-animate removed items');
    assert(!morphSection.includes("setTimeout(function() { el.remove(); }, 180)"), 'morphDOM must NOT delay-remove items');
  });

  test('Contract 62: Qty +/- shows loading overlay', () => {
    // changeQty must show loading for non-remove operations too
    var changeQtySection = code.substring(
      code.indexOf('changeQty: function'),
      code.indexOf('changeQty: function') + 400
    );
    assertContains(changeQtySection, 'CCD.showLoading()', 'changeQty must show loading for qty changes');
  });

  test('Contract 63: Gift remove uses dim (not collapse)', () => {
    var giftSection = code.substring(
      code.indexOf('ccd-gift-item__remove'),
      code.indexOf('ccd-gift-item__remove') + 600
    );
    assertContains(giftSection, "giftItem.style.opacity = '0.3'", 'Gift remove must dim to 0.3 (not collapse)');
    assert(!giftSection.includes("giftItem.style.maxHeight = '0'"), 'Gift remove must NOT use collapse animation');
  });

  ${insertBefore}`;

if (c.includes(insertBefore)) {
  c = c.replace(insertBefore, newTests);
  fs.writeFileSync('tests/contract.test.js', c);
  console.log('OK: Added 7 smooth refresh contract tests (57-63)');
} else {
  console.log('FAIL: Could not find RESULTS section marker');
  process.exit(1);
}
