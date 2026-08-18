import crypto from 'crypto';
import { app } from 'electron';
import { getDatabaseConnection } from '../../database/database-connection';
import { ImportJobRepository } from '../../database/repositories/import-job.repository';
import { ImportTemplateRepository } from '../../database/repositories/import-template.repository';
import { ShopRepository } from '../../database/repositories/shop.repository';
import { ImportFileParserService } from './import-file-parser.service';
import { ImportMappingService } from './import-mapping.service';
import { ImportValidationService, ValidationContext } from './import-validation.service';
import { ImportDuplicateService, DuplicateCheckResult } from './import-duplicate.service';
import { ImportTemplateService } from './import-template.service';
import {
  ImportType,
  ImportJob,
  ImportJobRow,
  ImportMapping,
  ImportDuplicatePolicy,
  ImportTransactionMode,
  ImportJobStatus,
  ImportRowStatus,
  ImportRowAction,
  ImportHistoryFilter
} from '../../../shared/types/import';

import {
  UnitImportProcessor,
  TaxRateImportProcessor,
  PriceBookImportProcessor,
  ProductImportProcessor,
  ProductBarcodeImportProcessor,
  ProductPriceImportProcessor,
  OpeningStockImportProcessor,
  SupplierImportProcessor,
  SupplierOpeningBalanceImportProcessor,
  ProcessorContext
} from './processors/entity-processors';

export class BulkImportService {
  private jobRepo = new ImportJobRepository();
  private templateRepo = new ImportTemplateRepository();
  private shopRepo = new ShopRepository();
  private parserService = new ImportFileParserService();
  private mappingService = new ImportMappingService();
  private validationService = new ImportValidationService();
  private duplicateService = new ImportDuplicateService();
  private templateService = new ImportTemplateService();

  // Active cancellation token map: jobId -> cancelled flag
  private static cancellationTokens = new Map<string, boolean>();

  public selectAndRegisterFile(originalName: string, absolutePath: string): { token: string; size: number } {
    const fileData = this.parserService.registerFile(originalName, absolutePath);
    return { token: fileData.token, size: fileData.size };
  }

  public getWorksheets(token: string): string[] {
    return this.parserService.getWorksheets(token);
  }

  public getTemplates(importType: ImportType): string {
    return this.templateService.getCSVTemplateString(importType);
  }

