// ============================================================================
// Smart Vyapar — Shared Bulk Import Types
// ============================================================================

export type ImportType =
  | 'UNIT'
  | 'TAX_RATE'
  | 'PRICE_BOOK'
  | 'PRODUCT'
  | 'PRODUCT_BARCODE'
  | 'PRODUCT_PRICE'
  | 'OPENING_STOCK'
  | 'SUPPLIER'
  | 'SUPPLIER_OPENING_BALANCE';

export type ImportJobStatus =
  | 'CREATED'
  | 'FILE_PARSED'
  | 'VALIDATED'
  | 'READY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export type ImportRowStatus =
  | 'PENDING'
  | 'VALID'
  | 'INVALID'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_IN_DATABASE'
  | 'INSERTED'
  | 'UPDATED'
  | 'SKIPPED'
  | 'FAILED';

export type ImportRowAction = 'INSERT' | 'UPDATE' | 'SKIP' | 'REJECT';

export type ImportDuplicatePolicy = 'SKIP_DUPLICATES' | 'UPDATE_EXISTING' | 'FAIL_ON_DUPLICATE';

export type ImportTransactionMode = 'ATOMIC_ALL_OR_NOTHING' | 'VALID_ROWS_ONLY';

export type ImportDuplicateType =
  | 'VALID'
  | 'FILE_DUPLICATE'
  | 'DATABASE_DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'HARD_DUPLICATE'
  | 'CONFLICT';

export interface ImportColumnDefinition {
  field: string;
  label: string;
  required: boolean;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  allowedValues?: string[];
  maxLength?: number;
  description: string;
}

export interface ImportTemplateDefinition {
  importType: ImportType;
  templateVersion: string;
  columns: ImportColumnDefinition[];
}

export interface ImportMapping {
  // Key represents domain model field, value represents index of CSV/Excel header
  [field: string]: string;
}

export interface ImportJob {
  id: string;
  importType: ImportType;
  fileName: string;
  fileHash: string;
  fileSize: number;
  worksheetName: string | null;
  status: ImportJobStatus;
  duplicatePolicy: ImportDuplicatePolicy;
  transactionMode: ImportTransactionMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  errorSummary: string | null;
  appVersion: string;
}

export interface ImportJobRow {
  id: string;
  importJobId: string;
  rowNumber: number;
  sourceKey: string | null;
  normalizedSourceKey: string | null;
  rowHash: string;
  status: ImportRowStatus;
  action: ImportRowAction;
  errorCode: string | null;
  errorMessage: string | null;
  sourceDataJson: string; // raw parsed row object
  normalizedDataJson: string | null; // normalized properties mapped to database schema
  resultRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportValidationError {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportValidationWarning {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportPreviewPage {
  items: ImportJobRow[];
  totalItems: number;
  pageIndex: number;
  pageSize: number;
}

export interface ImportHistoryFilter {
  importType?: ImportType;
  status?: ImportJobStatus;
  limit?: number;
  offset?: number;
}

export interface ImportErrorReportRow {
  rowNumber: number;
  importType: string;
  businessKey: string;
  status: string;
  errorCode: string;
  errorMessage: string;
  duplicateType: string;
  duplicateKey: string;
  proposedAction: string;
  originalRowData: string;
}
