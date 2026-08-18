const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`;
}

const timestamp = getTimestamp();
const backupDirName = `migration-safety-backup-${timestamp}`;
// Place backup directory outside active source paths (in parent directory or in a specific non-source folder)
const backupRoot = path.resolve(__dirname, '../../', backupDirName);

console.log(`Target backup root: ${backupRoot}`);

if (!fs.existsSync(backupRoot)) {
  fs.mkdirSync(backupRoot, { recursive: true });
}

const filesToBackup = [
  { src: 'package.json', dest: 'package.json' },
  { src: 'package-lock.json', dest: 'package-lock.json' },
  { src: 'prisma/schema.prisma', dest: 'prisma/schema.prisma' },
  { src: 'prisma/dev.db', dest: 'prisma/dev.db', optional: true },
  { src: 'prisma/dev-backup.db.bak', dest: 'prisma/dev-backup.db.bak', optional: true },
  { src: 'electron/database/prisma.ts', dest: 'electron/database/prisma.ts' },
  { src: 'electron/services/shop.service.ts', dest: 'electron/services/shop.service.ts' },
  { src: 'electron/ipc/shop.ipc.ts', dest: 'electron/ipc/shop.ipc.ts' }
];

// Add migrations if they exist
const migrationsPath = 'prisma/migrations';
if (fs.existsSync(migrationsPath)) {
  const folders = fs.readdirSync(migrationsPath);
  for (const f of folders) {
    const fullPath = path.join(migrationsPath, f);
    if (fs.statSync(fullPath).isDirectory()) {
      const sqlFile = path.join(fullPath, 'migration.sql');
      if (fs.existsSync(sqlFile)) {
        filesToBackup.push({ src: sqlFile, dest: `prisma/migrations/${f}/migration.sql` });
      }
    }
  }
}

const manifest = {};

for (const item of filesToBackup) {
  const srcPath = path.resolve(__dirname, '../', item.src);
  if (!fs.existsSync(srcPath)) {
    if (item.optional) {
      console.log(`Skipped optional missing file: ${item.src}`);
      continue;
    }
    console.error(`ERROR: Critical file missing: ${srcPath}`);
    process.exit(1);
  }

  const destPath = path.resolve(backupRoot, item.dest);
  const destParent = path.dirname(destPath);
  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  // Copy file
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied: ${item.src} -> ${destPath}`);

  // Compute checksum
  const content = fs.readFileSync(srcPath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  manifest[item.src] = hash;
}

// Write manifest
const manifestPath = path.join(backupRoot, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Manifest written to: ${manifestPath}`);

// Also print the YYYYMMDD-HHmmss timestamp for our docs
fs.writeFileSync(path.join(backupRoot, 'timestamp.txt'), timestamp, 'utf8');

console.log(`Backup completed successfully! Directory: ${backupDirName}`);
process.exit(0);
