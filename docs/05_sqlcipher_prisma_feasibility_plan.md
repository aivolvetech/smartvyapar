# SQLCipher Prisma Feasibility Plan

This document details the evaluation options, package requirements, and isolated Proof of Concept (PoC) plan to assess the feasibility of integrating SQLite database encryption (SQLCipher) with Prisma ORM in **Smart Vyapar**.

---

## 1. Evaluation Options Matrix

Before changing any production code, the following options must be evaluated in an isolated development environment:

#### Option A: Prisma Upgrade + Driver Adapter (REJECTED)
*   **Description:** Upgrade Prisma to a version that officially supports the better-sqlite3 driver adapter (`@prisma/adapter-better-sqlite3`), then determine whether the adapter can work with a SQLCipher-capable JS driver (e.g. `better-sqlite3-multiple-ciphers`).
*   **Feasibility Status:** **REJECTED** based on PoC phase. Has peer dependency name conflicts and Prisma CLI engine compatibility limitations (Rust CLI fails to read encrypted SQLite). Bypassing requires high-maintenance package aliases.
*   **Exact Package Names & Versions:**
    *   `prisma` & `@prisma/client`: `6.7.0`
    *   `@prisma/adapter-better-sqlite3`: `6.7.0`
    *   `better-sqlite3-multiple-ciphers`: `11.10.0`
*   **Type-Safety Impact:** High. Preserves type safety but breaks development workflows.
*   **Maintenance Risk:** High. Relies on package-manager aliasing.

---

### Option B: Hybrid Model (Raw SQLCipher Driver Connection) (Approved & Verified)
*   **Description:** Use the SQLCipher driver package `better-sqlite3-multiple-ciphers` directly for runtime database access. Type safety can be maintained by generating TypeScript models from the database schema definitions.
*   **Feasibility Status:** **Approved & Verified**. Integrated and verified in Phase 1; installer builds successfully.
*   **Exact Package Names & Versions:**
    *   `better-sqlite3-multiple-ciphers`: `11.10.0` (pinned)
*   **Electron Compatibility:** Fully compatible once native binaries are compiled.
*   **Type-Safety Impact:** Medium. Standard TypeScript model definitions map data structures.
*   **Maintenance Risk:** Low. Independent stack elements are extremely stable.
*   **Existing-Code Migration Effort:** Moderate. Refactor database calls to direct query commands.

---

### Option C: Complete Prisma Replacement
*   **Description:** Remove Prisma ORM entirely from the stack and replace it with a SQLCipher-compatible database layer (e.g. TypeORM or direct SQLCipher SQLite wrappers).
*   **Official Support Status:** Fully supported by respective library maintainers.
*   **Exact Package Names & Versions:**
    *   `typeorm`: `^0.3.20`
    *   `better-sqlite3-multiple-ciphers`: `^11.2.0`
*   **Electron Compatibility:** Fully compatible once native binaries are compiled.
*   **Native Rebuild Requirements:** Yes.
*   **Migration Compatibility:** Standard TypeORM migrations run against the encrypted database.
*   **Type-Safety Impact:** Moderate to High (using TypeORM decorator-based repositories).
*   **Packaging Impact:** Standard native unpacking.
*   **Performance Impact:** Minimal. Standard ORM execution speeds.
*   **Maintenance Risk:** Low.
*   **Existing-Code Migration Effort:** Critical. Requires deleting and rewriting the entire database client layer, schemas, database services, and IPC resolver wrappers.

---

### Option D: Standard SQLite + Field-Level Encryption
*   **Description:** Keep standard, unencrypted SQLite database and Prisma client configuration intact. Password-encrypt only specific sensitive columns (e.g. customer phone numbers, credit balances, and shop credentials) using cryptographically secure algorithms (e.g. AES-256-GCM) in JS before writing.
*   **Official Support Status:** Fully supported (application-level code).
*   **Exact Package Names & Versions:**
    *   `@prisma/client` & `prisma`: `5.14.0`
    *   `better-sqlite3`: `11.2.0`
*   **Electron Compatibility:** Out-of-the-box support (utilizing the working foundation).
*   **Native Rebuild Requirements:** None (uses already verified native modules).
*   **Migration Compatibility:** High. Standard Prisma CLI migrations work without issues.
*   **Type-Safety Impact:** High. Prisma client remains fully type-safe.
*   **Packaging Impact:** None.
*   **Performance Impact:** Very low. Encrypting selected strings adds negligible computational overhead compared to page-level file encryption.
*   **Maintenance Risk:** Low. Uses standard Node.js crypto libraries.
*   **Existing-Code Migration Effort:** Moderate. Requires adding encryption/decryption hooks inside data access services before data payload writes.

---

## 2. Isolated PoC Checkpoints

The isolated Proof of Concept will be built under the directory `poc/sqlcipher-test/` (without modifying primary branch dependencies) to verify the following 15 checkpoints:

1.  **Genuine Encryption:** Create a database file and verify it cannot be opened by a standard SQLite explorer (e.g. DB Browser for SQLite) without the key.
2.  **Unencrypted Read Block:** Confirm that opening the file with standard sqlite connection drivers without a key throws a `File is not a database` or `Encrypted database` error.
3.  **Correct Key Unlock:** Reopen the file with the correct passphrase key and verify the schema is readable.
4.  **Incorrect Key Rejection:** Confirm that attempting to open with an incorrect key rejects connection queries.
5.  **CRUD Integrity:** Write and retrieve a mock `Shop` record to ensure string and metadata fields read/write cleanly.
6.  **Transactional Migrations:** Run transactional DDL statements (e.g., creating a table and inserting records in a single block) and confirm they rollback atomically on failure.
7.  **Data Persistence:** Restart the application process and verify that data is retained across launches.
8.  **Key Rotation:** Rotate or change the database encryption key via `PRAGMA rekey` and verify data is accessible only under the new key.
9.  **Encrypted Backup:** Export a password-encrypted backup file and restore it onto a clean database.
10. **Electron Packaging:** Verify the SQLCipher binary module can be packaged within Electron Builder's ASAR unpack pipelines.
11. **Unpacked App Launch:** Run the unpacked app folder (`dist-package/win-unpacked/`) and verify the database opens successfully.
12. **Installed App Launch:** Compile the `.exe` installer, install it on Windows, and verify runtime database connection success.
13. **Zero-Node Runtime execution:** Confirm that the compiled application starts and runs database routines on a machine without Node.js or npm installed.
14. **Indexed Benchmarking:** Insert 20,000 mock catalog records and measure the search time of indexed columns to confirm it is under the 200ms latency requirement.
15. **Module Paths and ABI Details:** Record the target binary folder layouts, node Gyp build flags, and Node ABI versions for future build pipelines.
