export class ChecksumMismatchException extends Error {
  constructor(migrationName: string, expected: string, got: string) {
    super(`Checksum verification failed for migration "${migrationName}". Expected "${expected}", got "${got}". The migration file has been modified!`);
    this.name = 'ChecksumMismatchException';
  }
}

export class MigrationExecutionException extends Error {
  constructor(migrationName: string, originalError: any) {
    super(`Failed to execute migration "${migrationName}": ${originalError.message || String(originalError)}`);
    this.name = 'MigrationExecutionException';
  }
}
