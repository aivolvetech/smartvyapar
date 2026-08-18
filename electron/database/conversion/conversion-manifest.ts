export interface ConversionManifest {
  timestamp: string;
  originalSize: number;
  migratedRows: number;
  success: boolean;
}
