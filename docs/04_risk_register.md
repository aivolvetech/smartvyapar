# Risk Register

This document tracks technical risks, potential impacts, and mitigation strategies for **Smart Vyapar**.

---

## Risk-01: Unsupported Prisma/SQLCipher Adapter Configuration
*   **Description:** Prisma does not officially support SQLCipher. Utilizing `@prisma/adapter-better-sqlite3` combined with unverified third-party libraries (like `better-sqlite3-multiple-ciphers`) could fail to execute complex queries, migrations, or transactions.
*   **Impact:** Critical. Database queries could fail at runtime, blocking the billing application completely.
*   **Mitigation:** **MITIGATED:** The Prisma adapter option has been officially rejected, and the application database layer is transitioned to direct SQLCipher queries (Option B), eliminating the risk of unsupported adapter configurations at runtime.

---

## Risk-02: Native Electron Module Packaging & ABI Rebuilds
*   **Description:** SQLCipher drivers are compiled native modules (`.node`). If they are not compiled correctly for the exact Electron ABI runtime version or if they are packaged incorrectly inside ASAR, loading the database will trigger DLL load failures.
*   **Impact:** Critical. The packaged production app fails to start or open the database.
*   **Mitigation:** **VERIFIED:** Rebuild targeting Electron ABI 123 using `electron-builder install-app-deps` is confirmed to execute successfully under Electron Node. Native libraries will be configured for ASAR unpacking.

---

## Risk-03: Database Encryption-Key Loss
*   **Description:** If the local system-derived database key becomes corrupted, deleted, or unsynchronized (e.g. system reformat), the encrypted database file will be permanently locked.
*   **Impact:** Critical. Complete loss of shopkeeper data and customer ledgers.
*   **Mitigation:** **MITIGATED & VERIFIED:** Implemented a secure recovery key manager that generates a passphrase-wrapped scrypt KDF + AES-256-GCM recovery JSON packet, permitting DB recovery if DPAPI credentials are lost.

---

## Risk-04: Local Encryption-Key Extraction Threat
*   **Description:** Since the app is fully offline and self-contained, the encryption key must be derived locally on the client machine. A malicious actor with access to the source code and database file could decompile the Javascript main process bundle and reverse-engineer the key-derivation routine.
*   **Impact:** High. Leakage of customer contact details and shop pricing ledgers.
*   **Mitigation:** **MITIGATED & VERIFIED:** Implemented production-grade Windows DPAPI (`CurrentUser` scope) key protection. Key blobs are bound to the Windows user profile, preventing local plaintext storage, renderer access, or cross-profile exposure.

---

## Risk-05: SQLCipher Database Performance Overhead
*   **Description:** Database operations are subject to latency from Prisma query translation, Javascript driver execution, native-module calls, and SQLCipher page-level encryption/decryption overhead. This could exceed performance requirements (e.g. catalog searches under 200ms).
*   **Impact:** Medium. UI lag during high-frequency barcode scanning or invoicing.
*   **Mitigation:** **MITIGATED & VERIFIED:** Benchmark measurements on 20,000 products confirm lookup and index queries execute in < 0.2ms warm (well under the 200ms limit). Database indexes on search fields are verified.

---

## Risk-06: Development vs. Production Database Divergence
*   **Description:** Toggling encryption off during development to allow Prisma CLI tools to run (`prisma migrate dev`, `prisma studio`) while using full SQLCipher encryption in production could cause migrations to behave differently, leading to runtime schema issues.
*   **Impact:** Medium. Schema mismatches or silent migration failures in production.
*   **Mitigation:** Verify database upgrades on real-shaped mock databases using the programmatic startup migration runner before shipping.
