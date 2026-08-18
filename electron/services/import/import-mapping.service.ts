import { ImportType, ImportMapping, ImportColumnDefinition } from '../../../shared/types/import';
import { ImportTemplateService } from './import-template.service';

export class ImportMappingService {
  /**
   * Automatically attempts to match parsed file headers to template field names.
   * Matches case-insensitively, space-insensitively, and underscore-insensitively.
   */
  public autoMatchHeaders(importType: ImportType, headers: string[]): ImportMapping {
    const cols = ImportTemplateService.getColumnDefinitions(importType);
    const mapping: ImportMapping = {};

    for (const col of cols) {
      const targetNorm = this.normalizeName(col.field);
      const labelNorm = this.normalizeName(col.label.replace(/\*/g, '')); // remove required *

      // Look for a matching parsed header
      for (const h of headers) {
        const hNorm = this.normalizeName(h);
        if (hNorm === targetNorm || hNorm === labelNorm) {
          mapping[col.field] = h;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Validates a column mapping. Checks for duplicate mappings and missing required fields.
   */
  public validateMapping(importType: ImportType, mapping: ImportMapping, headers: string[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const cols = ImportTemplateService.getColumnDefinitions(importType);
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check duplicate header mappings (different fields mapped to the same file column)
    const mappedHeaders = Object.values(mapping);
    const uniqueMappedHeaders = new Set(mappedHeaders);
    if (mappedHeaders.length !== uniqueMappedHeaders.size) {
      errors.push('Multiple fields cannot be mapped to the same import file column.');
    }

    // 2. Check missing required fields
    for (const col of cols) {
      if (col.required && (!mapping[col.field] || !mapping[col.field].trim())) {
        errors.push(`Required field "${col.label}" is not mapped.`);
      }
    }

    // 3. Warning for unmapped columns in the file
    const mappedHeadersSet = new Set(mappedHeaders);
    const unmappedHeaders = headers.filter(h => !mappedHeadersSet.has(h));
    if (unmappedHeaders.length > 0) {
      warnings.push(`The following columns in your file will be ignored: ${unmappedHeaders.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Maps a raw row object to the target database field schema using the mapping profile.
   */
  public mapRow(row: any, mapping: ImportMapping, cols: ImportColumnDefinition[]): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const col of cols) {
      const headerName = mapping[col.field];
      if (headerName !== undefined) {
        const rawValue = row[headerName];
        mapped[col.field] = this.parseCell(rawValue, col.dataType);
      } else {
        mapped[col.field] = null;
      }
    }

    return mapped;
  }

  /**
   * Merges imported row data into an existing database record under UPDATE_EXISTING.
   * Business keys (codes/IDs) remain immutable, and blank fields are skipped (preserving DB values).
   */
  public mergeRowForUpdate(existing: Record<string, any>, imported: Record<string, any>, immutableFields: string[]): Record<string, any> {
    const merged = { ...existing };

    for (const [key, val] of Object.entries(imported)) {
      // 1. Immutable fields cannot be modified
      if (immutableFields.includes(key)) {
        continue;
      }

      // 2. Under UPDATE_EXISTING, a blank or null cell in the import file does NOT overwrite
      // the existing database value. It skips it, preserving the db value.
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        continue;
      }

      merged[key] = val;
    }

    return merged;
  }

  private normalizeName(name: string): string {
    return name.replace(/\*/g, '').trim().toLowerCase().replace(/[\s\-_]/g, '');
  }

  private parseCell(value: any, dataType: string): any {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;

      if (dataType === 'boolean') {
        return trimmed.toLowerCase() === 'true' || trimmed === '1' || trimmed.toLowerCase() === 'yes';
      }
      if (dataType === 'number') {
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : null;
      }
      if (dataType === 'date') {
        // Simple YYYY-MM-DD validation
        return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : trimmed;
      }
      return trimmed;
    }

    if (typeof value === 'number') {
      if (dataType === 'boolean') return value !== 0;
      if (dataType === 'number') return value;
      if (dataType === 'date') {
        // SheetJS sometimes parses Excel dates as numbers (days since 1900)
        return this.excelDateToISO(value);
      }
      return String(value);
    }

    if (typeof value === 'boolean') {
      if (dataType === 'boolean') return value;
      if (dataType === 'number') return value ? 1 : 0;
      return String(value);
    }

    return String(value);
  }

  private excelDateToISO(serial: number): string {
    try {
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const fractional_day = serial - Math.floor(serial) + 0.0000001;
      let total_seconds = Math.floor(86400 * fractional_day);
      const seconds = total_seconds % 60;
      total_seconds -= seconds;
      const minutes = Math.floor(total_seconds / 60) % 60;
      const hours = Math.floor(total_seconds / 3600);
      
      const d = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }
}
