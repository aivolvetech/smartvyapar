import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { RepositoryError } from './repository-errors';

export class DocumentSequenceRepository {
  public next(documentType: string, financialYear: string, prefix: string, paddingLength = 6): string {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      const existing = db.prepare(`
        SELECT * FROM DocumentSequence
        WHERE documentType=? AND financialYear=?
      `).get(documentType, financialYear) as any | undefined;

      if (!existing) {
        db.prepare(`
          INSERT INTO DocumentSequence (id, documentType, financialYear, prefix, nextNumber, paddingLength, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 2, ?, ?, ?)
        `).run(crypto.randomUUID(), documentType, financialYear, prefix, paddingLength, now, now);
        return `${prefix}${String(1).padStart(paddingLength, '0')}`;
      }

      const number = existing.nextNumber as number;
      db.prepare(`
        UPDATE DocumentSequence
        SET nextNumber=nextNumber+1, prefix=?, paddingLength=?, updatedAt=?
        WHERE id=?
      `).run(prefix, paddingLength, now, existing.id);
      return `${prefix}${String(number).padStart(existing.paddingLength ?? paddingLength, '0')}`;
    } catch (err: any) {
      throw new RepositoryError(`Failed to generate document number: ${err.message}`);
    }
  }
}
