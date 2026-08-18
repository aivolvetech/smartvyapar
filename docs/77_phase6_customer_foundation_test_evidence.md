# Phase 6.2 Customer Foundation Test Evidence

This document contains the official test evidence for Phase 6.2 (Customer Master and Customer Ledger Foundation) of Smart Vyapar.

---

## 1. Summary of Verification States

### Backend Integration Functional Assertions
- **Total Assertions**: 32
- **PASSED**: 32
- **FAILED**: 0
- **NOT EXECUTED**: 0

### UI Smoke Test Checkpoints
- **Total Verification Checkpoints**: 11
- **PASSED**: 11
- **FAILED**: 0
- **NOT EXECUTED**: 0

### Build & Compilation Verification
- **Total Commands**: 2 (`npm run typecheck`, `npm run build`)
- **PASSED**: 2
- **FAILED**: 0
- **NOT EXECUTED**: 0

### Regression Suite Checks
- **Total Suites**: 6 (SQLCipher Startup, Product, Inventory, Supplier/Purchase, Bulk Import, Customer Integration)
- **PASSED**: 6
- **FAILED**: 0
- **NOT EXECUTED**: 0

- **Final Status**: **PHASE 6.2 IMPLEMENTED & VERIFIED**

---

## 2. Verification Matrices

### A. Normalization Policy (PASSED)
- `customerCode`: whitespace trimmed, preserved as typed (e.g. `CUST-000001`).
- `normalizedCustomerCode`: whitespace trimmed, lowercased (e.g. `cust-000001`). Enforced unique per Shop.
- `name`: whitespace trimmed, preserved as typed (e.g. `Shirish Kale`).
- `normalizedName`: whitespace trimmed, lowercased (e.g. `shirish kale`).
- `phone`: whitespace trimmed, preserved as typed.
- `normalizedPhone`: non-numeric characters removed (e.g. `9888877777`). Used for duplicate warnings.

### B. Walk-In Uniqueness (PASSED)
- Composite SQLite index `Customer_shopId_isWalkIn_key` ON `Customer(shopId, isWalkIn) WHERE isWalkIn = 1` enforces at most one Walk-In Customer record per shop.
- A second direct insert of a Walk-In record triggers a SQLite `UNIQUE constraint failed` error and is rejected.
- Programmatic Walk-In seeding via `CustomerService` is fully idempotent.
- Walk-In deactivation, renaming, type alteration, credit terms (limit/days), and ledger entries are completely blocked at the service layer.

### C. Customer CRUD Matrix (PASSED)
- Standard profiles (`RETAIL`, `WHOLESALE`, `DISTRIBUTOR`, `CORPORATE`) created successfully.
- Retrieval by ID and search by code/name/phone/GST works.
- Active state toggle (`deactivate` and `reactivate`) works.
- Hard delete of a customer referenced by ledger rows is blocked at database foreign key level.

### D. Validation Matrix (PASSED)
- Missing name is blocked.
- Duplicate case-insensitive code per shop is blocked.
- Invalid GST and PAN formats are blocked.
- Active GST conflict (same GST assigned to two active customers) is blocked.
- Duplicate phone warnings display successfully without blocking.
- Credit limits and terms cannot be negative.

### E. Customer Ledger Database Constraints (PASSED)
- SQLite check constraints on `CustomerLedgerEntry` block:
  - Negative `debitAmount`
  - Negative `creditAmount`
  - Dual positive amounts (debit > 0 AND credit > 0)
  - Dual zero amounts (debit = 0 AND credit = 0)
- Foreign keys for `customerId` and `shopId` are strictly enforced.
- Idempotency key uniqueness check prevents duplicate openings.

### F. Opening Balance Matrix (PASSED)
- `RECEIVABLE` balance type posts a Debit amount.
- `ADVANCE` balance type posts a Credit amount.
- `NONE` creates no ledger entry.
- Floating-point amounts are correctly rounded to 2 decimals at service boundary.
- Tests convert double-precision balances to integer paise for exact comparisons.
- Zero and negative amounts are blocked.
- Walk-In customer is blocked from receiving an opening balance.
- Transactions rollback atomically on constraint failures.

---

## 3. UI Smoke Verification Screenshots

All screenshots are saved in the workspace folder `docs/evidence/phase6-customer-foundation/`:

1. [01_dashboard_after_setup.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/01_dashboard_after_setup.png) - App launches and fresh Shop Setup succeeds.
2. [02_customer_list_initial.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/02_customer_list_initial.png) - Walk-In Customer seeded on initial load.
3. [03_new_customer_form.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/03_new_customer_form.png) - Add Customer form modal opens.
4. [04_customer_list_with_shirish.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/04_customer_list_with_shirish.png) - Shirish Kale profile saved successfully.
5. [05_validation_duplicate_code.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/05_validation_duplicate_code.png) - Duplicate customer code error banner.
6. [06_validation_gst_conflict.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/06_validation_gst_conflict.png) - GST number active conflict warning banner.
7. [07_customer_view_shirish.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/07_customer_view_shirish.png) - Shirish Kale details panel.
8. [08_customer_shirish_with_ledger.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/08_customer_shirish_with_ledger.png) - Posted opening balance (debit) outstanding card and ledger row.
9. [09_customer_geeta_advance.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/09_customer_geeta_advance.png) - Posted opening advance (credit) outstanding card showing negative balance.
10. [10_walkin_view_details.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/10_walkin_view_details.png) - Walk-In customer profile (hides Opening Balance actions).
11. [11_walkin_edit_form.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/phase6-customer-foundation/11_walkin_edit_form.png) - Walk-In customer edit form with deactivation and type modification fields disabled.

---

## 4. Fresh and Upgrade Migration Tests

### Fresh Database Test (PASSED)
- Database starts with zero files.
- All 8 migrations apply sequentially.
- Tables `Customer` and `CustomerLedgerEntry` are created.
- Walk-In Customer is seeded exactly once.

### Phase 5.5 Upgrade Test (PASSED)
- Loaded database state with existing Product, Inventory, Supplier, and Purchase records.
- Customer migrations applied successfully with no errors.
- Pre-existing data remains fully intact and readable.
- System Walk-In Customer seeded successfully.

---

## 5. Build and Regressions Results

| Execution Command | Target Module | Result | Exit Code |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | Entire TypeScript project | **PASSED** | `0` |
| `npm run build` | Application bundler | **PASSED** | `0` |
| `npx electron dist-test/test-customer-foundation-integration.js` | Customer Master & Ledger | **PASSED** | `0` |
| `npx electron dist-test/test-primary-integration.js` | SQLCipher & Key Rotation | **PASSED** | `0` |
| `npx electron dist-test/test-product-integration.js` | Product Master | **PASSED** | `0` |
| `npx electron dist-test/test-inventory-integration.js` | Inventory Ledger | **PASSED** | `0` |
| `npx electron dist-test/test-supplier-purchase-integration.js` | Supplier Ledger & Purchases | **PASSED** | `0` |
| `npx electron dist-test/test-import-integration.js` | Bulk CSV/XLSX Imports | **PASSED** | `0` |

---

## 6. Security Audit (PASSED)

- **No raw SQL in renderer**: Enforced via Electron contextBridge.
- **No filesystem exposure**: File actions isolated inside Node main process.
- **No broad any type usage**: All service inputs and models are strictly typed.
- **Errors returned to renderer contain no stack traces**: Main process formats error messages before throwing them across IPC boundaries.
- **IPC Gateways**: Validated using `isTrustedSender` checks to prevent arbitrary payload triggers.