  public createImportJob(input: {
    importType: ImportType;
    fileName: string;
    fileHash: string;
    fileSize: number;
    worksheetName: string | null;
    token: string;
  }): ImportJob {
    const id = `import-job-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const job: ImportJob = {
      id,
      importType: input.importType,
      fileName: input.fileName,
      fileHash: input.fileHash,
      fileSize: input.fileSize,
      worksheetName: input.worksheetName,
      status: 'CREATED',
      duplicatePolicy: 'SKIP_DUPLICATES', // default
      transactionMode: this.getDefaultTransactionMode(input.importType),
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      errorSummary: null,
      appVersion: app.getVersion()
    };

    this.jobRepo.createJob(job);
    return job;
  }

  public parseAndPrepareJob(jobId: string, token: string, worksheetName?: string): void {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    const parseStart = Date.now();
    const rows = this.parserService.parseRows(token, worksheetName);
    const duration = Date.now() - parseStart;

    // Detect and exclude example instruction row from template downloads
    let dataRows = rows;
    if (rows.length > 0) {
      const firstRow = rows[0] as Record<string, any>;
      const keys = Object.keys(firstRow);
      // If the first data row cells are all describing the format (starts with "Unique" or "Category" or "Details" etc.)
      const isExample = keys.some(k => String(firstRow[k]).includes('Unique abbreviation') || String(firstRow[k]).includes('Full description name'));
      if (isExample) {
        dataRows = rows.slice(1);
      }
    }

    if (dataRows.length === 0) {
      throw new Error('The uploaded file contains no valid data rows.');
    }

    const jobRows: ImportJobRow[] = dataRows.map((r, index) => {
      const now = new Date().toISOString();
      return {
        id: `row-${crypto.randomUUID()}`,
        importJobId: jobId,
        rowNumber: index + 1,
        sourceKey: null,
        normalizedSourceKey: null,
        rowHash: this.computeRowHash(job.importType, r),
        status: 'PENDING',
        action: 'SKIP',
        errorCode: null,
        errorMessage: null,
        sourceDataJson: JSON.stringify(r),
        normalizedDataJson: null,
        resultRecordId: null,
        createdAt: now,
        updatedAt: now
      };
    });

    const db = getDatabaseConnection();
    db.transaction(() => {
      this.jobRepo.createRows(jobRows);
      this.jobRepo.updateJobStatus(jobId, 'FILE_PARSED', {
        totalRows: jobRows.length,
        errorSummary: `Parsed file in ${duration}ms.`
      });
    })();
  }

  public getColumnMappingProfile(jobId: string, token: string): ImportMapping {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    const rows = this.parserService.parseRows(token, job.worksheetName || undefined);
    if (rows.length === 0) return {};

    const fileHeaders = Object.keys(rows[0] as object);
    return this.mappingService.autoMatchHeaders(job.importType, fileHeaders);
  }

  public validateJob(jobId: string, mapping: ImportMapping): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    const db = getDatabaseConnection();
    const headers = this.getFileHeaders(jobId);

    // 1. Validate mapping profile configuration
    const mappingValidation = this.mappingService.validateMapping(job.importType, mapping, headers);
    if (!mappingValidation.isValid) {
      return mappingValidation;
    }

    // 2. Perform batched validation on rows
    const validationStart = Date.now();
    const context = this.buildValidationContext();
    const rows = this.jobRepo.getRowsByJobId(jobId);
    const cols = ImportTemplateService.getColumnDefinitions(job.importType);

    // Map rows first so evaluateDuplicates receives schema field names (e.g. productCode)
    // NOT raw CSV header names (e.g. "Product Code*") which would make every key resolve to "".
    const mappedRowsForDupCheck = rows.map(r => this.mappingService.mapRow(JSON.parse(r.sourceDataJson), mapping, cols));
    const fileDuplicateResults = this.duplicateService.evaluateDuplicates(job.importType, mappedRowsForDupCheck, context, job.duplicatePolicy);

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    db.transaction(() => {
      for (const r of rows) {
        const rawData = JSON.parse(r.sourceDataJson);
        const mappedData = this.mappingService.mapRow(rawData, mapping, cols);

        // Run validation rules
        const { errors, warnings } = this.validationService.validateRow(job.importType, mappedData, context, r.rowNumber);

        // Run duplicate validator
        const dup = fileDuplicateResults.get(r.rowNumber);

        let status: ImportRowStatus = 'VALID';
        let action: ImportRowAction = 'INSERT';
        let errorCode: string | null = null;
        let errorMessage: string | null = null;

        if (errors.length > 0) {
          status = 'INVALID';
          action = 'REJECT';
          errorCode = 'VAL_ERR';
          errorMessage = errors.join('; ');
          invalidCount++;
        } else if (dup && dup.recommendedAction === 'REJECT') {
          status = dup.duplicateType === 'FILE_DUPLICATE' ? 'DUPLICATE_IN_FILE' : 'DUPLICATE_IN_DATABASE';
          action = 'REJECT';
          errorCode = dup.duplicateType;
          errorMessage = dup.message;
          duplicateCount++;
        } else if (dup && dup.recommendedAction === 'SKIP') {
          status = dup.duplicateType === 'FILE_DUPLICATE' ? 'DUPLICATE_IN_FILE' : 'DUPLICATE_IN_DATABASE';
          action = 'SKIP';
          errorCode = dup.duplicateType;
          errorMessage = dup.message;
          duplicateCount++;
        } else if (dup && dup.recommendedAction === 'UPDATE') {
          status = 'DUPLICATE_IN_DATABASE';
          action = 'UPDATE';
          errorCode = 'DB_DUP';
          errorMessage = dup.message;
          validCount++; // update-existing is technically valid
        } else {
          validCount++;
        }

        const sourceKey = this.extractBusinessKey(job.importType, mappedData);

        this.jobRepo.updateRowNormalizedData(
          r.id,
          JSON.stringify(mappedData),
          status,
          action,
          errorCode,
          errorMessage
        );

        // Update row business keys
        db.prepare('UPDATE "ImportJobRow" SET sourceKey = ?, normalizedSourceKey = ? WHERE id = ?').run(
          sourceKey,
          sourceKey ? sourceKey.toLowerCase() : null,
          r.id
        );
      }

      const duration = Date.now() - validationStart;
      this.jobRepo.updateJobStatus(jobId, 'VALIDATED', {
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
        errorSummary: `Validated job rows in ${duration}ms.`
      });
    })();

    return {
      isValid: true,
      errors: [],
      warnings: mappingValidation.warnings
    };
  }

  public setDuplicatePolicy(jobId: string, policy: ImportDuplicatePolicy): void {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    // Opening Stock and Supplier Opening Balance do NOT permit UPDATE_EXISTING
    if (policy === 'UPDATE_EXISTING' && (job.importType === 'OPENING_STOCK' || job.importType === 'SUPPLIER_OPENING_BALANCE')) {
      throw new Error('Opening Stock and Supplier Opening Balance balances cannot be overwritten.');
    }

    this.jobRepo.updateJobStatus(jobId, job.status, { duplicatePolicy: policy });
  }

  public cancelImportJob(jobId: string): void {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    BulkImportService.cancellationTokens.set(jobId, true);
    this.jobRepo.updateJobStatus(jobId, 'CANCELLED', {
      cancelledAt: new Date().toISOString()
    });
  }

  public executeImport(jobId: string, transactionMode: ImportTransactionMode): void {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Import job not found.');

    if (job.status !== 'VALIDATED') {
      throw new Error('Import execution requires a prior successful validation review.');
    }

    BulkImportService.cancellationTokens.set(jobId, false);
    this.jobRepo.updateJobStatus(jobId, 'PROCESSING', {
      transactionMode,
      startedAt: new Date().toISOString()
    });

    const executionStart = Date.now();
    const rows = this.jobRepo.getRowsByJobId(jobId);
    const context = this.buildValidationContext();
    const processorContext: ProcessorContext = {
      shopId: context.shopId,
      existingUnits: context.existingUnits,
      existingTaxRates: context.existingTaxRates,
      existingPriceBooks: context.existingPriceBooks,
      existingProducts: context.existingProducts,
      existingSuppliers: context.existingSuppliers
    };

    const db = getDatabaseConnection();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // Check pre-commit duplicate lookup on exact keys to prevent race conditions.
    // Use normalizedDataJson (already mapped to schema field names) so business keys resolve correctly.
    const finalDupCheck = this.duplicateService.evaluateDuplicates(
      job.importType,
      rows.map(r => JSON.parse(r.normalizedDataJson || '{}')),
      context,
      job.duplicatePolicy
    );

    // Initialise entity processors
    const unitProcessor = new UnitImportProcessor();
    const taxProcessor = new TaxRateImportProcessor();
    const pbProcessor = new PriceBookImportProcessor();
    const prodProcessor = new ProductImportProcessor();
    const barcodeProcessor = new ProductBarcodeImportProcessor();
    const priceProcessor = new ProductPriceImportProcessor();
    const stockProcessor = new OpeningStockImportProcessor();
    const supplierProcessor = new SupplierImportProcessor();
    const balanceProcessor = new SupplierOpeningBalanceImportProcessor();

    // -------------------------------------------------------------------------
    // TRANSACTION MODE: ATOMIC (ALL OR NOTHING)
    // -------------------------------------------------------------------------
    if (transactionMode === 'ATOMIC_ALL_OR_NOTHING') {
      try {
        db.transaction(() => {
          for (const r of rows) {
            // Check cancellation request
            if (BulkImportService.cancellationTokens.get(jobId) === true) {
              throw new Error('Import cancelled by user.');
            }

            if (r.status === 'INVALID' || r.action === 'REJECT') {
              throw new Error(`Atomic import failed due to Row ${r.rowNumber} invalid values.`);
            }

            const mappedData = JSON.parse(r.normalizedDataJson!);

            // Re-validate duplicates pre-commit
            const finalDup = finalDupCheck.get(r.rowNumber);
            if (finalDup && finalDup.recommendedAction === 'REJECT') {
              throw new Error(`Conflict detected pre-commit at row ${r.rowNumber}: ${finalDup.message}`);
            }

            const action = finalDup ? finalDup.recommendedAction : r.action;

            if (action === 'SKIP') {
              skipped++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP');
              continue;
            }

            // Execute actual write
            const recordId = this.executeProcessorRow(
              job.importType,
              mappedData,
              action as any,
              processorContext,
              unitProcessor,
              taxProcessor,
              pbProcessor,
              prodProcessor,
              barcodeProcessor,
              priceProcessor,
              stockProcessor,
              supplierProcessor,
              balanceProcessor
            );

            if (action === 'INSERT') {
              inserted++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'INSERTED', 'INSERT', null, null, recordId);
            } else if (action === 'UPDATE') {
              updated++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'UPDATED', 'UPDATE', null, null, recordId);
            }
          }
        })();

        // Commit succeeded
        const duration = Date.now() - executionStart;
        this.jobRepo.updateJobStatus(jobId, 'COMPLETED', {
          insertedRows: inserted,
          updatedRows: updated,
          skippedRows: skipped,
          completedAt: new Date().toISOString(),
          errorSummary: `Import execution completed in ${duration}ms.`
        });
      } catch (err: any) {
        // Rollback occurred.
        // Update job status OUTSIDE the rolled-back transaction to preserve logging!
        const duration = Date.now() - executionStart;
        this.jobRepo.updateJobStatus(jobId, 'FAILED', {
          failedRows: rows.length,
          completedAt: new Date().toISOString(),
          errorSummary: `Atomic Import aborted & rolled back: ${err.message}`
        });

        // Set all rows status as failed in a separate transaction
        db.transaction(() => {
          for (const r of rows) {
            this.jobRepo.updateRowStatusAndAction(r.id, 'FAILED', 'REJECT', 'ATOMIC_ROLLBACK', err.message);
          }
        })();
      }
    }
    // -------------------------------------------------------------------------
    // TRANSACTION MODE: VALID ROWS ONLY
    // -------------------------------------------------------------------------
    else {
      // Process rows in controlled batches of 100
      const BATCH_SIZE = 100;
      let pointer = 0;

      while (pointer < rows.length) {
        if (BulkImportService.cancellationTokens.get(jobId) === true) {
          // Cancel remaining rows
          db.transaction(() => {
            for (let j = pointer; j < rows.length; j++) {
              this.jobRepo.updateRowStatusAndAction(rows[j].id, 'SKIPPED', 'SKIP', 'CANCELLED', 'Import cancelled.');
              skipped++;
            }
          })();
          break;
        }

        const batch = rows.slice(pointer, pointer + BATCH_SIZE);
        pointer += BATCH_SIZE;

        try {
          db.transaction(() => {
            for (const r of batch) {
              if (r.status === 'INVALID' || r.action === 'REJECT') {
                skipped++;
                this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP', 'VAL_ERR', r.errorMessage);
                continue;
              }

              const mappedData = JSON.parse(r.normalizedDataJson!);
              const finalDup = finalDupCheck.get(r.rowNumber);

              if (finalDup && finalDup.recommendedAction === 'REJECT') {
                skipped++;
                this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP', 'CONFLICT', finalDup.message);
                continue;
              }

              const action = finalDup ? finalDup.recommendedAction : r.action;

              if (action === 'SKIP') {
                skipped++;
                this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP', null, r.errorMessage);
                continue;
              }

              try {
                const recordId = this.executeProcessorRow(
                  job.importType,
                  mappedData,
                  action as any,
                  processorContext,
                  unitProcessor,
                  taxProcessor,
                  pbProcessor,
                  prodProcessor,
                  barcodeProcessor,
                  priceProcessor,
                  stockProcessor,
                  supplierProcessor,
                  balanceProcessor
                );

                if (action === 'INSERT') {
                  inserted++;
                  this.jobRepo.updateRowStatusAndAction(r.id, 'INSERTED', 'INSERT', null, null, recordId);
                } else if (action === 'UPDATE') {
                  updated++;
                  this.jobRepo.updateRowStatusAndAction(r.id, 'UPDATED', 'UPDATE', null, null, recordId);
                }
              } catch (rowErr: any) {
                // If a specific row fails inside a committed batch:
                // We throw to rollback this batch and retry row-by-row individually inside this batch.
                throw rowErr;
              }
            }
          })();
        } catch (batchErr: any) {
          // If batch failed, retry rows in this batch INDIVIDUALLY to isolate the error row
          for (const r of batch) {
            if (r.status === 'INVALID' || r.action === 'REJECT') {
              skipped++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP', 'VAL_ERR', r.errorMessage);
              continue;
            }

            const mappedData = JSON.parse(r.normalizedDataJson!);
            const finalDup = finalDupCheck.get(r.rowNumber);
            const action = finalDup ? finalDup.recommendedAction : r.action;

            if (action === 'SKIP') {
              skipped++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'SKIPPED', 'SKIP');
              continue;
            }

            try {
              let rowRecordId = '';
              db.transaction(() => {
                rowRecordId = this.executeProcessorRow(
                  job.importType,
                  mappedData,
                  action as any,
                  processorContext,
                  unitProcessor,
                  taxProcessor,
                  pbProcessor,
                  prodProcessor,
                  barcodeProcessor,
                  priceProcessor,
                  stockProcessor,
                  supplierProcessor,
                  balanceProcessor
                );
              })();

              if (action === 'INSERT') {
                inserted++;
                this.jobRepo.updateRowStatusAndAction(r.id, 'INSERTED', 'INSERT', null, null, rowRecordId);
              } else if (action === 'UPDATE') {
                updated++;
                this.jobRepo.updateRowStatusAndAction(r.id, 'UPDATED', 'UPDATE', null, null, rowRecordId);
              }
            } catch (singleRowErr: any) {
              failed++;
              this.jobRepo.updateRowStatusAndAction(r.id, 'FAILED', 'REJECT', 'ROW_WRITE_ERR', singleRowErr.message);
            }
          }
        }
      }

      // Complete job status outside transactions
      const duration = Date.now() - executionStart;
      const status: ImportJobStatus = BulkImportService.cancellationTokens.get(jobId) === true
        ? 'CANCELLED'
        : (failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED');

      this.jobRepo.updateJobStatus(jobId, status, {
        insertedRows: inserted,
        updatedRows: updated,
        skippedRows: skipped,
        failedRows: failed,
        completedAt: new Date().toISOString(),
        errorSummary: `Import executed in ${duration}ms. Success: ${inserted + updated}, Failed: ${failed}.`
      });
    }
  }

  public getHistory(filter: ImportHistoryFilter): ImportJob[] {
    return this.jobRepo.listJobs(filter);
  }

  public getJobResult(jobId: string): ImportJob | null {
    return this.jobRepo.findJobById(jobId);
  }

  public getRowsPreview(jobId: string, pageIndex = 0, pageSize = 50): { items: ImportJobRow[]; totalItems: number } {
    return this.jobRepo.getRowsPreview(jobId, undefined, pageIndex, pageSize);
  }

  public getJobErrorsCsv(jobId: string): string {
    const job = this.jobRepo.findJobById(jobId);
    if (!job) throw new Error('Job not found.');

    const errorRows = this.jobRepo.getRowsByStatus(jobId, ['INVALID', 'DUPLICATE_IN_FILE', 'DUPLICATE_IN_DATABASE', 'FAILED']);
    
    // Headers: Row Number, Import Type, Business Key, Status, Error Code, Error Message, original row content
    const headers = ['Row Number', 'Import Type', 'Business Key', 'Status', 'Error Code', 'Error Message', 'Original Row Data'].map(h => this.templateService.safeCsvCell(h)).join(',');
    const body = errorRows.map(r => {
      const parts = [
        r.rowNumber,
        job.importType,
        r.sourceKey || '',
        r.status,
        r.errorCode || '',
        r.errorMessage || '',
        r.sourceDataJson
      ];
      return parts.map(p => this.templateService.safeCsvCell(p)).join(',');
    }).join('\n');

    return `${headers}\n${body}\n`;
  }

  // Execute the specific entity processor row synchronously inside execution transactions
  private executeProcessorRow(
    type: ImportType,
    data: Record<string, any>,
    action: 'INSERT' | 'UPDATE' | 'SKIP',
    context: ProcessorContext,
    unit: UnitImportProcessor,
    tax: TaxRateImportProcessor,
    pb: PriceBookImportProcessor,
    prod: ProductImportProcessor,
    barcode: ProductBarcodeImportProcessor,
    price: ProductPriceImportProcessor,
    stock: OpeningStockImportProcessor,
    supplier: SupplierImportProcessor,
    balance: SupplierOpeningBalanceImportProcessor
  ): string {
    if (action === 'SKIP') return '';

    switch (type) {
      case 'UNIT':
        return unit.process(data, action as any);
      case 'TAX_RATE':
        return tax.process(data, action as any);
      case 'PRICE_BOOK':
        return pb.process(data, action as any);
      case 'PRODUCT':
        return prod.processSync(data, action as any, context);
      case 'PRODUCT_BARCODE':
        return barcode.process(data, action as any);
      case 'PRODUCT_PRICE':
        return price.process(data, action as any, context);
      case 'OPENING_STOCK':
        return stock.process(data, context);
      case 'SUPPLIER':
        return supplier.processSync(data, action as any);
      case 'SUPPLIER_OPENING_BALANCE':
        return balance.process(data, context);
      default:
        throw new Error(`Unsupported processor: ${type}`);
    }
  }

  private buildValidationContext(): ValidationContext {
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop setup is required before performing bulk imports.');

    const db = getDatabaseConnection();

    // Cache Units
    const unitsMap = new Map<string, string>();
    const units = db.prepare('SELECT id, shortName FROM UnitOfMeasure').all() as { id: string; shortName: string }[];
    for (const u of units) {
      unitsMap.set(u.shortName.trim().toLowerCase(), u.id);
    }

    // Cache TaxRates (taxCode maps to "name" in db)
    const taxRatesMap = new Map<string, string>();
    const taxRates = db.prepare('SELECT id, name FROM TaxRate').all() as { id: string; name: string }[];
    for (const t of taxRates) {
      taxRatesMap.set(t.name.trim().toLowerCase(), t.id);
    }

    // Cache PriceBooks
    const priceBooksMap = new Map<string, string>();
    const priceBooks = db.prepare('SELECT id, code FROM PriceBook').all() as { id: string; code: string }[];
    for (const pb of priceBooks) {
      priceBooksMap.set(pb.code.trim().toLowerCase(), pb.id);
    }

    // Cache Products
    const productsMap = new Map<string, { id: string; productType: string; trackInventory: boolean }>();
    const products = db.prepare('SELECT id, productCode, productType, trackInventory FROM Product').all() as { id: string; productCode: string; productType: string; trackInventory: number }[];
    for (const p of products) {
      productsMap.set(p.productCode.trim().toLowerCase(), {
        id: p.id,
        productType: p.productType,
        trackInventory: p.trackInventory === 1
      });
    }

    // Cache Suppliers
    const suppliersMap = new Map<string, { id: string; gstNumber: string | null; panNumber: string | null; phone: string | null }>();
    const suppliers = db.prepare('SELECT id, supplierCode, gstNumber, panNumber, phone FROM Supplier').all() as { id: string; supplierCode: string; gstNumber: string | null; panNumber: string | null; phone: string | null }[];
    for (const s of suppliers) {
      suppliersMap.set(s.supplierCode.trim().toLowerCase(), {
        id: s.id,
        gstNumber: s.gstNumber,
        panNumber: s.panNumber,
        phone: s.phone
      });
    }

    // Cache Barcodes
    const barcodesSet = new Set<string>();
    const barcodes = db.prepare('SELECT barcode FROM ProductBarcode WHERE isActive=1').all() as { barcode: string }[];
    for (const b of barcodes) {
      barcodesSet.add(b.barcode.trim());
    }

    // Cache Product Prices
    const prices = db.prepare('SELECT productId, priceBookId, effectiveFrom, effectiveTo FROM ProductPrice WHERE isActive=1').all() as { productId: string; priceBookId: string; effectiveFrom: string; effectiveTo: string | null }[];

    // Cache Opening Stocks
    const stockSet = new Set<string>();
    const stocks = db.prepare('SELECT productId, reference FROM InventoryOpeningBalance WHERE shopId = ?').all(shop.id) as { productId: string; reference: string | null }[];
    // To match product code we map it back
    const prodIdToCode = new Map<string, string>();
    for (const [code, p] of productsMap.entries()) {
      prodIdToCode.set(p.id, code);
    }
    for (const s of stocks) {
      const pCode = prodIdToCode.get(s.productId) || '';
      if (s.reference && pCode) {
        // Compound identity: Shop + Reference Number + Product Code + Batch Number (we default batch to empty in existing balances query)
        const key = `${s.reference}|${pCode.toLowerCase()}|`;
        stockSet.add(key);
      }
    }

    // Cache Supplier ledger opening entries
    const balanceSet = new Set<string>();
    const balances = db.prepare("SELECT supplierId, referenceNumber FROM SupplierLedgerEntry WHERE entryType = 'OPENING_BALANCE'").all() as { supplierId: string; referenceNumber: string | null }[];
    const supIdToCode = new Map<string, string>();
    for (const [code, s] of suppliersMap.entries()) {
      supIdToCode.set(s.id, code);
    }
    for (const b of balances) {
      const sCode = supIdToCode.get(b.supplierId) || '';
      if (b.referenceNumber && sCode) {
        const key = `${sCode.toLowerCase()}|${b.referenceNumber.toLowerCase()}`;
        balanceSet.add(key);
      }
    }

    return {
      shopId: shop.id,
      existingUnits: unitsMap,
      existingTaxRates: taxRatesMap,
      existingPriceBooks: priceBooksMap,
      existingProducts: productsMap,
      existingSuppliers: suppliersMap,
      existingProductBarcodes: barcodesSet,
      existingProductPrices: prices,
      existingOpeningStocks: stockSet,
      existingSupplierBalances: balanceSet
    };
  }

  private getDefaultTransactionMode(importType: ImportType): ImportTransactionMode {
    if (importType === 'OPENING_STOCK' || importType === 'SUPPLIER_OPENING_BALANCE' || importType === 'PRODUCT_PRICE') {
      return 'ATOMIC_ALL_OR_NOTHING';
    }
    return 'VALID_ROWS_ONLY';
  }

  private computeRowHash(type: ImportType, row: any): string {
    const raw = JSON.stringify(row);
    return crypto.createHash('sha256').update(`${type}|${raw}`).digest('hex');
  }

  private extractBusinessKey(type: ImportType, mappedRow: Record<string, any>): string | null {
    switch (type) {
      case 'UNIT':
        return mappedRow.unitCode || null;
      case 'TAX_RATE':
        return mappedRow.taxCode || null;
      case 'PRICE_BOOK':
        return mappedRow.code || null;
      case 'PRODUCT':
        return mappedRow.productCode || null;
      case 'PRODUCT_BARCODE':
        return mappedRow.barcode || null;
      case 'PRODUCT_PRICE':
        return `${mappedRow.productCode || ''}-${mappedRow.priceBookCode || ''}-${mappedRow.effectiveFrom || ''}`;
      case 'OPENING_STOCK':
        return `${mappedRow.referenceNumber || ''}-${mappedRow.productCode || ''}`;
      case 'SUPPLIER':
        return mappedRow.supplierCode || null;
      case 'SUPPLIER_OPENING_BALANCE':
        return `${mappedRow.supplierCode || ''}-${mappedRow.referenceNumber || ''}`;
      default:
        return null;
    }
  }

  private getFileHeaders(jobId: string): string[] {
    const rows = this.jobRepo.getRowsByJobId(jobId, 1);
    if (rows.length === 0) return [];
    return Object.keys(JSON.parse(rows[0].sourceDataJson));
  }
}
