/**
 * Pre-Upload Gate — require() this at the top of ANY upload script.
 * Runs contract tests against the file about to be uploaded.
 * If contracts fail → throws and blocks the upload.
 *
 * Usage:
 *   const gate = require('./pre-upload-gate');
 *   gate(code);            // pass the JS string to validate
 *   gate(code, filePath);  // optional: also writes to temp file for contract runner
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = function preUploadGate(code, label) {
  if (!code || typeof code !== 'string' || code.length < 1000) {
    throw new Error('PRE-UPLOAD GATE: code is empty or too small — refusing to upload.');
  }

  // Write code to a temp file so contract runner can test it
  const tmpFile = path.join(ROOT, '.tmp-upload-check.js');
  fs.writeFileSync(tmpFile, code);

  console.log(`\n  Pre-upload gate: running 56 contract tests${label ? ` (${label})` : ''}...`);
  try {
    execSync(`node tests/contract.test.js --file .tmp-upload-check.js`, {
      cwd: ROOT,
      stdio: 'inherit'
    });
  } catch (e) {
    fs.unlinkSync(tmpFile);
    throw new Error('\n  UPLOAD BLOCKED — contract tests failed. Fix the code first.');
  }

  // Clean up
  fs.unlinkSync(tmpFile);
  console.log('  Contracts passed — upload allowed.\n');
};
