import Database from 'better-sqlite3-multiple-ciphers';

export function checkDatabaseIntegrity(db: Database.Database): boolean {
  try {
    const check = db.pragma('integrity_check') as any[];
    if (check && check.length > 0) {
      // better-sqlite3 returns rows either as objects or values depending on structure
      const row = check[0];
      const result = typeof row === 'object' ? (row.integrity_check || Object.values(row)[0]) : row;
      return String(result).toLowerCase() === 'ok';
    }
    return false;
  } catch (err) {
    return false;
  }
}
