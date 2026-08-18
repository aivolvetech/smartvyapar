# Historical Prisma Foundation Archive

This folder stores the decommissioned standard SQLite and Prisma connection manager implementation (`prisma.ts`) archived on August 2, 2026.

---

## 1. Reason for Decommissioning

Prisma ORM does not support custom connection handles, which blocks injecting the SQLCipher encryption key commands (`PRAGMA key`). Transitioning to Option B (direct SQLCipher database repositories) eliminates dependencies on the unencrypted standard drivers, speeds up lookup and index operations to sub-millisecond latencies, and simplifies production packaging by removing external Rust query engines from target ASAR archives.

---

## 2. Transition Plan & Replacement

*   **Replacement Stack:** Programmatic connection initialization using `better-sqlite3-multiple-ciphers` and `ShopRepository` prepared SQL queries.
*   **Plain to Encrypted Conversion:** Existing development database data (e.g. `dev.db` shop records) is transactionally cloned and converted into the encrypted binary database format (`dev-encrypted.db`) on application startup.

---

## 3. Rollback Instructions

If you need to roll back to the Prisma-based unencrypted SQLite foundation:
1.  Restore imports in `electron/main/main.ts` to query `initializePrisma` from the historical `prisma.ts` module.
2.  Restore imports in `electron/services/shop.service.ts` to connect to `prisma.shop` client context.
3.  Revert `package.json` configurations to bundler and external rules matching the pre-migration safety backup.
