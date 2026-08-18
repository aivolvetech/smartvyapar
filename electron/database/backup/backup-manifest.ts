export interface BackupManifest {
  version: string;
  appVersion: string;
  timestamp: string;
  fileSize: number;
  checksum: string;
  cipher: {
    algorithm: string;
    pageSize: number;
  };
}
