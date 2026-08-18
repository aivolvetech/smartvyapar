import { getDatabaseConnection } from '../database-connection';
import { ImportType } from '../../../shared/types/import';
import { RepositoryError } from './repository-errors';

export interface ImportTemplateRow {
  id: string;
  importType: string;
  templateVersion: string;
  columnDefinitionJson: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export class ImportTemplateRepository {
  public findActiveByType(importType: ImportType): ImportTemplateRow | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(
        'SELECT * FROM "ImportTemplate" WHERE importType = ? AND isActive = 1 ORDER BY templateVersion DESC LIMIT 1'
      ).get(importType);
      return row ? (row as ImportTemplateRow) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find template by type: ${err.message}`);
    }
  }

  public create(template: Omit<ImportTemplateRow, 'createdAt' | 'updatedAt'>): ImportTemplateRow {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO "ImportTemplate" (id, importType, templateVersion, columnDefinitionJson, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(template.id, template.importType, template.templateVersion, template.columnDefinitionJson, template.isActive, now, now);
      return {
        ...template,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to create template: ${err.message}`);
    }
  }
}
