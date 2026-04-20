/**
 * BACKUP + UPLOAD SYSTEM for v14-complete.js
 *
 * Usage:
 *   node backups/backup-and-upload.js          — backup current LIVE version, then upload new v14
 *   node backups/backup-and-upload.js --dry    — only backup, don't upload
 *   node backups/backup-and-upload.js --list   — list all backups
 *   node backups/backup-and-upload.js --revert — revert to most recent backup
 *   node backups/backup-and-upload.js --revert 2026-04-20_14-30  — revert to specific backup
 */

const fs = require('fs');
const path = require('path');

const STORE = 'eliminai-test.myshopify.com';
const CLIENT_ID = 'b4bf1a31f5fa0233f9ca91177dbd5ce1';
const CLIENT_SECRET = '***REMOVED_SHOPIFY_SECRET***';
const THEMES = ['185993036089', '185992970553'];
const V14_PATH = path.join(__dirname, '..', 'v14-complete.js');
const BACKUPS_DIR = __dirname;
const ASSET_KEY = 'assets/v14-complete.js';

async function getToken() {
  const body = JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' });
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const data = await res.json();
  if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function downloadLive(token, themeId) {
  const url = `https://${STORE}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${ASSET_KEY}`;
  const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const data = await res.json();
  return data.asset.value;
}

async function uploadToTheme(token, themeId, content) {
  const res = await fetch(`https://${STORE}/admin/api/2025-01/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ asset: { key: ASSET_KEY, value: content } })
  });
  if (!res.ok) throw new Error(`Upload to ${themeId} failed: ${res.status} ${await res.text()}`);
  return true;
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
}

function listBackups() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('v14-backup-') && f.endsWith('.js'))
    .sort()
    .reverse();
  return files;
}

async function main() {
  const args = process.argv.slice(2);

  // --list: show all backups
  if (args.includes('--list')) {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log('No backups found.');
    } else {
      console.log(`Found ${backups.length} backup(s):\n`);
      backups.forEach((f, i) => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        const size = (stats.size / 1024).toFixed(1);
        const date = f.replace('v14-backup-', '').replace('.js', '').replace(/_/g, ' ').replace(/-/g, ':');
        console.log(`  ${i === 0 ? '→' : ' '} ${f}  (${size} KB)${i === 0 ? '  ← most recent' : ''}`);
      });
    }
    return;
  }

  // --revert: restore a backup
  if (args.includes('--revert')) {
    const backups = listBackups();
    if (backups.length === 0) { console.error('No backups to revert to!'); process.exit(1); }

    // Find specific backup or use most recent
    const revertIdx = args.indexOf('--revert');
    const searchTerm = args[revertIdx + 1];
    let backupFile;

    if (searchTerm && !searchTerm.startsWith('--')) {
      backupFile = backups.find(f => f.includes(searchTerm));
      if (!backupFile) { console.error(`No backup matching "${searchTerm}". Use --list to see all.`); process.exit(1); }
    } else {
      backupFile = backups[0]; // most recent
    }

    console.log(`REVERTING to: ${backupFile}`);
    const content = fs.readFileSync(path.join(BACKUPS_DIR, backupFile), 'utf8');
    console.log(`Backup size: ${(content.length / 1024).toFixed(1)} KB`);

    const token = await getToken();
    for (const themeId of THEMES) {
      await uploadToTheme(token, themeId, content);
      console.log(`  ✓ Theme ${themeId} reverted`);
    }

    // Also restore local file
    fs.writeFileSync(V14_PATH, content);
    console.log(`  ✓ Local v14-complete.js restored`);
    console.log('\nDONE — reverted to backup successfully.');
    return;
  }

  // Default: BACKUP live version, then UPLOAD new v14
  console.log('=== BACKUP & UPLOAD SYSTEM ===\n');

  // Step 1: Download current LIVE version as backup
  console.log('Step 1: Downloading current LIVE version from Shopify...');
  const token = await getToken();
  const liveContent = await downloadLive(token, THEMES[0]);

  const timestamp = getTimestamp();
  const backupName = `v14-backup-${timestamp}.js`;
  const backupPath = path.join(BACKUPS_DIR, backupName);
  fs.writeFileSync(backupPath, liveContent);
  console.log(`  ✓ Backup saved: ${backupName} (${(liveContent.length / 1024).toFixed(1)} KB)`);

  // Cleanup: keep only last 10 backups
  const allBackups = listBackups();
  if (allBackups.length > 10) {
    const toDelete = allBackups.slice(10);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(BACKUPS_DIR, f));
      console.log(`  🗑 Deleted old backup: ${f}`);
    });
  }

  // Step 2: Upload new version (unless --dry)
  if (args.includes('--dry')) {
    console.log('\n--dry flag: Skipping upload. Backup only.');
    return;
  }

  console.log('\nStep 2: Uploading new v14-complete.js...');
  const newContent = fs.readFileSync(V14_PATH, 'utf8');
  console.log(`  New version: ${(newContent.length / 1024).toFixed(1)} KB`);

  // Syntax check before upload
  try {
    new Function(newContent);
  } catch (e) {
    console.error(`\n✗ SYNTAX ERROR — upload ABORTED!\n  ${e.message}`);
    console.error(`  Backup is safe at: ${backupName}`);
    process.exit(1);
  }
  console.log('  ✓ Syntax check passed');

  for (const themeId of THEMES) {
    await uploadToTheme(token, themeId, newContent);
    console.log(`  ✓ Theme ${themeId} uploaded`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Backup: ${backupName}`);
  console.log(`  To revert: node backups/backup-and-upload.js --revert`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
