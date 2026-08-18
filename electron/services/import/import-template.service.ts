import { ImportType, ImportColumnDefinition } from '../../../shared/types/import';

export class ImportTemplateService {
  private static COLUMN_DEFINITIONS: Record<ImportType, ImportColumnDefinition[]> = {
    UNIT: [
      { field: 'unitCode', label: 'Unit Code*', required: true, dataType: 'string', maxLength: 10, description: 'Unique abbreviation (e.g. PCS, KG)' },
      { field: 'name', label: 'Unit Name*', required: true, dataType: 'string', maxLength: 50, description: 'Full name (e.g. Piece, Kilogram)' },
      { field: 'decimalAllowed', label: 'Decimal Allowed', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: FALSE)' },
      { field: 'decimalPlaces', label: 'Decimal Precision', required: false, dataType: 'number', description: 'Places 0 to 6 (Only if Decimal Allowed is TRUE)' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE)' }
    ],
    TAX_RATE: [
      { field: 'taxCode', label: 'Tax Code*', required: true, dataType: 'string', maxLength: 30, description: 'Unique code (e.g. GST-18, EXEMPT)' },
      { field: 'name', label: 'Tax Name*', required: true, dataType: 'string', maxLength: 100, description: 'Label (e.g. GST 18%, Zero Rated)' },
      { field: 'taxCategory', label: 'Tax Category*', required: true, dataType: 'string', allowedValues: ['TAXABLE', 'EXEMPT', 'ZERO_RATED', 'NON_GST'], description: 'Category (TAXABLE, EXEMPT, ZERO_RATED, NON_GST)' },
      { field: 'rate', label: 'GST Rate', required: false, dataType: 'number', description: 'Total tax percentage (e.g. 18)' },
      { field: 'cgstRate', label: 'CGST Rate', required: false, dataType: 'number', description: 'CGST split percentage (e.g. 9)' },
      { field: 'sgstRate', label: 'SGST Rate', required: false, dataType: 'number', description: 'SGST split percentage (e.g. 9)' },
      { field: 'igstRate', label: 'IGST Rate', required: false, dataType: 'number', description: 'IGST split percentage (e.g. 18)' },
      { field: 'cessRate', label: 'Cess Rate', required: false, dataType: 'number', description: 'Cess split percentage (e.g. 0)' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE)' }
    ],
    PRICE_BOOK: [
      { field: 'code', label: 'Price Book Code*', required: true, dataType: 'string', maxLength: 30, description: 'Unique code (e.g. WHOLESALE)' },
      { field: 'name', label: 'Price Book Name*', required: true, dataType: 'string', maxLength: 100, description: 'Display name' },
      { field: 'description', label: 'Description', required: false, dataType: 'string', maxLength: 250, description: 'Notes' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE)' }
    ],
    PRODUCT: [
      { field: 'productCode', label: 'Product Code*', required: true, dataType: 'string', maxLength: 50, description: 'Unique code (e.g. PROD-001)' },
      { field: 'name', label: 'Product Name*', required: true, dataType: 'string', maxLength: 150, description: 'Full description name' },
      { field: 'productType', label: 'Product Type*', required: true, dataType: 'string', allowedValues: ['GOODS', 'SERVICE'], description: 'Type (GOODS or SERVICE)' },
      { field: 'sku', label: 'SKU', required: false, dataType: 'string', maxLength: 50, description: 'Stock keeping unit' },
      { field: 'description', label: 'Description', required: false, dataType: 'string', maxLength: 500, description: 'Details' },
      { field: 'hsnSacCode', label: 'HSN/SAC Code', required: false, dataType: 'string', maxLength: 20, description: 'HSN code' },
      { field: 'unitCode', label: 'Unit Code*', required: true, dataType: 'string', maxLength: 10, description: 'UOM shortName (e.g. PCS, KG)' },
      { field: 'taxCode', label: 'Tax Code', required: false, dataType: 'string', maxLength: 30, description: 'Tax Rate code (e.g. GST-18)' },
      { field: 'brand', label: 'Brand', required: false, dataType: 'string', maxLength: 50, description: 'Brand name' },
      { field: 'category', label: 'Category', required: false, dataType: 'string', maxLength: 50, description: 'Category name' },
      { field: 'trackInventory', label: 'Track Inventory', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE for GOODS)' },
      { field: 'allowNegativeStock', label: 'Allow Negative Stock', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: FALSE)' },
      { field: 'minimumStock', label: 'Minimum Stock', required: false, dataType: 'number', description: 'Reorder alert limit' },
      { field: 'maximumStock', label: 'Maximum Stock', required: false, dataType: 'number', description: 'Max holding limit' },
      { field: 'reorderLevel', label: 'Reorder Level', required: false, dataType: 'number', description: 'Refill warning level' },
      { field: 'purchasePrice', label: 'Purchase Price', required: false, dataType: 'number', description: 'Standard cost' },
      { field: 'sellingPrice', label: 'Selling Price*', required: true, dataType: 'number', description: 'Standard sales price' },
      { field: 'mrp', label: 'MRP', required: false, dataType: 'number', description: 'Max retail price' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE)' }
    ],
    PRODUCT_BARCODE: [
      { field: 'productCode', label: 'Product Code*', required: true, dataType: 'string', maxLength: 50, description: 'Existing Product Code' },
      { field: 'barcode', label: 'Barcode*', required: true, dataType: 'string', maxLength: 100, description: 'Barcode text' },
      { field: 'barcodeType', label: 'Barcode Type', required: false, dataType: 'string', maxLength: 20, description: 'Default: EAN13' },
      { field: 'isPrimary', label: 'Is Primary', required: false, dataType: 'boolean', description: 'TRUE or FALSE (Default: FALSE)' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'TRUE or FALSE (Default: TRUE)' }
    ],
    PRODUCT_PRICE: [
      { field: 'productCode', label: 'Product Code*', required: true, dataType: 'string', maxLength: 50, description: 'Product Code' },
      { field: 'priceBookCode', label: 'Price Book Code*', required: true, dataType: 'string', maxLength: 30, description: 'Price Book Code (e.g. DEFAULT, WHOLESALE)' },
      { field: 'purchasePrice', label: 'Purchase Price', required: false, dataType: 'number', description: 'Cost price for book' },
      { field: 'sellingPrice', label: 'Selling Price*', required: true, dataType: 'number', description: 'Selling price for book' },
      { field: 'mrp', label: 'MRP', required: false, dataType: 'number', description: 'MRP for book' },
      { field: 'minimumSellingPrice', label: 'Minimum Selling Price', required: false, dataType: 'number', description: 'Minimum allowed rate' },
      { field: 'effectiveFrom', label: 'Effective From', required: false, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'effectiveTo', label: 'Effective To', required: false, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'TRUE or FALSE (Default: TRUE)' }
    ],
    OPENING_STOCK: [
      { field: 'referenceNumber', label: 'Reference Number*', required: true, dataType: 'string', maxLength: 50, description: 'Opening stock batch/import voucher identity' },
      { field: 'openingDate', label: 'Opening Date*', required: true, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'productCode', label: 'Product Code*', required: true, dataType: 'string', maxLength: 50, description: 'Tracked GOODS product code' },
      { field: 'quantity', label: 'Quantity*', required: true, dataType: 'number', description: 'Opening units' },
      { field: 'unitCost', label: 'Unit Cost', required: false, dataType: 'number', description: 'Rate per unit' },
      { field: 'batchNumber', label: 'Batch Number', required: false, dataType: 'string', maxLength: 50, description: 'Batch number' },
      { field: 'manufacturingDate', label: 'Manufacturing Date', required: false, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'expiryDate', label: 'Expiry Date', required: false, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'notes', label: 'Notes', required: false, dataType: 'string', maxLength: 250, description: 'Remarks' }
    ],
    SUPPLIER: [
      { field: 'supplierCode', label: 'Supplier Code*', required: true, dataType: 'string', maxLength: 50, description: 'Unique code (e.g. SUP-001)' },
      { field: 'supplierName', label: 'Supplier Name*', required: true, dataType: 'string', maxLength: 150, description: 'Business display name' },
      { field: 'contactPerson', label: 'Contact Person', required: false, dataType: 'string', maxLength: 100, description: 'Name of contact person' },
      { field: 'phone', label: 'Phone', required: false, dataType: 'string', maxLength: 20, description: 'Mobile/Landline' },
      { field: 'alternatePhone', label: 'Alternate Phone', required: false, dataType: 'string', maxLength: 20, description: 'Alternate number' },
      { field: 'email', label: 'Email', required: false, dataType: 'string', maxLength: 100, description: 'Email address' },
      { field: 'gstNumber', label: 'GST Number', required: false, dataType: 'string', maxLength: 15, description: '15 alphanumeric characters GSTIN' },
      { field: 'panNumber', label: 'PAN Number', required: false, dataType: 'string', maxLength: 10, description: '10 alphanumeric characters PAN' },
      { field: 'addressLine1', label: 'Address Line 1', required: false, dataType: 'string', maxLength: 150, description: 'Building, Shop No' },
      { field: 'addressLine2', label: 'Address Line 2', required: false, dataType: 'string', maxLength: 150, description: 'Street, Area' },
      { field: 'city', label: 'City', required: false, dataType: 'string', maxLength: 50, description: 'City name' },
      { field: 'state', label: 'State', required: false, dataType: 'string', maxLength: 50, description: 'State name (e.g. Maharashtra)' },
      { field: 'postalCode', label: 'Postal Code', required: false, dataType: 'string', maxLength: 10, description: 'PIN Code' },
      { field: 'country', label: 'Country', required: false, dataType: 'string', maxLength: 50, description: 'Default: India' },
      { field: 'paymentTermsDays', label: 'Payment Terms Days', required: false, dataType: 'number', description: 'Due days limit (e.g. 30)' },
      { field: 'creditLimit', label: 'Credit Limit', required: false, dataType: 'number', description: 'Max credit allowance' },
      { field: 'notes', label: 'Notes', required: false, dataType: 'string', maxLength: 250, description: 'Notes/Comments' },
      { field: 'isActive', label: 'Active', required: false, dataType: 'boolean', description: 'Enter TRUE or FALSE (Default: TRUE)' }
    ],
    SUPPLIER_OPENING_BALANCE: [
      { field: 'referenceNumber', label: 'Reference Number*', required: true, dataType: 'string', maxLength: 50, description: 'Opening balance voucher reference' },
      { field: 'balanceDate', label: 'Balance Date*', required: true, dataType: 'date', description: 'Date (YYYY-MM-DD)' },
      { field: 'supplierCode', label: 'Supplier Code*', required: true, dataType: 'string', maxLength: 50, description: 'Supplier code' },
      { field: 'openingBalance', label: 'Opening Balance*', required: true, dataType: 'number', description: 'Amount (e.g. 5000)' },
      { field: 'openingBalanceType', label: 'Opening Balance Type*', required: true, dataType: 'string', allowedValues: ['PAYABLE', 'RECEIVABLE', 'NONE'], description: 'Type (PAYABLE, RECEIVABLE, NONE)' },
      { field: 'notes', label: 'Notes', required: false, dataType: 'string', maxLength: 250, description: 'Remarks' }
    ]
  };

  public static getColumnDefinitions(importType: ImportType): ImportColumnDefinition[] {
    return this.COLUMN_DEFINITIONS[importType] || [];
  }

  public getCSVTemplateString(importType: ImportType): string {
    const cols = ImportTemplateService.getColumnDefinitions(importType);
    const headers = cols.map(c => this.safeCsvCell(c.label)).join(',');
    const exampleNotes = cols.map(c => this.safeCsvCell(c.description)).join(',');

    // Output structure: First row headers, second row description/instructions
    return `${headers}\n${exampleNotes}\n`;
  }

  // Escape formula injection characters by prefixing with a single quote if needed
  public safeCsvCell(value: any): string {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // Escape CSV cell formatting characters (commas, quotes, newlines)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    // Spreadsheet formula injection mitigation: check if string starts with sensitive characters
    const firstChar = str.startsWith('"') ? str.charAt(1) : str.charAt(0);
    if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
      // Prefix with a single quote inside the string to render as raw text in spreadsheet software
      if (str.startsWith('"')) {
        str = `"'${str.slice(1)}`;
      } else {
        str = `'${str}`;
      }
    }

    return str;
  }
}
