# Encrypted Backup & Restore Design

This document details the database backup and restoration safety specifications for SQLCipher encryption.

---

## 1. WAL-Safe Encrypted Backups

To prevent incomplete copy operations when SQLite operates in WAL (Write-Ahead Logging) mode, backups are performed using the `VACUUM INTO` command.

1.  A temporary connection is opened on the active encrypted database.
2.  `VACUUM INTO 'backupPath'` is executed. This copies the database pages directly while retaining SQLCipher encryption.
3.  The SHA-256 checksum of the copy is calculated.
4.  A `backup-manifest.json` file is written containing the timestamp, size, and checksum.

---

## 2. Integrity-Checked Restoration Flow

Restoring a backup must never corrupt the active connection or overwrite files before validation passes.

### Verification Steps
1.  **Checksum Check:** Verify backup file hash matches the manifest checksum.
2.  **Sandbox Restore:** Copy the backup to a temporary file (`dbPath.restore.tmp`).
3.  **Correct Key check:** Open the temporary file using the active DPAPI database key.
4.  **Integrity check:** Execute `PRAGMA integrity_check` on the temp database.
5.  **Schema Check:** Verify that the `Shop` table structure exists in the temp database.
6.  **Data Check:** Query the `Shop` record to verify the data is readable and not corrupted.

### Atomic Swap
Only after all six checks pass:
1.  Close all database connections.
2.  Create a timestamped backup of the current database (`dev.db.pre-restore-YYYYMMDD-HHmmss`).
3.  Atomically replace the active database file with the validated temporary database file.
