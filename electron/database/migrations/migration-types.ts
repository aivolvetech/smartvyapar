export interface AppMigration {
  id: string;
  migrationName: string;
  checksum: string;
  appliedAt: string;
  applicationVersion: string;
}
