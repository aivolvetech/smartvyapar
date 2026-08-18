# BRD v2.0 Gap Analysis

This document provides a comparative gap analysis between the existing **Smart Vyapar** project foundation and the authoritative requirements detailed in **Smart Vyapar BRD Version 2.0**.

---

## 1. Comparative Status Matrix

| BRD Requirement Area | Existing Codebase State | BRD v2 Requirement | Gap Status & Required Action |
| :--- | :--- | :--- | :--- |
| **Database Encryption** | Plain SQLite database (`dev.db`). | SQLite encrypted at rest via SQLCipher. | **RESOLVED IN PoC:** SQLCipher driver `better-sqlite3-multiple-ciphers` (v11.10.0) is verified. Prisma Client adapter is rejected due to peer dependency conflicts and Rust CLI engine limits. Transitioning database client to direct repository queries. |
| **Database Migrations** | Custom migration runner using standard `better-sqlite3`. | Schema migrations run securely inside encrypted SQLCipher. | **RESOLVED IN PoC:** Custom transaction-safe programmatic migration runner is fully verified. Standardizes checksum validation and successfully rolls back failures. |
| **System Logging** | Custom script [logger.ts](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/electron/utils/logger.ts). | Standard `electron-log` with rotation and crash queue. | **MODIFICATION REQ:** Replace custom logger with `electron-log` library without breaking existing import interfaces. |
| **Licensing & Activation** | None (Static React UI placeholders). | Time-bound trial, offline hardware fingerprint binding, read-only degradation. | **MISSING FOUNDATION:** Needs an offline license validator and machine fingerprint generator in the main process. |
| **Auto-Updates** | None. | `electron-updater` (online delta/full updates) + manual USB updates. | **MISSING FOUNDATION:** Configure `electron-updater` and design a manual USB file upload handler. Database and application rollback paths must be separated. |
| **Backups & Restore** | `VACUUM INTO` database snapshot copy with SHA-256 checks. | Checksum-verified backups with optional password encryption. | **MODIFICATION REQ:** Add backup password hashing and encryption wrapper (e.g. AES-256 or encrypted SQLCipher dump). |
| **Code Signing** | Unsigned NSIS target. | Windows Authenticode signed installer/updates. | **MISSING FOUNDATION:** Configure code-signing variables in `electron-builder` configuration in [package.json](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/package.json). |
| **Crash Recovery** | None. | Auto-save active bills to a draft table every few seconds. | **FUTURE BUSINESS-MODULE:** Add `DraftBill` model to schema and implement auto-save IPC channels. |
| **GST / HSN/SAC** | Bare `Shop` table. | GST rates and HSN/SAC code tracking in Product Master, invoice calculations. | **FUTURE BUSINESS-MODULE:** Add HSN/SAC and GST rates to the SQLite schema and implement GST tax-slab breakdown invoice logic. |
| **Hardware Integration** | None. | Barcode scanner Wedge mode timing, ESC/POS thermal prints, A4 OS spooler. | **FUTURE BUSINESS-MODULE:** Create hardware printer/scanner service boundaries in the Electron main process. |

---

## 2. Core Architectural Conflicts

### A. Prisma ORM vs. SQLCipher Encryption
*   **Conflict:** Prisma Client is compiled against standard SQLite. It does not understand encrypted database file handles and cannot execute database operations directly on a SQLCipher-encrypted file.
*   **Resolution:** Reject Prisma runtime adapter due to peer dependency mismatches and Prisma CLI Rust engine constraints. Select Option B (Raw SQLCipher Connection Driver) for database data-access layer operations. Generate type-safe model interfaces to keep type safety.

### B. Prisma Migrations CLI vs. Encrypted SQLite
*   **Conflict:** The development-time `prisma migrate dev` command fails on a SQLCipher-encrypted SQLite file.
*   **Proposed Resolution:** Keep the development database unencrypted or use an environment variable toggle (`DB_ENCRYPTION=false`) during development. In production, database schema migrations must be executed programmatically on app startup via the custom database connection runner using the SQLCipher driver, keeping the production database fully encrypted.

### C. Application vs. Database Rollback
*   **Conflict:** If an update fails, `electron-updater` only manages application binary state rollbacks. It does not automatically guarantee or manage database state or schema rollbacks.
*   **Resolution:** Application rollbacks and database rollbacks must be handled as separate pipelines. Before applying any updates, the main process must execute an isolated database snapshot. If the application version fails to load or the database migration fails on startup, the application must execute an independent database rollback using the pre-migration snapshot.

---

## 3. Tolerant Offline Hardware Fingerprinting
To satisfy the offline licensing requirement, the system must collect motherboard UUID, BIOS serial numbers, and CPU details to construct a unique machine signature.
*   **Multi-Factor Matching:** Rather than relying exclusively on a single hardware identifier or a legacy command utility (such as `wmic`), the signature collector must query multiple stable Windows CIM/System identifiers (using PowerShell CIM cmdlets or Node system APIs).
*   **Graceful Tolerance:** The validation logic must support tolerant matching (e.g. matching 2 out of 3 hardware criteria) to prevent locking out users who perform minor upgrades, such as replacing a network interface card or installing minor BIOS updates.
