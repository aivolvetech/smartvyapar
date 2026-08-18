import crypto from 'crypto';
import { getDatabaseConnection } from '../database-connection';
import { Product, CreateProductInput, UpdateProductInput } from '../../../shared/models/product';
import { mapRowToProduct } from './row-mappers/product.mapper';
import { RepositoryError } from './repository-errors';
import { ProductListFilter, ProductListItem, ProductListResult, ProductSortField } from '../../../shared/types/ipc';

function normalizeStr(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Allowlisted sort column map — prevents SQL injection from renderer-provided sortBy
const SORT_COLUMN_MAP: Record<ProductSortField, string> = {
  name:         'p.name',
  productCode:  'p.productCode',
  sellingPrice: 'p.cachedSellingPrice',
  mrp:          'p.cachedMrp',
  createdAt:    'p.createdAt',
  updatedAt:    'p.updatedAt',
};

export class ProductRepository {
  public findById(id: string): Product | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Product WHERE id = ?').get(id);
      return row ? mapRowToProduct(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find product: ${err.message}`);
    }
  }

  public findByNormalizedCode(normalizedProductCode: string): Product | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Product WHERE normalizedProductCode = ?').get(normalizedProductCode);
      return row ? mapRowToProduct(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find product by code: ${err.message}`);
    }
  }

  public findByNormalizedSku(normalizedSku: string): Product | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare('SELECT * FROM Product WHERE normalizedSku = ?').get(normalizedSku);
      return row ? mapRowToProduct(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find product by sku: ${err.message}`);
    }
  }

  /**
   * Resolved barcode lookup: joins ProductBarcode to Product.
   * Returns active product by active barcode.
   */
  public findByBarcode(barcode: string): Product | null {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT p.* FROM Product p
        INNER JOIN ProductBarcode pb ON pb.productId = p.id
        WHERE pb.barcode = ? AND pb.isActive = 1 AND p.isActive = 1
        LIMIT 1
      `).get(barcode);
      return row ? mapRowToProduct(row) : null;
    } catch (err: any) {
      throw new RepositoryError(`Failed to find product by barcode: ${err.message}`);
    }
  }

  public getDetailLookups(id: string): {
    categoryName: string | null;
    brandName: string | null;
    unitName: string | null;
    unitShortName: string | null;
    taxRateName: string | null;
    taxRate: number | null;
  } {
    try {
      const db = getDatabaseConnection();
      const row = db.prepare(`
        SELECT
          c.name AS categoryName,
          b.name AS brandName,
          u.name AS unitName,
          u.shortName AS unitShortName,
          tr.name AS taxRateName,
          tr.rate AS taxRate
        FROM Product p
        LEFT JOIN ProductCategory c ON c.id = p.categoryId
        LEFT JOIN Brand b ON b.id = p.brandId
        LEFT JOIN UnitOfMeasure u ON u.id = p.primaryUnitId
        LEFT JOIN TaxRate tr ON tr.id = p.taxRateId
        WHERE p.id = ?
      `).get(id) as {
        categoryName?: string;
        brandName?: string;
        unitName?: string;
        unitShortName?: string;
        taxRateName?: string;
        taxRate?: number;
      } | undefined;

      return {
        categoryName: row?.categoryName || null,
        brandName: row?.brandName || null,
        unitName: row?.unitName || null,
        unitShortName: row?.unitShortName || null,
        taxRateName: row?.taxRateName || null,
        taxRate: row?.taxRate ?? null,
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to load product detail lookups: ${err.message}`);
    }
  }

  public list(filter: ProductListFilter): ProductListResult {
    try {
      const db = getDatabaseConnection();
      const { search, barcode, categoryId, brandId, isActive, productType, page, pageSize, sortBy, sortDirection } = filter;

      // Validate sortBy against allowlist — never interpolate renderer value directly
      const sortColumn = SORT_COLUMN_MAP[sortBy] ?? 'p.name';
      const direction = sortDirection === 'DESC' ? 'DESC' : 'ASC';

      const conditions: string[] = [];
      const params: any[] = [];
      const orderParams: any[] = [];
      let searchRankSql = '';

      if (isActive !== undefined) {
        conditions.push('p.isActive = ?');
        params.push(isActive ? 1 : 0);
      }
      if (productType) {
        conditions.push('p.productType = ?');
        params.push(productType);
      }
      if (categoryId) {
        conditions.push('p.categoryId = ?');
        params.push(categoryId);
      }
      if (brandId) {
        conditions.push('p.brandId = ?');
        params.push(brandId);
      }
      if (barcode) {
        // Exact barcode lookup via join
        conditions.push('EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId=p.id AND pb.barcode=? AND pb.isActive=1)');
        params.push(barcode);
      } else if (search) {
        const norm = normalizeStr(search);
        // Prioritize matches in service/UI by exact barcode/code/SKU, then name prefix/contains.
        conditions.push(`(
          EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId=p.id AND pb.barcode=? AND pb.isActive=1) OR
          p.normalizedProductCode = ? OR
          p.normalizedSku = ? OR
          p.normalizedName LIKE ? OR
          p.normalizedName LIKE ?
        )`);
        params.push(search.trim(), norm, norm, norm + '%', '%' + norm + '%');
        searchRankSql = `CASE
          WHEN EXISTS (SELECT 1 FROM ProductBarcode pb WHERE pb.productId=p.id AND pb.barcode=? AND pb.isActive=1) THEN 1
          WHEN p.normalizedProductCode = ? THEN 2
          WHEN p.normalizedSku = ? THEN 3
          WHEN p.normalizedName LIKE ? THEN 4
          ELSE 5
        END ASC,`;
        orderParams.push(search.trim(), norm, norm, norm + '%');
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = db.prepare(`
        SELECT count(*) as total FROM Product p ${where}
      `).get(...params) as { total: number };

      const totalItems = countRow.total;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const offset = (page - 1) * pageSize;

      const rows = db.prepare(`
        SELECT
          p.id, p.productCode, p.name,
          c.name AS categoryName,
          b.name AS brandName,
          u.shortName AS unitShortName,
          p.hsnSacCode,
          tr.name AS taxRateName,
          tr.rate AS taxRate,
          p.cachedPurchasePrice AS purchasePrice,
          p.cachedSellingPrice AS sellingPrice,
          p.cachedMrp AS mrp,
          p.productType,
          p.isActive,
          p.updatedAt,
          (SELECT pb2.barcode FROM ProductBarcode pb2
            WHERE pb2.productId=p.id AND pb2.isPrimary=1 AND pb2.isActive=1 LIMIT 1) AS primaryBarcode
        FROM Product p
        LEFT JOIN ProductCategory c ON c.id = p.categoryId
        LEFT JOIN Brand b ON b.id = p.brandId
        LEFT JOIN UnitOfMeasure u ON u.id = p.primaryUnitId
        LEFT JOIN TaxRate tr ON tr.id = p.taxRateId
        ${where}
        ORDER BY ${searchRankSql} ${sortColumn} ${direction}, p.id ASC
        LIMIT ? OFFSET ?
      `).all(...params, ...orderParams, pageSize, offset);

      const items: ProductListItem[] = (rows as any[]).map(row => ({
        id: row.id,
        productCode: row.productCode,
        name: row.name,
        categoryName: row.categoryName || null,
        brandName: row.brandName || null,
        unitShortName: row.unitShortName || null,
        hsnSacCode: row.hsnSacCode || null,
        taxRateName: row.taxRateName || null,
        taxRate: row.taxRate ?? null,
        purchasePrice: row.purchasePrice ?? null,
        sellingPrice: row.sellingPrice ?? null,
        mrp: row.mrp ?? null,
        primaryBarcode: row.primaryBarcode || null,
        productType: row.productType || 'GOODS',
        isActive: Boolean(row.isActive),
        updatedAt: new Date(row.updatedAt).toISOString(),
      }));

      return {
        items,
        pagination: { page, pageSize, totalItems, totalPages },
      };
    } catch (err: any) {
      throw new RepositoryError(`Failed to list products: ${err.message}`);
    }
  }

  /** Create the Product row only; caller wraps in transaction with barcodes + price */
  public createRow(input: CreateProductInput & { id: string }): Product {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      const normCode = normalizeStr(input.productCode);
      const normName = normalizeStr(input.name);
      const normSku = input.sku ? normalizeStr(input.sku) : null;
      db.prepare(`
        INSERT INTO Product (
          id, productCode, normalizedProductCode, name, normalizedName,
          printName, description, categoryId, brandId, primaryUnitId,
          hsnSacCode, taxRateId, productType, trackInventory, allowNegativeStock,
          minimumStockLevel, reorderLevel, maximumStockLevel,
          sku, normalizedSku, isActive, version, createdAt, updatedAt
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, 1, 1, ?, ?
        )
      `).run(
        input.id, input.productCode, normCode, input.name, normName,
        input.printName || null, input.description || null,
        input.categoryId || null, input.brandId || null, input.primaryUnitId,
        input.hsnSacCode || null, input.taxRateId || null,
        input.productType || 'GOODS',
        input.trackInventory !== false ? 1 : 0,
        input.allowNegativeStock ? 1 : 0,
        input.minimumStockLevel ?? null,
        input.reorderLevel ?? null,
        input.maximumStockLevel ?? null,
        input.sku || null, normSku,
        now, now
      );
      return mapRowToProduct(db.prepare('SELECT * FROM Product WHERE id = ?').get(input.id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to create product row: ${err.message}`);
    }
  }

  public update(id: string, input: UpdateProductInput): Product {
    try {
      const db = getDatabaseConnection();
      const existing = this.findById(id);
      if (!existing) throw new RepositoryError(`Product not found: ${id}`);
      const now = new Date().toISOString();
      const productCode   = input.productCode   !== undefined ? input.productCode   : existing.productCode;
      const name          = input.name          !== undefined ? input.name          : existing.name;
      const printName     = input.printName     !== undefined ? input.printName     : existing.printName;
      const description   = input.description   !== undefined ? input.description   : existing.description;
      const categoryId    = input.categoryId    !== undefined ? input.categoryId    : existing.categoryId;
      const brandId       = input.brandId       !== undefined ? input.brandId       : existing.brandId;
      const primaryUnitId = input.primaryUnitId !== undefined ? input.primaryUnitId : existing.primaryUnitId;
      const hsnSacCode    = input.hsnSacCode    !== undefined ? input.hsnSacCode    : existing.hsnSacCode;
      const taxRateId     = input.taxRateId     !== undefined ? input.taxRateId     : existing.taxRateId;
      const productType   = input.productType   !== undefined ? input.productType   : existing.productType;
      const trackInventory     = input.trackInventory     !== undefined ? input.trackInventory     : existing.trackInventory;
      const allowNegativeStock = input.allowNegativeStock !== undefined ? input.allowNegativeStock : existing.allowNegativeStock;
      const minimumStockLevel  = input.minimumStockLevel  !== undefined ? input.minimumStockLevel  : existing.minimumStockLevel;
      const reorderLevel       = input.reorderLevel       !== undefined ? input.reorderLevel       : existing.reorderLevel;
      const maximumStockLevel  = input.maximumStockLevel  !== undefined ? input.maximumStockLevel  : existing.maximumStockLevel;
      const sku        = input.sku     !== undefined ? input.sku     : existing.sku;
      const isActive   = input.isActive !== undefined ? input.isActive : existing.isActive;
      const normSku = sku ? normalizeStr(sku) : null;
      db.prepare(`
        UPDATE Product SET
          productCode=?, normalizedProductCode=?, name=?, normalizedName=?,
          printName=?, description=?, categoryId=?, brandId=?, primaryUnitId=?,
          hsnSacCode=?, taxRateId=?, productType=?, trackInventory=?, allowNegativeStock=?,
          minimumStockLevel=?, reorderLevel=?, maximumStockLevel=?,
          sku=?, normalizedSku=?, isActive=?, version=version+1, updatedAt=?
        WHERE id=?
      `).run(
        productCode, normalizeStr(productCode), name, normalizeStr(name),
        printName || null, description || null,
        categoryId || null, brandId || null, primaryUnitId,
        hsnSacCode || null, taxRateId || null,
        productType, trackInventory ? 1 : 0, allowNegativeStock ? 1 : 0,
        minimumStockLevel ?? null, reorderLevel ?? null, maximumStockLevel ?? null,
        sku || null, normSku, isActive ? 1 : 0,
        now, id
      );
      return mapRowToProduct(db.prepare('SELECT * FROM Product WHERE id = ?').get(id));
    } catch (err: any) {
      throw new RepositoryError(`Failed to update product: ${err.message}`);
    }
  }

  /** Update ONLY the cached price fields — called exclusively by PricingService */
  public updatePriceCache(id: string, purchase: number | null, selling: number | null, mrp: number | null, wholesale: number | null): void {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE Product
        SET cachedPurchasePrice=?, cachedSellingPrice=?, cachedMrp=?, cachedWholesalePrice=?, updatedAt=?
        WHERE id=?
      `).run(purchase, selling, mrp, wholesale, now, id);
    } catch (err: any) {
      throw new RepositoryError(`Failed to update price cache: ${err.message}`);
    }
  }

  public setActive(id: string, isActive: boolean): Product {
    try {
      const db = getDatabaseConnection();
      const now = new Date().toISOString();
      db.prepare('UPDATE Product SET isActive=?, version=version+1, updatedAt=? WHERE id=?')
        .run(isActive ? 1 : 0, now, id);
      const row = db.prepare('SELECT * FROM Product WHERE id = ?').get(id);
      if (!row) throw new RepositoryError(`Product not found: ${id}`);
      return mapRowToProduct(row);
    } catch (err: any) {
      throw new RepositoryError(`Failed to set product active: ${err.message}`);
    }
  }
}
