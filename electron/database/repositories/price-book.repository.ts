import { getDatabaseConnection } from '../database-connection';
import { PriceBook } from '../../../shared/models/price-book';
import { mapRowToPriceBook } from './row-mappers/price-book.mapper';
import { RepositoryError } from './repository-errors';

export const DEFAULT_PRICE_BOOK_ID = 'pricebook-default';

export class PriceBookRepository {
  public getDefault(): PriceBook {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM PriceBook WHERE isDefault = 1 AND isActive = 1 LIMIT 1').get();
      if (!row) throw new RepositoryError('Default PriceBook not found. Database may need seeding.');
      return mapRowToPriceBook(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to get default price book: ${err.message}`);
    }
  }

  public findById(id: string): PriceBook | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM PriceBook WHERE id = ?').get(id);
      return row ? mapRowToPriceBook(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find price book: ${err.message}`);
    }
  }
}
