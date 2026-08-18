import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { Customer, CustomerListItem, CustomerListResult, CustomerFilter } from '../../../shared/models/customer';
import { mapRowToCustomer } from './row-mappers/customer.mapper';
import { RepositoryError } from './repository-errors';

const SORT_COLUMN_MAP: Record<string, string> = {
  customerCode: 'c.customerCode',
  name: 'c.name',
  customerType: 'c.customerType',
  outstanding: 'outstanding',
  updatedAt: 'c.updatedAt',
};

export class CustomerRepository {
  public create(input: {
    shopId: string;
    customerCode: string;
    normalizedCustomerCode: string;
    name: string;
    normalizedName: string;
    customerType: string;
    contactPerson?: string | null;
    phone?: string | null;
    normalizedPhone?: string | null;
    alternatePhone?: string | null;
    email?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    billingAddressLine1?: string | null;
    billingAddressLine2?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string;
    paymentTermsDays?: number;
    creditLimit?: number;
    priceBookId?: string | null;
    notes?: string | null;
    isWalkIn?: number;
  }): Customer {
    try {
      const db = getDatabaseConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO Customer (
          id, shopId, customerCode, normalizedCustomerCode, name, normalizedName, customerType,
          contactPerson, phone, normalizedPhone, alternatePhone, email, gstNumber, panNumber,
          billingAddressLine1, billingAddressLine2, shippingAddressLine1, shippingAddressLine2,
          city, state, postalCode, country, paymentTermsDays, creditLimit, priceBookId,
          notes, isWalkIn, isActive, createdAt, updatedAt, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)
      `).run(
        id,
        input.shopId,
        input.customerCode,
        input.normalizedCustomerCode,
        input.name,
        input.normalizedName,
        input.customerType,
        input.contactPerson ?? null,
        input.phone ?? null,
        input.normalizedPhone ?? null,
        input.alternatePhone ?? null,
        input.email ?? null,
        input.gstNumber ?? null,
        input.panNumber ?? null,
        input.billingAddressLine1 ?? null,
        input.billingAddressLine2 ?? null,
        input.shippingAddressLine1 ?? null,
        input.shippingAddressLine2 ?? null,
        input.city ?? null,
        input.state ?? null,
        input.postalCode ?? null,
        input.country ?? 'India',
        input.paymentTermsDays ?? 0,
        input.creditLimit ?? 0,
        input.priceBookId ?? null,
        input.notes ?? null,
        input.isWalkIn ?? 0,
        now,
        now
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to create customer: ${err.message}`);
    }
  }

  public findById(id: string): Customer | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Customer WHERE id = ?').get(id);
      return row ? mapRowToCustomer(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find customer by id: ${err.message}`);
    }
  }

  public findByNormalizedCode(shopId: string, normalizedCustomerCode: string): Customer | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Customer WHERE shopId = ? AND normalizedCustomerCode = ?').get(shopId, normalizedCustomerCode);
      return row ? mapRowToCustomer(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find customer by code: ${err.message}`);
    }
  }

  public update(
    id: string,
    input: {
      name?: string;
      normalizedName?: string;
      customerType?: string;
      contactPerson?: string | null;
      phone?: string | null;
      normalizedPhone?: string | null;
      alternatePhone?: string | null;
      email?: string | null;
      gstNumber?: string | null;
      panNumber?: string | null;
      billingAddressLine1?: string | null;
      billingAddressLine2?: string | null;
      shippingAddressLine1?: string | null;
      shippingAddressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string;
      paymentTermsDays?: number;
      creditLimit?: number;
      priceBookId?: string | null;
      notes?: string | null;
    }
  ): Customer {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new Error('Customer not found.');

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE Customer
        SET
          name = COALESCE(?, name),
          normalizedName = COALESCE(?, normalizedName),
          customerType = COALESCE(?, customerType),
          contactPerson = ?,
          phone = ?,
          normalizedPhone = ?,
          alternatePhone = ?,
          email = ?,
          gstNumber = ?,
          panNumber = ?,
          billingAddressLine1 = ?,
          billingAddressLine2 = ?,
          shippingAddressLine1 = ?,
          shippingAddressLine2 = ?,
          city = ?,
          state = ?,
          postalCode = ?,
          country = COALESCE(?, country),
          paymentTermsDays = COALESCE(?, paymentTermsDays),
          creditLimit = COALESCE(?, creditLimit),
          priceBookId = ?,
          notes = ?,
          updatedAt = ?,
          version = version + 1
        WHERE id = ?
      `).run(
        input.name ?? null,
        input.normalizedName ?? null,
        input.customerType ?? null,
        input.contactPerson !== undefined ? input.contactPerson : existing.contactPerson,
        input.phone !== undefined ? input.phone : existing.phone,
        input.normalizedPhone !== undefined ? input.normalizedPhone : existing.normalizedPhone,
        input.alternatePhone !== undefined ? input.alternatePhone : existing.alternatePhone,
        input.email !== undefined ? input.email : existing.email,
        input.gstNumber !== undefined ? input.gstNumber : existing.gstNumber,
        input.panNumber !== undefined ? input.panNumber : existing.panNumber,
        input.billingAddressLine1 !== undefined ? input.billingAddressLine1 : existing.billingAddressLine1,
        input.billingAddressLine2 !== undefined ? input.billingAddressLine2 : existing.billingAddressLine2,
        input.shippingAddressLine1 !== undefined ? input.shippingAddressLine1 : existing.shippingAddressLine1,
        input.shippingAddressLine2 !== undefined ? input.shippingAddressLine2 : existing.shippingAddressLine2,
        input.city !== undefined ? input.city : existing.city,
        input.state !== undefined ? input.state : existing.state,
        input.postalCode !== undefined ? input.postalCode : existing.postalCode,
        input.country ?? null,
        input.paymentTermsDays ?? null,
        input.creditLimit ?? null,
        input.priceBookId !== undefined ? input.priceBookId : existing.priceBookId,
        input.notes !== undefined ? input.notes : existing.notes,
        now,
        id
      );
      return this.findById(id)!;
    } catch (err: any) {
      throw new RepositoryError(`Failed to update customer: ${err.message}`);
    }
  }

  public list(shopId: string, filter: CustomerFilter): CustomerListResult {
    try {
      const db = getDatabaseConnection();
      const conditions: string[] = ['c.shopId = ?'];
      const params: any[] = [shopId];

      if (filter.isActive !== undefined) {
        conditions.push('c.isActive = ?');
        params.push(filter.isActive ? 1 : 0);
      }

      if (filter.customerType) {
        conditions.push('c.customerType = ?');
        params.push(filter.customerType);
      }

      if (filter.search) {
        const searchNorm = filter.search.trim().toLowerCase().replace(/\s+/g, ' ');
        conditions.push(`(
          c.normalizedCustomerCode = ? OR
          c.normalizedName LIKE ? OR
          c.phone LIKE ? OR
          c.gstNumber LIKE ?
        )`);
        params.push(searchNorm, `%${searchNorm}%`, `%${filter.search.trim()}%`, `%${filter.search.trim().toUpperCase()}%`);
      }

      // outstanding state filters
      if (filter.outstandingState && filter.outstandingState !== 'ALL') {
        if (filter.outstandingState === 'DUE') {
          conditions.push('COALESCE(l.outstanding, 0) > 0.001');
        } else if (filter.outstandingState === 'ADVANCE') {
          conditions.push('COALESCE(l.outstanding, 0) < -0.001');
        } else if (filter.outstandingState === 'ZERO') {
          conditions.push('ABS(COALESCE(l.outstanding, 0)) <= 0.001');
        }
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const sortColumn = SORT_COLUMN_MAP[filter.sortBy] ?? 'c.name';
      const direction = filter.sortDirection === 'DESC' ? 'DESC' : 'ASC';
      const pageSize = Math.min(Math.max(filter.pageSize || 25, 1), 200);
      const page = Math.max(filter.page || 1, 1);
      const offset = (page - 1) * pageSize;

      const fromSql = `
        FROM Customer c
        LEFT JOIN PriceBook pb ON pb.id = c.priceBookId
        LEFT JOIN (
          SELECT customerId, COALESCE(SUM(debitAmount - creditAmount), 0) AS outstanding
          FROM CustomerLedgerEntry GROUP BY customerId
        ) l ON l.customerId = c.id
        ${where}
      `;

      const countRow = db.prepare(`SELECT count(*) AS total ${fromSql}`).get(...params) as { total: number };
      const rows = db.prepare(`
        SELECT
          c.id, c.customerCode, c.name, c.customerType, c.phone, c.gstNumber,
          c.city, c.state, pb.name AS priceBookName, c.isActive, c.isWalkIn, c.updatedAt,
          COALESCE(l.outstanding, 0) AS outstanding
        ${fromSql}
        ORDER BY ${sortColumn} ${direction}, c.id ASC
        LIMIT ? OFFSET ?
      `).all(...params, pageSize, offset) as any[];

      const items: CustomerListItem[] = rows.map(row => ({
        id: row.id,
        customerCode: row.customerCode,
        name: row.name,
        customerType: row.customerType,
        phone: row.phone || null,
        gstNumber: row.gstNumber || null,
        city: row.city || null,
        state: row.state || null,
        priceBookName: row.priceBookName || null,
        outstanding: row.outstanding ?? 0,
        isActive: Boolean(row.isActive),
        isWalkIn: Boolean(row.isWalkIn),
        updatedAt: row.updatedAt,
      }));

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalItems: countRow.total,
          totalPages: Math.max(1, Math.ceil(countRow.total / pageSize)),
        },
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list customers: ${err.message}`);
    }
  }

  public setActive(id: string, isActive: boolean): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare('UPDATE Customer SET isActive = ?, updatedAt = ?, version = version + 1 WHERE id = ?').run(
        isActive ? 1 : 0,
        now,
        id
      );
    } catch (err: any) {
      throw new RepositoryError(`Failed to set customer active state: ${err.message}`);
    }
  }

  public hasLedgerEntries(customerId: string): boolean {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT count(*) AS count FROM CustomerLedgerEntry WHERE customerId = ?').get(customerId) as { count: number };
      return row.count > 0;
    } catch (err: any) {
      throw new RepositoryError(`Failed to check ledger entries: ${err.message}`);
    }
  }

  public findActiveByGst(shopId: string, gstNumber: string): Customer | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Customer WHERE shopId = ? AND gstNumber = ? AND isActive = 1').get(shopId, gstNumber);
      return row ? mapRowToCustomer(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find customer by GST: ${err.message}`);
    }
  }

  public findActiveByPhone(shopId: string, normalizedPhone: string): Customer | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Customer WHERE shopId = ? AND normalizedPhone = ? AND isActive = 1').get(shopId, normalizedPhone);
      return row ? mapRowToCustomer(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find customer by Phone: ${err.message}`);
    }
  }

  public findWalkIn(shopId: string): Customer | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Customer WHERE shopId = ? AND isWalkIn = 1').get(shopId);
      return row ? mapRowToCustomer(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find Walk-In customer: ${err.message}`);
    }
  }
}
