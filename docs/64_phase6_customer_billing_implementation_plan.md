# Phase 6: Customer, POS/Billing, and Printing Implementation Plan

This implementation plan outlines the development path for Phase 6 of Smart Vyapar, an offline-first single-shop Windows Electron desktop application.

---

## 1. Overview and Scope

Phase 6 introduces the Customer Master, Customer Ledger, Sales Invoice (POS/Billing), Payments, and Thermal/A4 Printing. It builds upon verified foundations (SQLCipher SQLite database, DPAPI-secured DB keys, Supplier Ledger architecture, and Inventory Ledger).

### Phase 6.2 Scope (Immediate Implementation)
- **Customer Master**: Form, list, search, duplicate warning, validation, and Walk-In customer seeding.
- **Customer Ledger**: Immutable customer receivable/activity ledger. Outstanding tracking is ledger-derived.
- **Customer Opening Balance**: Immutable opening balance ledger entries (posted through `CustomerLedgerService` via a separate controlled operation).
- **Walk-In Customer Seeding**: Ensured idempotently via `CustomerService` boundary after shop creation, in addition to migration-level scripts.
- **Customer IPC & Preload**: Exposure of narrow APIs for customer CRUD and outstanding queries.
- **Customer UI**: Tabs for listing, creating, viewing customer details, and viewing customer activity.
- **Customer Tests**: Complete CRUD, Walk-In constraints, duplicate phone warnings, opening balance, outstanding, and pagination tests.

### Deferred Scope (Phases 6.3+)
- **Phase 6.3 (Sales Schema)**: Migration creating `SalesInvoice`, `SalesInvoiceLine`, and `SalesPayment` tables.
- **Phase 6.4 (Sales Calculation & Cart)**: Barcode resolution, cart, price resolution, and calculation.
- **Phase 6.5 (Sales Posting & Inventory)**: Atomic posting and stock changes via `InventoryService.postSaleOut`.
- **Phase 6.6 (Sales Cancellation & Payments)**: Reversal of payments, stock, and ledger entries.
- **Phase 6.7 (Bulk Import & Print/PDF)**: Defer customer bulk import processors and hidden BrowserWindow printing to Phase 6.7 after core billing/ledger foundations are verified.

---

## 2. Component Directory Structure

The files created during Phase 6 will be organized according to the existing repository and service architecture:

```
├── electron/
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 20260804150000_customer_foundation/ (Phase 6.2 Migration: Customer, CustomerLedgerEntry)
│   │   │   │   └── migration.sql
│   │   │   └── 20260804160000_sales_foundation/ (Phase 6.3 Migration: SalesInvoice, SalesInvoiceLine, SalesPayment)
│   │   │       └── migration.sql
│   │   └── repositories/
│   │       ├── customer.repository.ts
│   │       ├── customer-ledger.repository.ts
│   │       ├── sales-invoice.repository.ts
│   │       ├── sales-line.repository.ts
│   │       └── sales-payment.repository.ts
│   ├── ipc/
│   │   ├── customer.ipc.ts
│   │   ├── sales.ipc.ts
│   │   └── print.ipc.ts
│   └── services/
│       ├── customer.service.ts
│       ├── customer-ledger.service.ts
│       ├── sales-calculation.service.ts
│       ├── sales.service.ts
│       └── sales-number.service.ts
└── src/
    └── components/
        ├── customers/
        │   ├── CustomerModule.tsx
        │   ├── CustomerList.tsx
        │   ├── CustomerForm.tsx
        │   ├── CustomerView.tsx
        │   └── CustomerLedgerList.tsx
        └── billing/ (Deferred to Phase 6.4+)
            ├── POSModule.tsx
            ├── POSCart.tsx
            ├── POSProductList.tsx
            ├── PaymentDialog.tsx
            └── PrintPreviewDialog.tsx
```

---

## 3. Implementation Workflow

### Step 1: Phase 6.2 Schema Migrations
- Execute chronological migration creating `Customer` and `CustomerLedgerEntry` tables.
- Seed the system Walk-In Customer idempotently.

### Step 2: Repositories & Services (Phase 6.2)
- Implement transactional SQLite repositories (`CustomerRepository` and `CustomerLedgerRepository`).
- Develop `CustomerLedgerService` using standard precision math (Rupees as `REAL`, testing with integer paise).
- Implement `CustomerService` which idempotently verifies and seeds Walk-In Customer after shop creation.

### Step 3: IPC Gateways (Phase 6.2)
- Register narrow, secure IPC handlers validating events using `isTrustedSender` for Customer operations.

### Step 4: Frontend Customer Panels (Phase 6.2)
- Build Customer master lists, view, and creation panels.
- Build Customer receivable/activity ledger view.

---

## 4. Phase 6.2 Completion & Verification Status
- **Status**: PHASE 6.2 IMPLEMENTED & VERIFIED (August 4, 2026)
- **Migrations Applied**:
  - `20260804150000_customer_foundation` (Customer/Ledger core tables)
  - `20260805120000_customer_constraints_correction` (Replaced CHECK constraints to forbid simultaneous zero-debit/zero-credit rows)
- **Verification Evidence**: All automated tests, fresh/upgrade database migrations, security audits, and automated UI smoke test sessions passed successfully. Eleven screenshots captured under `docs/evidence/phase6-customer-foundation/`.
