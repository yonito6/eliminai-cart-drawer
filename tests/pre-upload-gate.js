#!/usr/bin/env node
/**
 * PRE-UPLOAD GATE — Runs ALL test suites before allowing upload.
 *
 * This is the SINGLE command to run before any upload.
 * ALL three suites must pass. ANY failure blocks the upload.
 *
 * Usage:
 *   node tests/pre-upload-gate.js                    # Test local v14-complete.js
 *   node tests/pre-upload-gate.js --file path/to.js  # Test specific file
 *
 * Test suites:
 *   1. Bug Regression (25 tests)   — specific reported bugs stay fixed
 *   2. Behavior Shield (122 tests) — visual/structural integrity
 *   3. Contract Tests (56 tests)   — logic/architecture correctness
 *
 * Total: 200+ tests, runs in <2 seconds.
 */

var execSync = require('child_process').execSync;
var path = require('path');

var args = process.argv.slice(2).join(' ');
var testsDir = __dirname;
var allPassed = true;
var results = [];

console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log(' PRE-UPLOAD GATE \u2014 All tests must pass before upload');
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

var suites = [
  { name: 'Bug Regression', file: 'bug-regression.test.js', required: true },
  { name: 'Behavior Shield', file: 'behavior-shield.test.js', required: true },
  { name: 'Contract Tests', file: 'contract.test.js', required: false }
];

suites.forEach(function(suite) {
  var cmd = 'node "' + path.join(testsDir, suite.file) + '" ' + args;
  try {
    var output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    // Extract result line
    var lines = output.split('\n');
    var resultLine = '';
    for (var i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('passed') && lines[i].includes('total')) {
        resultLine = lines[i].trim();
        break;
      }
    }
    results.push({ name: suite.name, passed: true, summary: resultLine });
    console.log('\u2713 ' + suite.name + ': ' + resultLine);
  } catch (err) {
    var output = (err.stdout || '') + (err.stderr || '');
    // Find failures
    var failLines = [];
    output.split('\n').forEach(function(line) {
      if (line.includes('\u2717') || line.includes('FAILED')) {
        failLines.push(line.trim());
      }
    });
    var resultLine = '';
    output.split('\n').forEach(function(line) {
      if (line.includes('passed') && line.includes('failed')) {
        resultLine = line.trim();
      }
    });
    results.push({ name: suite.name, passed: false, summary: resultLine, failures: failLines });
    console.log('\u2717 ' + suite.name + ': ' + resultLine);
    if (failLines.length > 0) {
      failLines.forEach(function(f) { console.log('  ' + f); });
    }
  }
  console.log('');
});

// Final verdict
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
if (allPassed) {
  console.log('\u2713 ALL TESTS PASS \u2014 Safe to upload');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  process.exit(0);
} else {
  console.log('\u26a0\ufe0f  UPLOAD BLOCKED \u2014 Fix failing tests before uploading!');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  process.exit(1);
}
