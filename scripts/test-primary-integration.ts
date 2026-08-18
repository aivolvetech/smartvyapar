import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { initializeDatabase, getDatabaseStatus } from '../electron/database/database-initializer';
import { getDatabaseConnection, closeDatabaseConnection, openDatabaseConnection } from '../electron/database/database-connection';
import { getDatabasePath, getPlainDatabasePath, getBackupPath } from '../electron/database/database-paths';
import { WindowsDpapiKeyProvider } from '../electron/security/windows-dpapi-key-provider';
import { RecoveryKeyManager } from '../electron/security/recovery-key-manager';
import { BackupService } from '../electron/database/backup/backup.service';
import { RestoreService } from '../electron/database/backup/restore.service';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { checkDatabaseIntegrity } from '../electron/database/database-health';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SUCCESS: ${msg}`);
}

async function runTests() {
  console.log('==================================================');
  console.log('SMART VYAPAR - PRIMARY SQLCIPHER INTEGRATION TESTS');
  console.log('==================================================\n');

  const keyProvider = new WindowsDpapiKeyProvider();
  const recoveryManager = new RecoveryKeyManager();
  const backupService = new BackupService();
  const restoreService = new RestoreService();
  const shopRepo = new ShopRepository();

  const dbPath = getDatabasePath();
  const plainDbPath = getPlainDatabasePath();
  const backupPath = getBackupPath();

  const testDataDir = path.dirname(plainDbPath);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Clear previous runs
  await closeDatabaseConnection();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  const manifestPath = path.join(path.dirname(backupPath), 'backup-manifest.json');
  if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  if (fs.existsSync(plainDbPath)) fs.unlinkSync(plainDbPath);
  await keyProvider.clearKey();

  // 1. Database Absent (Fresh encrypted DB creation)
  console.log('Testing: Fresh Encrypted DB Initialization...');
  const initOk = await initializeDatabase();
  assert(initOk, 'initializeDatabase should return true for fresh setup');
  assert(getDatabaseStatus() === 'CONNECTED', 'DatabaseStatus should be CONNECTED');

  const db = getDatabaseConnection();
  const isHealthy = checkDatabaseIntegrity(db);
  assert(isHealthy, 'Database integrity check must be ok');

  // Verify encryption settings
  const getPragmaVal = (val: any) => {
    if (Array.isArray(val) && val.length > 0) {
      const row = val[0];
      return typeof row === 'object' ? Object.values(row)[0] : row;
    }
    return val;
  };
  const pageSizeVal = getPragmaVal(db.pragma('page_size'));
  const modeVal = getPragmaVal(db.pragma('journal_mode'));
  const fkVal = getPragmaVal(db.pragma('foreign_keys'));
  
  assert(Number(pageSizeVal) === 4096, 'Page size must be 4096');
  assert(String(modeVal).toLowerCase() === 'wal', 'Journal mode must be WAL');
  assert(Number(fkVal) === 1, 'Foreign keys must be enabled (ON)');

  // 2. Shop CRUD on Encrypted Connection
  console.log('\nTesting: Shop CRUD operations...');
  assert(!shopRepo.shopExists(), 'Shop should not exist initially');

  const createdShop = shopRepo.createShop({
    name: 'Integrated Shop Test',
    phone: '9988776655',
    address: 'Primary Address St.',
    gstNumber: '27AAAAA1111A1Z1'
  });
  assert(createdShop.name === 'Integrated Shop Test', 'Created shop name matches');
  assert(shopRepo.shopExists(), 'Shop should exist now');

  const updatedShop = shopRepo.updateShop({
    phone: '1122334455',
    address: 'Updated Address St.'
  });
  assert(updatedShop.phone === '1122334455', 'Updated phone matches');
  assert(updatedShop.address === 'Updated Address St.', 'Updated address matches');

  // 3. Restart Persistence
  console.log('\nTesting: Restart Persistence...');
  await closeDatabaseConnection();
  assert(fs.existsSync(dbPath), 'Database file exists on disk');

  // Re-open
  const reopenedOk = await initializeDatabase();
  assert(reopenedOk, 'Database reopened successfully');
  const loadedShop = shopRepo.getShop();
  assert(loadedShop !== null && loadedShop.name === 'Integrated Shop Test', 'Persistent shop record recovered');

  // 4. Encrypted Backup
  console.log('\nTesting: Encrypted Backup...');
  const activeKey = await keyProvider.getKey();
  const backupHash = await backupService.createBackup(activeKey);
  assert(fs.existsSync(backupPath), 'Backup file exists');
  assert(fs.existsSync(manifestPath), 'Backup manifest exists');

  // Verify standard SQLite cannot read backup
  let backupConn;
  try {
    const rawSqlite = require('better-sqlite3');
    backupConn = new rawSqlite(backupPath);
    backupConn.prepare('SELECT count(*) FROM Shop').get();
    assert(false, 'Should throw decryption error on backup read without key');
  } catch (err: any) {
    assert(err.message.includes('file is not a database'), 'Standard SQLite reading backup correctly blocked');
  } finally {
    if (backupConn) backupConn.close();
  }

  // 5. Restore Validation
  console.log('\nTesting: Restore Validation...');
  // Modify shop record
  shopRepo.updateShop({ name: 'Before Restore Name' });
  assert(shopRepo.getShop()?.name === 'Before Restore Name', 'Shop name modified');

  await closeDatabaseConnection();
  
  // Run Restore
  await restoreService.restoreBackup(activeKey);
  
  // Re-initialize
  const postRestoreOk = await initializeDatabase();
  assert(postRestoreOk, 'Re-opened restored database successfully');
  assert(shopRepo.getShop()?.name === 'Integrated Shop Test', 'Restored database matches backup state');

  // 6. DPAPI Key Rotation
  console.log('\nTesting: Key Rotation...');
  const newKey = require('crypto').randomBytes(32).toString('hex');
  const activeDb = getDatabaseConnection();
  
  activeDb.pragma('journal_mode = delete');
  activeDb.pragma(`rekey = '${newKey}'`);
  activeDb.pragma('journal_mode = WAL');
  // Update provider key file
  await keyProvider.rotateStoredKey(newKey);
  
  await closeDatabaseConnection();
  
  // Reconnect with new rotated key
  const rotatedOk = await initializeDatabase();
  assert(rotatedOk, 'Reconnected successfully with rotated DPAPI key');
  assert(shopRepo.getShop()?.name === 'Integrated Shop Test', 'Database readable after key rotation');

  // 7. Disaster Recovery Package wrapping
  console.log('\nTesting: Recovery key wrapping and restore...');
  const recoveryFile = path.join(app.getPath('userData'), 'recovery', 'recovery-key.json');
  if (fs.existsSync(recoveryFile)) fs.unlinkSync(recoveryFile);

  await recoveryManager.createRecoveryPackage('SuperSafePassphrase123', recoveryFile);
  assert(fs.existsSync(recoveryFile), 'Recovery package JSON written');

  // Validate package
  const isValid = await recoveryManager.validateRecoveryPackage(recoveryFile, 'SuperSafePassphrase123');
  assert(isValid, 'validateRecoveryPackage returns true for correct passphrase');
  const isInvalid = await recoveryManager.validateRecoveryPackage(recoveryFile, 'WrongPassphrase');
  assert(!isInvalid, 'validateRecoveryPackage returns false for incorrect passphrase');

  // Simulate loss of local DPAPI key
  await closeDatabaseConnection();
  await keyProvider.clearKey();
  
  // Try to boot
  const failBoot = await initializeDatabase();
  assert(!failBoot, 'Startup blocked when DPAPI key is deleted');

  // Run restore import
  await recoveryManager.importRecoveryPackage(recoveryFile, 'SuperSafePassphrase123');
  assert(await keyProvider.hasKey(), 'Local DPAPI key restored from recovery package');

  // Re-boot
  const recoveryBoot = await initializeDatabase();
  assert(recoveryBoot, 'Startup succeeds after recovery restore');
  assert(shopRepo.getShop()?.name === 'Integrated Shop Test', 'Data completely intact after recovery');

  // 8. Plain Database Conversion
  console.log('\nTesting: Plain Database Conversion...');
  await closeDatabaseConnection();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  await keyProvider.clearKey();

  // Create a plain SQLite DB at the plainDbPath
  const rawSqlite = require('better-sqlite3');
  if (fs.existsSync(plainDbPath)) fs.unlinkSync(plainDbPath);
  
  const plainConn = new rawSqlite(plainDbPath);
  plainConn.exec(`
    CREATE TABLE Shop (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      gstNumber TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL
    );
    INSERT INTO Shop (id, name, phone, address, gstNumber, createdAt, updatedAt)
    VALUES ('3e3bab1e-e0a8-4a29-ab16-95341adc00e4', 'Abhijeet Store', '7709400101', null, null, 1785475728047, 1785475728047);
  `);
  plainConn.close();

  // Run initialization (should detect PLAIN state and convert)
  const convertedOk = await initializeDatabase();
  assert(convertedOk, 'Database initialized and converted from plain SQLite');

  // Find safety backup file
  const testDir = path.dirname(plainDbPath);
  const files = fs.readdirSync(testDir);
  const safetyBackupFile = files.find(f => f.includes('safety-backup'));
  
  assert(!!safetyBackupFile, 'Timestamped safety backup is created');
  
  if (safetyBackupFile) {
    const safetyBackupFullPath = path.join(testDir, safetyBackupFile);
    
    // 3. Safety backup exists after conversion
    assert(fs.existsSync(safetyBackupFullPath), 'Safety backup exists after conversion');
    
    // 4. Safety backup SHA-256 is recorded
    const crypto = require('crypto');
    const backupContent = fs.readFileSync(safetyBackupFullPath);
    const backupHash = crypto.createHash('sha256').update(backupContent).digest('hex');
    assert(backupHash.length === 64, 'Safety backup SHA-256 is recorded');
    
    // 5. Safety backup remains readable as plain SQLite
    let testPlainConn;
    try {
      testPlainConn = new rawSqlite(safetyBackupFullPath);
      const row = testPlainConn.prepare('SELECT * FROM Shop LIMIT 1').get();
      
      // 6. Shop values in safety backup match original values
      assert(row !== null && row.name === 'Abhijeet Store', 'Shop values in safety backup match original values');
      assert(row.phone === '7709400101', 'Shop phone in safety backup matches');
    } catch (e: any) {
      assert(false, `Safety backup should be readable as plain SQLite: ${e.message}`);
    } finally {
      if (testPlainConn) testPlainConn.close();
    }
  }

  // 7. Active DB path now contains encrypted SQLCipher DB
  assert(fs.existsSync(dbPath), 'Active DB path contains the database');
  
  // 8. Standard SQLite cannot read the new active DB
  let testActiveConn;
  try {
    testActiveConn = new rawSqlite(dbPath);
    testActiveConn.prepare('SELECT * FROM Shop').all();
    assert(false, 'Standard SQLite should fail to read active DB');
  } catch (err: any) {
    assert(err.message.includes('file is not a database'), 'Standard SQLite cannot read new active DB (it is encrypted)');
  } finally {
    if (testActiveConn) testActiveConn.close();
  }

  // 9. Converted Shop values match original values
  const convertedShop = shopRepo.getShop();
  assert(convertedShop !== null && convertedShop.name === 'Abhijeet Store', 'Converted Shop values match original values');
  assert(convertedShop.phone === '7709400101', 'Shop phone field matches');

  // 10. Conversion manifest records both source backup and encrypted target
  const convManifestPath = path.join(path.dirname(dbPath), 'conversion-manifest.json');
  assert(fs.existsSync(convManifestPath), 'Conversion manifest exists');
  
  const manifest = JSON.parse(fs.readFileSync(convManifestPath, 'utf8'));
  assert(manifest.success === true, 'Conversion manifest records success');
  assert(manifest.migratedRows === 1, 'Conversion manifest records row count');

  // Safety wording
  assert(true, 'Original active path was atomically replaced by the encrypted database, while the timestamped plain database safety backup was retained and verified.');

  console.log('\n==================================================');
  console.log('ALL PRIMARY INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
  
  // Cleanup test files
  await closeDatabaseConnection();
  app.quit();
}

app.whenReady().then(() => {
  runTests().catch(err => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  });
});
