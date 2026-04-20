#!/usr/bin/env node
/**
 * BUG-001 Fix: Protection toggle flashes ON/OFF when user toggled it off.
 *
 * Root cause: _doRefresh line ~2411 pre-sets toggle ON without checking _userToggledOff.
 * Fix: Add && !_userToggledOff to the if condition.
 *
 * Input:  v16.2 snapshot (production baseline)
 * Output: v16.6 snapshot with fix applied
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '..', 'snapshots', 'v16.2-universal-theme-suppress-20260418.js');
const OUTPUT = path.resolve(__dirname, '..', 'snapshots', 'v16.6-toggle-flash-fix-20260418.js');

let code = fs.readFileSync(INPUT, 'utf8');

// FIX 1: _doRefresh pre-set toggle — add !_userToggledOff guard
const oldPreset = 'if (shouldDefaultOn && CCD.getRealCount(cart) > 0) {';
const newPreset = 'if (shouldDefaultOn && CCD.getRealCount(cart) > 0 && !_userToggledOff) {';

if (!code.includes(oldPreset)) {
  console.error('ERROR: Could not find _doRefresh toggle pre-set pattern.');
  console.error('Looking for:', oldPreset);
  process.exit(1);
}

const count = code.split(oldPreset).length - 1;
console.log(`Found ${count} occurrence(s) of toggle pre-set pattern.`);

code = code.replace(oldPreset, newPreset);

// Verify fix was applied
if (!code.includes(newPreset)) {
  console.error('ERROR: Fix was not applied correctly.');
  process.exit(1);
}

// Also update v14-complete.js (the main working copy)
const V14 = path.resolve(__dirname, '..', 'v14-complete.js');
let v14code = fs.readFileSync(V14, 'utf8');

// v14 already has the guard in its version of this pattern, verify
const v14Pattern = 'if (shouldDefaultOn && CCD.getRealCount(cart) > 0 && !_userToggledOff) {';
if (v14code.includes(v14Pattern)) {
  console.log('v14-complete.js already has the fix — OK.');
} else {
  const v14Old = 'if (shouldDefaultOn && CCD.getRealCount(cart) > 0) {';
  if (v14code.includes(v14Old)) {
    v14code = v14code.replace(v14Old, v14Pattern);
    fs.writeFileSync(V14, v14code);
    console.log('v14-complete.js FIXED — added !_userToggledOff guard.');
  } else {
    console.log('v14-complete.js has a different pattern — skipping, check manually.');
  }
}

// Write fixed snapshot
fs.writeFileSync(OUTPUT, code);
console.log(`\nWrote ${OUTPUT}`);
console.log(`Size: ${code.length} bytes`);
console.log('\nFix applied: _doRefresh toggle pre-set now checks _userToggledOff');
