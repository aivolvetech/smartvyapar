import { ImportType } from '../../../shared/types/import';

export interface ValidationContext {
  shopId: string;
  existingUnits: Map<string, string>; // normShortName -> id
  existingTaxRates: Map<string, string>; // normTaxCode -> id
  existingPriceBooks: Map<string, string>; // normPriceBookCode -> id
  existingProducts: Map<string, { id: string; productType: string; trackInventory: boolean }>; // normProductCode -> details
  existingSuppliers: Map<string, { id: string; gstNumber: string | null; panNumber: string | null; phone: string | null }>; // normSupplierCode -> details
  existingProductBarcodes: Set<string>; // barcode -> true
  existingProductPrices: { productId: string; priceBookId: string; effectiveFrom: string; effectiveTo: string | null }[];
  existingOpeningStocks: Set<string>; // compoundKey (ref + productCode + batch)
  existingSupplierBalances: Set<string>; // compoundKey (supplierCode + ref)
}

export class ImportValidationService {
  public validateRow(importType: ImportType, data: Record<string, any>, context: ValidationContext, rowIndex: number): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (importType) {
      case 'UNIT':
        this.validateUnit(data, context, errors);
        break;
      case 'TAX_RATE':
        this.validateTaxRate(data, context, errors);
        break;
      case 'PRICE_BOOK':
        this.validatePriceBook(data, context, errors);
        break;
      case 'PRODUCT':
        this.validateProduct(data, context, errors);
        break;
      case 'PRODUCT_BARCODE':
        this.validateProductBarcode(data, context, errors);
        break;
      case 'PRODUCT_PRICE':
        this.validateProductPrice(data, context, errors, rowIndex);
        break;
      case 'OPENING_STOCK':
        this.validateOpeningStock(data, context, errors);
        break;
      case 'SUPPLIER':
        this.validateSupplier(data, context, errors, warnings);
        break;
      case 'SUPPLIER_OPENING_BALANCE':
        this.validateSupplierOpeningBalance(data, context, errors);
        break;
    }

