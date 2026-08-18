# Revised Implementation Roadmap

This document outlines the phased roadmap to align the **Smart Vyapar** project with the technical and business requirements of **BRD Version 2.0**.

---

## Phase 0: Isolated SQLCipher Feasibility (Completed & Verified)
*   **Step 0.1: Setup Isolated Environment**
    *   Create isolated PoC directory (`poc/sqlcipher-test/`). (Completed)
*   **Step 0.2: Database Encryption Feasibility Assessment**
    *   Test `better-sqlite3-multiple-ciphers` (v11.10.0) under Electron ABI 123. (Passed)
    *   Prisma Client adapter was rejected due to peer dependency conflicts and CLI limits. (Verified)
    *   Option B (Raw SQLCipher Driver) was selected as the approved target architecture. (Completed)

---

## Phase 1: Database & Security Foundation Refactoring (Proposed)
*   **Step 1.1: Dependency Transition (Only after Phase 0 approval)**
    *   Transition primary codebase dependencies to `better-sqlite3-multiple-ciphers` (v11.10.0).
    *   Remove legacy `better-sqlite3` and Prisma client runtime dependencies where queries are routed.
*   **Step 1.2: Encryption and Driver Integration**
    *   Refactor database access layer to open connection with key passphrase (`PRAGMA key`).
*   **Step 1.3: Migration Runner Refactoring**
    *   Modify the custom transactional migration executor to unlock the SQLCipher database before executing schema updates.
    *   Verify migrations run correctly in development with `DB_ENCRYPTION=false` toggles.

---

## Phase 2: Logging Refactoring
*   **Step 2.1: electron-log Integration**
    *   Install `electron-log`.
    *   Replace the custom logging wrapper [logger.ts](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/electron/utils/logger.ts) with the `electron-log` implementation.
    *   Preserve the current export boundaries (`logInfo`, `logError`) to prevent breaking code references in controllers and services.

---

## Phase 3: Offline Licensing & Activation Foundation
*   **Step 3.1: Hardware Fingerprinting**
    *   Develop a main-process utility to query multiple stable Windows CIM/system identifiers (using PowerShell CIM cmdlets or Node system APIs).
*   **Step 3.2: Tolerant Verification Logic**
    *   Build a license parser that reads the local license signature file, decrypts it, and validates the signature against a tolerant fingerprint check (matching e.g. 2 out of 3 hardware parameters to handle minor hardware upgrades).
*   **Step 3.3: Read-Only Degradation Routing**
    *   Expose licensing state to the frontend UI.
    *   Enforce UI restrictions and block write IPC channels if the license is expired, ensuring data is degraded to read-only rather than lost.

---

## Phase 4: Backup & Update Infrastructure
*   **Step 4.1: Backup Password Encryption**
    *   Implement password hashing and AES-256 backup file encryption.
*   **Step 4.2: electron-updater Integration**
    *   Configure `electron-updater` settings in `package.json` for online releases.
*   **Step 4.3: Separate Application & Database Rollbacks**
    *   Implement manual pre-migration database snapshot copies before applying updates.
    *   Ensure that database rollbacks are handled separately from application binary rollbacks, allowing database restore if a migration fails on version upgrade.

---

## Phase 5: Business-Module Requirements (Future Phase)
*   **Step 5.1: Database Schema Expansion**
    *   Add Product, Unit, Category, Brand, Customers, Suppliers, Invoices, StockTransactions, and Ledgers models to `schema.prisma`.
*   **Step 5.2: GST & Invoice Calculations**
    *   Build the backend business services for invoice generation, HSN/SAC code lists, and GSTR-1/3B reporting.
*   **Step 5.3: Hardware Service Integration**
    *   Write ESC/POS print services and wedge scanner inter-keystroke filters.
