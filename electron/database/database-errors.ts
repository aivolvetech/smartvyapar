export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string) {
    super(`Database connection error: ${message}`);
    this.name = 'DatabaseConnectionError';
  }
}

export class WrongKeyError extends DatabaseError {
  constructor() {
    super('Incorrect database encryption key.');
    this.name = 'WrongKeyError';
  }
}

export class DatabaseCorruptedException extends DatabaseError {
  constructor() {
    super('Database file is corrupted or not a valid database.');
    this.name = 'DatabaseCorruptedException';
  }
}

export class MigrationException extends DatabaseError {
  constructor(message: string) {
    super(`Database migration failed: ${message}`);
    this.name = 'MigrationException';
  }
}
