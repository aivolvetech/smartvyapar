import Database from 'better-sqlite3-multiple-ciphers';
import { ConversionError } from './conversion-errors';

export function validateConversion(plainDb: Database.Database, encryptedDb: Database.Database): void {
  let plainCount = 0;
  let encryptedCount = 0;

  try {
    const plainRes = plainDb.prepare('SELECT count(*) as count FROM Shop').get() as { count: number };
    plainCount = plainRes.count;
  } catch (err) {
    // If Shop table doesn't exist in plain db, there is no data to convert, so skip validation
    return;
  }

  try {
    const encRes = encryptedDb.prepare('SELECT count(*) as count FROM Shop').get() as { count: number };
    encryptedCount = encRes.count;
  } catch (err) {
    throw new ConversionError('Encrypted database is missing the "Shop" table.');
  }

  if (plainCount !== encryptedCount) {
    throw new ConversionError(`Row count mismatch: plain had ${plainCount}, encrypted has ${encryptedCount}.`);
  }

  // Compare field values on the first record
  if (plainCount > 0) {
    const plainShop = plainDb.prepare('SELECT * FROM Shop LIMIT 1').get() as any;
    const encShop = encryptedDb.prepare('SELECT * FROM Shop WHERE id = ?').get(plainShop.id) as any;

    if (!plainShop || !encShop) {
      throw new ConversionError('Shop records could not be retrieved for verification.');
    }

    if (plainShop.name !== encShop.name) {
      throw new ConversionError(`Shop name mismatch: expected "${plainShop.name}", got "${encShop.name}".`);
    }

    if (plainShop.phone !== encShop.phone) {
      throw new ConversionError(`Shop phone mismatch: expected "${plainShop.phone}", got "${encShop.phone}".`);
    }
  }
}
