export class DatabaseKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseKeyError';
  }
}

export class MissingKeyError extends DatabaseKeyError {
  constructor() {
    super('Database encryption key file does not exist.');
    this.name = 'MissingKeyError';
  }
}

export class CorruptedKeyError extends DatabaseKeyError {
  constructor(details?: string) {
    super(`Database encryption key is corrupted: ${details || 'invalid format'}`);
    this.name = 'CorruptedKeyError';
  }
}

export class KeyRotationError extends DatabaseKeyError {
  constructor(message: string) {
    super(`Key rotation failed: ${message}`);
    this.name = 'KeyRotationError';
  }
}

export class DpapiUnprotectError extends DatabaseKeyError {
  constructor(err: any) {
    super(`DPAPI unprotection failed: ${String(err)}`);
    this.name = 'DpapiUnprotectError';
  }
}