    return { errors, warnings };
  }

  private validateUnit(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.unitCode || !data.unitCode.trim()) {
      errors.push('Unit Code is required.');
    } else if (data.unitCode.trim().length > 10) {
      errors.push('Unit Code cannot exceed 10 characters.');
    }

    if (!data.name || !data.name.trim()) {
      errors.push('Unit Name is required.');
    } else if (data.name.trim().length > 50) {
      errors.push('Unit Name cannot exceed 50 characters.');
    }

    if (data.decimalAllowed !== null && data.decimalAllowed !== undefined) {
      const precision = Number(data.decimalPlaces || 0);
      if (data.decimalAllowed === true) {
        if (Number.isNaN(precision) || precision < 0 || precision > 6) {
          errors.push('Decimal Precision must be between 0 and 6 when decimals are allowed.');
        }
      } else {
        if (precision !== 0) {
          errors.push('Decimal Precision must be 0 when decimals are not allowed.');
        }
      }
    }
  }

  private validateTaxRate(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.taxCode || !data.taxCode.trim()) {
      errors.push('Tax Code is required.');
    } else if (data.taxCode.trim().length > 30) {
      errors.push('Tax Code cannot exceed 30 characters.');
    }

    if (!data.name || !data.name.trim()) {
      errors.push('Tax Name is required.');
    } else if (data.name.trim().length > 100) {
      errors.push('Tax Name cannot exceed 100 characters.');
    }

    const categories = ['TAXABLE', 'EXEMPT', 'ZERO_RATED', 'NON_GST'];
    if (!data.taxCategory || !categories.includes(String(data.taxCategory).toUpperCase())) {
      errors.push('Tax Category is required and must be one of: TAXABLE, EXEMPT, ZERO_RATED, NON_GST.');
    }

    const rate = Number(data.rate || 0);
    const cgst = Number(data.cgstRate || 0);
    const sgst = Number(data.sgstRate || 0);
    const igst = Number(data.igstRate || 0);
    const cess = Number(data.cessRate || 0);

    if (rate < 0 || cgst < 0 || sgst < 0 || igst < 0 || cess < 0) {
      errors.push('Tax rate percentages cannot be negative.');
    }

    const categoryUpper = String(data.taxCategory).toUpperCase();
    if (categoryUpper === 'TAXABLE') {
      if (cgst + sgst !== rate) {
        errors.push('CGST + SGST rates must equal the GST rate.');
      }
      if (igst !== rate) {
        errors.push('IGST rate must equal the GST rate.');
      }
    } else {
      // EXEMPT, ZERO_RATED, and NON_GST should have 0 rates
      if (rate !== 0 || cgst !== 0 || sgst !== 0 || igst !== 0 || cess !== 0) {
        errors.push('Tax rates must be 0 for EXEMPT, ZERO_RATED, and NON_GST categories.');
      }
    }
  }

  private validatePriceBook(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.code || !data.code.trim()) {
      errors.push('Price Book Code is required.');
    } else if (data.code.trim().length > 30) {
      errors.push('Price Book Code cannot exceed 30 characters.');
    }

    if (!data.name || !data.name.trim()) {
      errors.push('Price Book Name is required.');
    } else if (data.name.trim().length > 100) {
      errors.push('Price Book Name cannot exceed 100 characters.');
    }
  }

  private validateProduct(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.productCode || !data.productCode.trim()) {
      errors.push('Product Code is required.');
    } else if (data.productCode.trim().length > 50) {
      errors.push('Product Code cannot exceed 50 characters.');
    }

    if (!data.name || !data.name.trim()) {
      errors.push('Product Name is required.');
    } else if (data.name.trim().length > 150) {
      errors.push('Product Name cannot exceed 150 characters.');
    }

    if (!data.productType || !['GOODS', 'SERVICE'].includes(String(data.productType).toUpperCase())) {
      errors.push('Product Type must be either GOODS or SERVICE.');
    }

    // Dependency checks: Unit Code
    if (!data.unitCode || !data.unitCode.trim()) {
      errors.push('Unit Code is required.');
    } else {
      const normUnit = data.unitCode.trim().toLowerCase();
      if (!context.existingUnits.has(normUnit)) {
        errors.push(`Referenced Unit "${data.unitCode}" does not exist. Please import Units first.`);
      }
    }

    // Dependency checks: Tax Code
    if (data.taxCode && data.taxCode.trim()) {
      const normTax = data.taxCode.trim().toLowerCase();
      if (!context.existingTaxRates.has(normTax)) {
        errors.push(`Referenced Tax Rate "${data.taxCode}" does not exist. Please import Tax Rates first.`);
      }
    }

    // SERVICE validation
    const productType = String(data.productType || '').toUpperCase();
    if (productType === 'SERVICE') {
      if (data.trackInventory === true) {
        errors.push('SERVICE products cannot track inventory.');
      }
      if (data.allowNegativeStock === true) {
        errors.push('SERVICE products cannot allow negative stock.');
      }
      const purchasePrice = Number(data.purchasePrice || 0);
      if (purchasePrice < 0) {
        errors.push('Purchase Price cannot be negative.');
      }
    }

    const mrp = Number(data.mrp || 0);
    const sellingPrice = Number(data.sellingPrice || 0);
    const minStock = Number(data.minimumStock || 0);
    const maxStock = Number(data.maximumStock || 0);

    if (sellingPrice < 0) errors.push('Selling Price cannot be negative.');
    if (mrp < 0) errors.push('MRP cannot be negative.');
    if (mrp > 0 && sellingPrice > mrp) {
      errors.push('Selling Price cannot exceed MRP.');
    }

    if (minStock < 0 || maxStock < 0) {
      errors.push('Stock limits cannot be negative.');
    }
    if (minStock > 0 && maxStock > 0 && minStock > maxStock) {
      errors.push('Minimum stock level cannot exceed maximum stock level.');
    }
  }

  private validateProductBarcode(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.productCode || !data.productCode.trim()) {
      errors.push('Product Code is required.');
    } else {
      const normCode = data.productCode.trim().toLowerCase();
      if (!context.existingProducts.has(normCode)) {
        errors.push(`Referenced Product Code "${data.productCode}" does not exist. Please import Products first.`);
      }
    }

    if (!data.barcode || !data.barcode.trim()) {
      errors.push('Barcode is required.');
    }
  }

  private validateProductPrice(data: Record<string, any>, context: ValidationContext, errors: string[], rowIndex: number): void {
    let pId = '';
    let pbId = '';

    if (!data.productCode || !data.productCode.trim()) {
      errors.push('Product Code is required.');
    } else {
      const normCode = data.productCode.trim().toLowerCase();
      const p = context.existingProducts.get(normCode);
      if (!p) {
        errors.push(`Referenced Product Code "${data.productCode}" does not exist. Please import Products first.`);
      } else {
        pId = p.id;
      }
    }

    if (!data.priceBookCode || !data.priceBookCode.trim()) {
      errors.push('Price Book Code is required.');
    } else {
      const normPB = data.priceBookCode.trim().toLowerCase();
      const id = context.existingPriceBooks.get(normPB);
      if (!id) {
        errors.push(`Referenced Price Book "${data.priceBookCode}" does not exist. Please import Price Books first.`);
      } else {
        pbId = id;
      }
    }

    const sellingPrice = Number(data.sellingPrice || 0);
    const purchasePrice = Number(data.purchasePrice || 0);
    const mrp = Number(data.mrp || 0);
    const minSellingPrice = Number(data.minimumSellingPrice || 0);

    if (sellingPrice < 0 || purchasePrice < 0 || mrp < 0 || minSellingPrice < 0) {
      errors.push('Price values cannot be negative.');
    }
    if (minSellingPrice > sellingPrice) {
      errors.push('Minimum selling price cannot exceed the selling price.');
    }
    if (mrp > 0 && sellingPrice > mrp) {
      errors.push('Selling price cannot exceed the MRP.');
    }

    // Effective Date Ranges Validation
    const fromStr = data.effectiveFrom ? String(data.effectiveFrom).trim() : '';
    const toStr = data.effectiveTo ? String(data.effectiveTo).trim() : '';

    if (fromStr && !/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
      errors.push('Effective From must be in YYYY-MM-DD format.');
    }
    if (toStr && !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      errors.push('Effective To must be in YYYY-MM-DD format.');
    }

    if (fromStr && toStr && fromStr > toStr) {
      errors.push('Effective To date cannot precede the Effective From date.');
    }

    // Overlapping Check
    if (pId && pbId) {
      const fromTime = fromStr || '1970-01-01';
      const toTime = toStr || '9999-12-31';

      // Undated price check
      const isUndated = !fromStr && !toStr;

      for (const ep of context.existingProductPrices) {
        if (ep.productId === pId && ep.priceBookId === pbId) {
          const epFrom = ep.effectiveFrom || '1970-01-01';
          const epTo = ep.effectiveTo || '9999-12-31';

          // Overlap condition: Max(Start1, Start2) <= Min(End1, End2)
          const startMax = fromTime > epFrom ? fromTime : epFrom;
          const endMin = toTime < epTo ? toTime : epTo;

          if (startMax <= endMin) {
            if (isUndated && !ep.effectiveFrom && !ep.effectiveTo) {
              errors.push('Multiple undated prices for the same Product and Price Book are not allowed.');
              break;
            } else {
              errors.push(`Effective dates [${fromStr || 'undated'} to ${toStr || 'undated'}] overlap with an existing active price [${ep.effectiveFrom || 'undated'} to ${ep.effectiveTo || 'undated'}].`);
              break;
            }
          }
        }
      }
    }
  }

  private validateOpeningStock(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.referenceNumber || !data.referenceNumber.trim()) {
      errors.push('Reference Number is required.');
    }

    if (!data.openingDate || !data.openingDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.openingDate).trim())) {
      errors.push('Opening Date is required in YYYY-MM-DD format.');
    }

    if (!data.productCode || !data.productCode.trim()) {
      errors.push('Product Code is required.');
    } else {
      const normCode = data.productCode.trim().toLowerCase();
      const p = context.existingProducts.get(normCode);
      if (!p) {
        errors.push(`Referenced Product Code "${data.productCode}" does not exist. Please import Products first.`);
      } else {
        if (p.productType !== 'GOODS') {
          errors.push('Opening stock is only allowed for GOODS products.');
        }
        if (!p.trackInventory) {
          errors.push('Opening stock is only allowed when inventory tracking is enabled.');
        }
      }
    }

    const qty = Number(data.quantity || 0);
    const cost = Number(data.unitCost || 0);

    if (Number.isNaN(qty) || qty <= 0) {
      errors.push('Quantity must be greater than zero.');
    }
    if (cost < 0) {
      errors.push('Unit Cost cannot be negative.');
    }

    const mfg = data.manufacturingDate ? String(data.manufacturingDate).trim() : '';
    const exp = data.expiryDate ? String(data.expiryDate).trim() : '';

    if (mfg && !/^\d{4}-\d{2}-\d{2}$/.test(mfg)) {
      errors.push('Manufacturing Date must be in YYYY-MM-DD format.');
    }
    if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      errors.push('Expiry Date must be in YYYY-MM-DD format.');
    }
    if (mfg && exp && mfg > exp) {
      errors.push('Expiry Date cannot precede Manufacturing Date.');
    }
  }

  private validateSupplier(data: Record<string, any>, context: ValidationContext, errors: string[], warnings: string[]): void {
    if (!data.supplierCode || !data.supplierCode.trim()) {
      errors.push('Supplier Code is required.');
    } else if (data.supplierCode.trim().length > 50) {
      errors.push('Supplier Code cannot exceed 50 characters.');
    }

    if (!data.supplierName || !data.supplierName.trim()) {
      errors.push('Supplier Name is required.');
    } else if (data.supplierName.trim().length > 150) {
      errors.push('Supplier Name cannot exceed 150 characters.');
    }

    if (data.email && data.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
        errors.push('Invalid supplier email format.');
      }
    }

    if (data.phone && data.phone.trim()) {
      if (!/^[0-9+\-\s()]{6,20}$/.test(data.phone.trim())) {
        errors.push('Invalid phone number format.');
      }
    }

    if (data.gstNumber && data.gstNumber.trim()) {
      if (!/^[0-9A-Z]{15}$/.test(data.gstNumber.trim().toUpperCase())) {
        errors.push('GST Number must be 15 alphanumeric characters.');
      }
    }

    if (data.panNumber && data.panNumber.trim()) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.panNumber.trim().toUpperCase())) {
        errors.push('Invalid PAN number format.');
      }
    }

    const days = Number(data.paymentTermsDays || 0);
    const limit = Number(data.creditLimit || 0);

    if (days < 0) errors.push('Payment Terms Days cannot be negative.');
    if (limit < 0) errors.push('Credit Limit cannot be negative.');

    // Opening balances check inside Supplier Template directly:
    const opBal = Number(data.openingBalance || 0);
    const opType = data.openingBalanceType ? String(data.openingBalanceType).trim().toUpperCase() : 'NONE';
    if (opBal < 0) {
      errors.push('Opening Balance cannot be negative.');
    }
    if (opBal > 0 && !['PAYABLE', 'RECEIVABLE'].includes(opType)) {
      errors.push('Opening Balance Type must be PAYABLE or RECEIVABLE when balance amount is greater than 0.');
    }
  }

  private validateSupplierOpeningBalance(data: Record<string, any>, context: ValidationContext, errors: string[]): void {
    if (!data.referenceNumber || !data.referenceNumber.trim()) {
      errors.push('Reference Number is required.');
    }

    if (!data.balanceDate || !data.balanceDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.balanceDate).trim())) {
      errors.push('Balance Date is required in YYYY-MM-DD format.');
    }

    if (!data.supplierCode || !data.supplierCode.trim()) {
      errors.push('Supplier Code is required.');
    } else {
      const normCode = data.supplierCode.trim().toLowerCase();
      if (!context.existingSuppliers.has(normCode)) {
        errors.push(`Referenced Supplier Code "${data.supplierCode}" does not exist. Please import Suppliers first.`);
      }
    }

    const bal = Number(data.openingBalance || 0);
    const type = data.openingBalanceType ? String(data.openingBalanceType).trim().toUpperCase() : '';

    if (Number.isNaN(bal) || bal <= 0) {
      errors.push('Opening Balance must be greater than zero.');
    }
    if (!['PAYABLE', 'RECEIVABLE', 'NONE'].includes(type)) {
      errors.push('Opening Balance Type is required and must be one of: PAYABLE, RECEIVABLE, NONE.');
    }
  }
}
