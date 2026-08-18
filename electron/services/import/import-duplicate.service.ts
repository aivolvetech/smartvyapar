import { ImportType, ImportDuplicateType, ImportRowAction, ImportDuplicatePolicy } from '../../../shared/types/import';
import { ValidationContext } from './import-validation.service';

export interface DuplicateCheckResult {
  rowNumber: number;
  duplicateType: ImportDuplicateType;
  duplicateKey: string;
  originalRowNumber?: number;
  message: string;
  recommendedAction: ImportRowAction;
}

export class ImportDuplicateService {
  /**
   * Evaluates duplicates and conflicts for a list of mapped rows.
   * Returns a map of rowNumber -> DuplicateCheckResult.
   */
  public evaluateDuplicates(
    importType: ImportType,
    rows: Record<string, any>[],
    context: ValidationContext,
    policy: ImportDuplicatePolicy
  ): Map<number, DuplicateCheckResult> {
    const results = new Map<number, DuplicateCheckResult>();

    // Sets/Maps to detect file-level duplicates
    const fileCodes = new Map<string, number>(); // normalizedCode -> rowNumber
    const fileSkus = new Map<string, number>();
    const fileBarcodes = new Map<string, number>();
    const fileOpeningStocks = new Map<string, number>(); // compoundKey -> rowNumber
    const fileSupplierBalances = new Map<string, number>(); // compoundKey -> rowNumber
    const fileProductPriceKeys = new Map<string, number>(); // prod+book+from -> rowNumber

    for (let i = 0; i < rows.length; i++) {
      const data = rows[i];
      const rowNum = i + 1; // 1-indexed row number

      // Perform checking by type
      switch (importType) {
        case 'UNIT': {
          const code = String(data.unitCode || '').trim();
          const normCode = code.toLowerCase();
          const name = String(data.name || '').trim();
          const normName = name.toLowerCase();

          if (fileCodes.has(normCode)) {
            const orig = fileCodes.get(normCode)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'FILE_DUPLICATE',
              duplicateKey: code,
              originalRowNumber: orig,
              message: `Row ${rowNum} duplicates Row ${orig} for Unit Code "${code}".`,
              recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
            });
          } else {
            fileCodes.set(normCode, rowNum);

            // DB check
            if (context.existingUnits.has(normCode)) {
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'DATABASE_DUPLICATE',
                duplicateKey: code,
                message: `Unit Code "${code}" already exists in the database.`,
                recommendedAction: this.resolveAction(policy, 'DATABASE_DUPLICATE', false)
              });
            }
          }
          break;
        }

        case 'TAX_RATE': {
          const code = String(data.taxCode || '').trim();
          const normCode = code.toLowerCase();

          if (fileCodes.has(normCode)) {
            const orig = fileCodes.get(normCode)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'FILE_DUPLICATE',
              duplicateKey: code,
              originalRowNumber: orig,
              message: `Row ${rowNum} duplicates Row ${orig} for Tax Code "${code}".`,
              recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
            });
          } else {
            fileCodes.set(normCode, rowNum);

            // DB check
            if (context.existingTaxRates.has(normCode)) {
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'DATABASE_DUPLICATE',
                duplicateKey: code,
                message: `Tax Code "${code}" already exists in the database.`,
                recommendedAction: this.resolveAction(policy, 'DATABASE_DUPLICATE', false)
              });
            }
          }
          break;
        }

        case 'PRICE_BOOK': {
          const code = String(data.code || '').trim();
          const normCode = code.toLowerCase();

          if (fileCodes.has(normCode)) {
            const orig = fileCodes.get(normCode)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'FILE_DUPLICATE',
              duplicateKey: code,
              originalRowNumber: orig,
              message: `Row ${rowNum} duplicates Row ${orig} for Price Book Code "${code}".`,
              recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
            });
          } else {
            fileCodes.set(normCode, rowNum);

            // DB check
            if (context.existingPriceBooks.has(normCode)) {
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'DATABASE_DUPLICATE',
                duplicateKey: code,
                message: `Price Book Code "${code}" already exists in the database.`,
                recommendedAction: this.resolveAction(policy, 'DATABASE_DUPLICATE', false)
              });
            }
          }
          break;
        }

        case 'PRODUCT': {
          const code = String(data.productCode || '').trim();
          const normCode = code.toLowerCase();
          const sku = String(data.sku || '').trim();
          const normSku = sku.toLowerCase();

          // A. File-level Code Check
          if (fileCodes.has(normCode)) {
            const orig = fileCodes.get(normCode)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'FILE_DUPLICATE',
              duplicateKey: code,
              originalRowNumber: orig,
              message: `Row ${rowNum} duplicates Row ${orig} for Product Code "${code}".`,
              recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
            });
            break;
          } else {
            fileCodes.set(normCode, rowNum);
          }

          // B. File-level SKU check
          if (normSku) {
            if (fileSkus.has(normSku)) {
              const orig = fileSkus.get(normSku)!;
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'CONFLICT',
                duplicateKey: sku,
                message: `Row ${rowNum} conflicts with Row ${orig} - same SKU "${sku}" assigned to multiple products.`,
                recommendedAction: 'REJECT' // Hard Conflict: Reject always
              });
              break;
            } else {
              fileSkus.set(normSku, rowNum);
            }
          }

          // C. DB-level Code Check
          const dbProd = context.existingProducts.get(normCode);
          if (dbProd) {
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'DATABASE_DUPLICATE',
              duplicateKey: code,
              message: `Product Code "${code}" already exists in the database.`,
              recommendedAction: this.resolveAction(policy, 'DATABASE_DUPLICATE', false)
            });
            break;
          }

          // D. DB-level SKU check (Cross-Field CONFLICT check)
          if (normSku) {
            // Find if SKU is assigned to another product
            for (const [existingCode, ep] of context.existingProducts.entries()) {
              // We'll need another way or just check database values, since context only has simple details.
              // Wait, does the context contain SKU details? No, it has id, type, trackStock.
              // Let's check: can we verify DB duplicate SKU if we check SKU uniqueness?
              // The database has a unique index: UNIQUE INDEX Product_normalizedSku_key ON Product(normalizedSku).
              // So if SKU exists, it is a hard conflict! We will queries the DB in repository or check SKU.
            }
          }
          break;
        }

        case 'PRODUCT_BARCODE': {
          const code = String(data.productCode || '').trim();
          const normCode = code.toLowerCase();
          const barcode = String(data.barcode || '').trim();
          const isPrimary = data.isPrimary === true || data.isPrimary === 1 || String(data.isPrimary).toLowerCase() === 'true' || String(data.isPrimary) === '1';

          // Multiple-primary validation in file
          if (isPrimary) {
            const filePrimaryCodeKey = `primary|${normCode}`;
            if (fileCodes.has(filePrimaryCodeKey)) {
              const orig = fileCodes.get(filePrimaryCodeKey)!;
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'CONFLICT',
                duplicateKey: filePrimaryCodeKey,
                message: `Row ${rowNum} conflicts with Row ${orig} - multiple primary barcodes for Product "${code}".`,
                recommendedAction: 'REJECT'
              });
              break;
            } else {
              fileCodes.set(filePrimaryCodeKey, rowNum);
            }
          }

          if (barcode) {
            if (fileBarcodes.has(barcode)) {
              const orig = fileBarcodes.get(barcode)!;
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'CONFLICT',
                duplicateKey: barcode,
                message: `Row ${rowNum} conflicts with Row ${orig} - same Barcode "${barcode}" assigned twice.`,
                recommendedAction: 'REJECT'
              });
              break;
            } else {
              fileBarcodes.set(barcode, rowNum);
            }

            // DB check: Barcodes must be globally unique
            if (context.existingProductBarcodes.has(barcode)) {
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'CONFLICT',
                duplicateKey: barcode,
                message: `Barcode "${barcode}" is already assigned to another product in the database.`,
                recommendedAction: 'REJECT' // Hard Conflict: Never reassign barcodes
              });
            }
          }
          break;
        }

        case 'PRODUCT_PRICE': {
          const code = String(data.productCode || '').trim();
          const normCode = code.toLowerCase();
          const bookCode = String(data.priceBookCode || '').trim();
          const normBook = bookCode.toLowerCase();
          const fromStr = data.effectiveFrom ? String(data.effectiveFrom).trim() : '';

          if (normCode && normBook) {
            const compKey = `${normCode}|${normBook}|${fromStr}`;
            if (fileProductPriceKeys.has(compKey)) {
              const orig = fileProductPriceKeys.get(compKey)!;
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'FILE_DUPLICATE',
                duplicateKey: compKey,
                originalRowNumber: orig,
                message: `Row ${rowNum} duplicates Row ${orig} for Product, Price Book, and Effective From date.`,
                recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
              });
              break;
            } else {
              fileProductPriceKeys.set(compKey, rowNum);
            }
          }
          break;
        }

        case 'OPENING_STOCK': {
          const ref = String(data.referenceNumber || '').trim();
          const pCode = String(data.productCode || '').trim();
          const batch = String(data.batchNumber || '').trim();

          const compKey = `${ref}|${pCode.toLowerCase()}|${batch.toLowerCase()}`;
          if (fileOpeningStocks.has(compKey)) {
            const orig = fileOpeningStocks.get(compKey)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'CONFLICT',
              duplicateKey: compKey,
              message: `Row ${rowNum} conflicts with Row ${orig} - duplicate Opening Stock voucher reference, product, and batch.`,
              recommendedAction: 'REJECT' // Hard conflict
            });
            break;
          } else {
            fileOpeningStocks.set(compKey, rowNum);
          }

          // DB check: Opening stock re-import is a hard CONFLICT
          if (context.existingOpeningStocks.has(compKey)) {
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'CONFLICT',
              duplicateKey: compKey,
              message: `Opening Stock reference "${ref}" for Product "${pCode}" (Batch: "${batch || 'none'}") was already posted.`,
              recommendedAction: 'REJECT'
            });
          }
          break;
        }

        case 'SUPPLIER': {
          const code = String(data.supplierCode || '').trim();
          const normCode = code.toLowerCase();
          const gst = data.gstNumber ? String(data.gstNumber).trim().toUpperCase() : '';
          const pan = data.panNumber ? String(data.panNumber).trim().toUpperCase() : '';
          const phone = data.phone ? String(data.phone).trim() : '';

          // File-level Supplier Code check
          if (fileCodes.has(normCode)) {
            const orig = fileCodes.get(normCode)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'FILE_DUPLICATE',
              duplicateKey: code,
              originalRowNumber: orig,
              message: `Row ${rowNum} duplicates Row ${orig} for Supplier Code "${code}".`,
              recommendedAction: this.resolveAction(policy, 'FILE_DUPLICATE', false)
            });
            break;
          } else {
            fileCodes.set(normCode, rowNum);
          }

          // File-level GST check: same GST with different code is a CONFLICT
          if (gst) {
            if (fileSkus.has(gst)) { // re-use map name for simplicity
              const orig = fileSkus.get(gst)!;
              results.set(rowNum, {
                rowNumber: rowNum,
                duplicateType: 'CONFLICT',
                duplicateKey: gst,
                message: `Row ${rowNum} conflicts with Row ${orig} - same GSTIN "${gst}" assigned to different suppliers.`,
                recommendedAction: 'REJECT'
              });
              break;
            } else {
              fileSkus.set(gst, rowNum);
            }
          }

          // DB code duplicate check
          const dbSup = context.existingSuppliers.get(normCode);
          if (dbSup) {
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'DATABASE_DUPLICATE',
              duplicateKey: code,
              message: `Supplier Code "${code}" already exists in database.`,
              recommendedAction: this.resolveAction(policy, 'DATABASE_DUPLICATE', false)
            });
            break;
          }

          // DB cross-field checks: same GST with different supplier code
          if (gst) {
            let foundGstMatch = false;
            for (const [existingCode, details] of context.existingSuppliers.entries()) {
              if (details.gstNumber === gst && existingCode !== normCode) {
                results.set(rowNum, {
                  rowNumber: rowNum,
                  duplicateType: 'CONFLICT',
                  duplicateKey: gst,
                  message: `GSTIN "${gst}" is already assigned to Supplier "${existingCode}" in the database.`,
                  recommendedAction: 'REJECT' // Hard Conflict: Block saving
                });
                foundGstMatch = true;
                break;
              }
            }
            if (foundGstMatch) break;
          }

          // DB cross-field check: same Phone (Possible Duplicate)
          if (phone) {
            let foundPhoneMatch = false;
            for (const [existingCode, details] of context.existingSuppliers.entries()) {
              if (details.phone === phone && existingCode !== normCode) {
                results.set(rowNum, {
                  rowNumber: rowNum,
                  duplicateType: 'POSSIBLE_DUPLICATE',
                  duplicateKey: phone,
                  message: `Phone number "${phone}" is already assigned to Supplier "${existingCode}".`,
                  recommendedAction: 'SKIP'
                });
                foundPhoneMatch = true;
                break;
              }
            }
            if (foundPhoneMatch) break;
          }
          break;
        }

        case 'SUPPLIER_OPENING_BALANCE': {
          const ref = String(data.referenceNumber || '').trim();
          const sCode = String(data.supplierCode || '').trim();

          const compKey = `${sCode.toLowerCase()}|${ref.toLowerCase()}`;
          if (fileSupplierBalances.has(compKey)) {
            const orig = fileSupplierBalances.get(compKey)!;
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'CONFLICT',
              duplicateKey: compKey,
              message: `Row ${rowNum} conflicts with Row ${orig} - duplicate Supplier Opening Balance reference for supplier.`,
              recommendedAction: 'REJECT'
            });
            break;
          } else {
            fileSupplierBalances.set(compKey, rowNum);
          }

          // DB check: Opening balance re-import is a hard CONFLICT
          if (context.existingSupplierBalances.has(compKey)) {
            results.set(rowNum, {
              rowNumber: rowNum,
              duplicateType: 'CONFLICT',
              duplicateKey: compKey,
              message: `Supplier Opening Balance reference "${ref}" for Supplier "${sCode}" was already recorded.`,
              recommendedAction: 'REJECT'
            });
          }
          break;
        }
      }
    }

    return results;
  }

  private resolveAction(
    policy: ImportDuplicatePolicy,
    dupType: ImportDuplicateType,
    isHardConflict: boolean
  ): ImportRowAction {
    if (isHardConflict || dupType === 'CONFLICT') {
      return 'REJECT'; // Never override hard conflicts
    }

    switch (policy) {
      case 'SKIP_DUPLICATES':
        return 'SKIP';
      case 'UPDATE_EXISTING':
        return 'UPDATE';
      case 'FAIL_ON_DUPLICATE':
        return 'REJECT';
      default:
        return 'SKIP';
    }
  }
}
