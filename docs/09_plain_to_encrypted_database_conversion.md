# Plain to Encrypted Database Conversion

This document details the step-by-step conversion process used to upgrade standard unencrypted SQLite databases to SQLCipher encryption during application startup.

---

## 1. Conversion Flow Sequence

```text
Detect plain database (without key)
        ↓
Close any active connections
        ↓
Create timestamped safety backup (dev.db.safety-backup-YYYYMMDD-HHmmss)
        ↓
Create temporary encrypted database (.convert.tmp)
        ↓
Initialize SQLCipher connection & run PRAGMA key
        ↓
Apply DDL schema by executing chronological migrations
        ↓
Read rows from unencrypted database tables
        ↓
Write rows to temporary encrypted database transactionally
        ↓
Validate row counts and field-level values
        ↓
Run PRAGMA integrity_check on encrypted database
        ↓
Close both database connection handles
        ↓
Atomically replace active database file with temporary file
        ↓
Record conversion-manifest.json log
```

---

## 2. Safety & Rollback Controls

*   **No Direct Overwriting:** The unencrypted database file is never directly modified. It is read as-is and renamed only after validation succeeds.
*   **Atomic Swap:** The final database swap is performed using atomic filesystem renames (`fs.renameSync`).
*   **Safety Copy Preservation:** The original unencrypted database safety copy is preserved indefinitely for diagnostic verification.
*   **Failed Conversion Recovery:** If any error occurs during copy, validation, or integrity checks, the temporary files are deleted, active handles closed, and the plain database remains unmodified.
