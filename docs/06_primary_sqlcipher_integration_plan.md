# Primary SQLCipher Integration Plan

This document details the transition plan for migrating the primary **Smart Vyapar** database layer from standard SQLite/Prisma to the Raw SQLCipher architecture.

---

## 1. Current Architecture vs Target Architecture

### Current Stack:
*   React Renderer UI queries database through `window.smartVyapar` Context Bridge.
*   IPC Handlers (`electron/ipc/`) route queries to `ShopService` (`electron/services/`).
*   `ShopService` queries the database via `PrismaClient` runtime instance.
*   Prisma executes queries through its Query Engine DLL which connects to a standard unencrypted SQLite database (`dev.db` in dev, `smart-vyapar.db` in production).
*   Programmatic startup runner executes migrations transactionally before Prisma connects.

### Target Stack (Option B):
*   Prisma runtime dependencies are deactivated.
*   `ShopService` queries the database via `ShopRepository` which runs raw SQL queries against a secure SQLCipher connection handle.
*   The database is unlocked on connection using a Windows DPAPI-protected key blob.
*   Programmatic migrations and backup/restore procedures run directly on the encrypted connection.

---

## 2. Files Requiring Change

1.  **package.json / package-lock.json:**
    *   Add `better-sqlite3-multiple-ciphers` (v11.10.0) and `@primno/dpapi` (v2.0.1) as pinned dependencies.
    *   Adjust `build:electron` script to mark the new native packages as `--external` for `esbuild`.
    *   Configure `asarUnpack` to unpack `@primno/dpapi` and `better-sqlite3-multiple-ciphers` in production build settings.
2.  **electron/main/main.ts:**
    *   Swap database boot sequences to use the new connection initializer, bypassing Prisma initialization.
3.  **electron/services/shop.service.ts:**
    *   Inject `ShopRepository` instead of `prisma` client.
4.  **electron/database/ (Refactoring):**
    *   Decommission `prisma.ts` runtime connection.
    *   Create `database-connection.ts`, `database-initializer.ts`, `database-paths.ts`.
    *   Create programmatic migration runner and backup service targeting SQLCipher.
5.  **electron/security/ (New Component):**
    *   Create `database-key-provider.ts` and `recovery-key-manager.ts` to manage Windows DPAPI current-user storage and backup passphrase wrapping.

---

## 3. Shop Data-Flow Map

```text
React Renderer (UI View)
       ↓
Preload Context Bridge (window.smartVyapar.getShop)
       ↓
IPC Handler (shop:get channel)
       ↓
ShopService (Input validation)
       ↓
ShopRepository (Raw SQL Queries / Prepared statements)
       ↓
SQLCipher Connection Manager (database-connection.ts)
       ↓
better-sqlite3-multiple-ciphers (Native SQLCipher C-Engine)
       ↓
userData/data/smart-vyapar.db (Encrypted binary file)
[Automated Tests: test-data/primary-integration/smart-vyapar.db]
```

---

## 4. Migration & Rollback Strategy

1.  **Pre-migration backup:** Run `VACUUM INTO` on the active database to create a consistent backup at `userData/backups/smart-vyapar.db.bak`.
2.  **Failed Migration Rollback:** If any SQL migration fails, roll back the transaction, rename the failed file to `smart-vyapar.failed-<timestamp>.db`, copy the backup back to the active location, and perform an integrity check on the restored database.
3.  **Data Conversion:** If a plain SQLite database is detected at startup, close the active handles, clone the data into a temporary SQLCipher-encrypted database, validate row counts and field-level values, and atomically replace the active database.

---

## 5. Risks & Mitigations

*   **Risk:** DPAPI profile key loss due to OS reinstalls.
    *   *Mitigation:* Create a scrypt-wrapped AES-256-GCM recovery JSON package that stores the database key under a user passphrase.
*   **Risk:** Packaging errors due to native Node modules in ASAR.
    *   *Mitigation:* Configure `asarUnpack` for both native modules to ensure dynamic loader linking in production.
*   **Risk:** esbuild compilation errors for native binaries.
    *   *Mitigation:* Pin dependencies as external for esbuild bundler.
