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

  console.log(`\n  Pre-upload gate: running contract tests${label ? ` (${label})` : ''}...`);
  try {
    execSync(`node tests/contract.test.js --file .tmp-upload-check.js`, {
      cwd: ROOT,
      stdio: 'inherit'
    });
  } catch (e) {
    fs.unlinkSync(tmpFile);
    throw new Error('\n  UPLOAD BLOCKED — contract tests failed. Fix the code first.');
  }

  // Proxy subpath regression check — locks toml/Liquid/JS subpath agreement.
  // The .tmp-upload-check.js file is a copy of the code about to be uploaded;
  // the static checks read shopify.app.toml + extension Liquid + root v14-complete.js
  // to ensure all three agree. Catches code drift that would 404 the proxy.
  console.log('  Pre-upload gate: running proxy subpath regression tests...');
  try {
    execSync(`node tests/proxy-subpath.test.js`, {
      cwd: ROOT,
      stdio: 'inherit'
    });
  } catch (e) {
    fs.unlinkSync(tmpFile);
    throw new Error('\n  UPLOAD BLOCKED — proxy subpath regression detected. Fix subpath drift first.');
  }

  // Clean up
  fs.unlinkSync(tmpFile);
  console.log('  Contracts + proxy subpath checks passed — upload allowed.\n');
};
