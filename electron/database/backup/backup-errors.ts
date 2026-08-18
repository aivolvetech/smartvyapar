export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export class RestoreValidationError extends BackupError {
  constructor(message: string) {
    super(`Restore validation failed: ${message}`);
    this.name = 'RestoreValidationError';
  }
}
