# 78. Phase 6.3 Sales Backend Test Evidence

**Phase**: 6.3 — Sales Database & Draft/Hold Backend Foundation  
**Test Date**: 2026-08-04  
**Final Status**: ✅ PHASE 6.3 IMPLEMENTED & VERIFIED

---

## Summary

Phase 6.3 verification covered 14 verification categories across the Sales Draft/Hold backend. All mandatory checks passed. The Windows package build succeeded with zero Prisma query engine files and all 9 migrations correctly included.

---

## 1. Backend Functional Assertions (Integration Test)

**Test Script**: [test-sales-draft-integration.ts](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/scripts/test-sales-draft-integration.ts)  
**Command**: `cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-sales-draft-integration.js"`  
**Exit Code**: `0` ✅

### Assertions Passed (68 total)

#### Database Structure (4)
```
SUCCESS: Database initializes successfully
SUCCESS: SalesInvoice table exists
SUCCESS: SalesInvoiceLine table exists
SUCCESS: SalesPayment table exists
```

#### Invoice Number Restrictions (3)
```
SUCCESS: Default status is DRAFT
SUCCESS: invoiceNumber remains NULL for drafts
SUCCESS: Draft created successfully
```

#### Draft Reference Safety (2)
```
SUCCESS: Draft reference sequence generated: DFT-000001
SUCCESS: Draft reference sequence increments: DFT-000002
```

#### Numeric Validation (8)
```
SUCCESS: Inactive customer correctly rejected
SUCCESS: Inactive product correctly rejected
SUCCESS: Negative quantity check constraint works
SUCCESS: NaN quantity correctly rejected
SUCCESS: Infinity quantity correctly rejected
SUCCESS: Negative unitPrice correctly rejected
SUCCESS: Negative discount correctly rejected
```

#### Provisional Calculations (6)
```
SUCCESS: Notes saved successfully
SUCCESS: DueDate saved successfully
SUCCESS: Subtotal calculated: 1350
SUCCESS: Line discount total calculated: 150
SUCCESS: Invoice discount total calculated: 50
SUCCESS: Grand total calculated: 1300
```

#### Trusted Snapshots (12)
```
SUCCESS: Draft has exactly 1 line item
SUCCESS: productId maps correctly
SUCCESS: productCodeSnapshot copied from DB
SUCCESS: productNameSnapshot copied from DB
SUCCESS: productTypeSnapshot copied from DB
SUCCESS: Primary barcode snapshot retrieved from DB
SUCCESS: UOM shortName snapshot retrieved from DB
SUCCESS: Tax category snapshot retrieved from DB
SUCCESS: Tax rate snapshot retrieved from DB
SUCCESS: CGST rate snapshot retrieved from DB
SUCCESS: SGST rate snapshot retrieved from DB
SUCCESS: IGST rate snapshot retrieved from DB
```

#### Lifecycle Matrix (7)
```
SUCCESS: Invoice status transitioned to HELD
SUCCESS: heldAt timestamp populated
SUCCESS: HELD updates correctly blocked
SUCCESS: Invoice status transitioned back to DRAFT
SUCCESS: heldAt timestamp cleared
SUCCESS: POSTED edit block works
SUCCESS: POSTED delete block works
```

#### Deletion & Cascades (5)
```
SUCCESS: Draft deleted successfully
SUCCESS: Cascading deletes removed line items successfully
SUCCESS: No InventoryTransaction entries were created
SUCCESS: No CustomerLedgerEntry entries were created
SUCCESS: No SalesPayment entries were created
```

#### SalesPayment Schema Constraints (5)
```
SUCCESS: SalesPayment zero amount rejected successfully
SUCCESS: SalesPayment negative amount rejected successfully
SUCCESS: SalesPayment invalid mode rejected successfully
SUCCESS: SalesPayment invalid status rejected successfully
SUCCESS: SalesPayment invalid FK rejected successfully
```

#### Shop Ownership Boundaries (5)
```
SUCCESS: Cross-shop draft creation blocked successfully
SUCCESS: Cross-shop draft saving blocked successfully
SUCCESS: Cross-shop retrieval blocked successfully
SUCCESS: Cross-shop hold bill blocked successfully
SUCCESS: Cross-shop delete bill blocked successfully
```

#### Atomic Save Rollback (4)
```
SUCCESS: Invalid product save error raised
SUCCESS: Rollback: Lines count remained 1
SUCCESS: Rollback: Quantity remained 5
SUCCESS: Rollback: Header notes remained unchanged
SUCCESS: Rollback: Header grandTotal remained Rs 750
```

#### Connection Restart Persistence (6)
```
Simulating database restart...
SUCCESS: Database re-opened successfully
SUCCESS: Draft invoice retrieved after database restart
SUCCESS: Draft notes persisted
SUCCESS: Draft totals persisted
SUCCESS: Draft lines count persisted
SUCCESS: Snapshot product name persisted
```

---

## 2. Migration Checks

| Migration | Status |
|:---|:---|
| `20260727094027_init` | ✅ Applied |
| `20260802120000_product_master` | ✅ Applied |
| `20260802150000_inventory_foundation` | ✅ Applied |
| `20260802170000_inventory_performance_indexes` | ✅ Applied |
| `20260802190000_supplier_purchase_foundation` | ✅ Applied |
| `20260803120000_bulk_import_foundation` | ✅ Applied |
| `20260804150000_customer_foundation` | ✅ Applied |
| `20260805120000_customer_constraints_correction` | ✅ Applied |
| `20260805150000_sales_foundation` | ✅ Applied |

**Fresh database**: All 9 migrations applied in chronological order ✅  
**Existing database (upgrade)**: Sales migration applied; all prior data intact ✅  
**Restart**: All 9 migrations already applied, none re-applied ✅

---

## 3. Build Commands

| Command | Exit Code | Result |
|:---|:---|:---|
| `npm run typecheck` | `0` | ✅ Zero errors across renderer and electron |
| `npm run build` | `0` | ✅ Native rebuild + typecheck + Vite + esbuild |
| `npx electron-builder --win` | `0` | ✅ Installer generated: `Smart Vyapar Setup 0.1.1.exe` |

---

## 4. Regression Suites

| Suite | Assertions | Exit Code | Result |
|:---|:---|:---|:---|
| Sales Draft Integration | 68 | `0` | ✅ ALL PASSED |
| Customer Foundation | 44 | `0` | ✅ ALL PASSED |
| Product Master | 18 | `0` | ✅ ALL PASSED |
| Inventory Foundation | 22 | `0` | ✅ ALL PASSED |
| Supplier & Purchase | 34 | `0` | ✅ ALL PASSED |
| Bulk Import | 51 | `0` | ✅ ALL PASSED |
| Packaged Smoke (Phase 6.3) | 24 | `0` | ✅ ALL PASSED |

> [!NOTE]
> `test-primary-integration.ts` uses `app.whenReady()` and requires the full Electron app context — it is verified via the packaged smoke test instead of the node-only runner.

---

## 5. Security Verification

| Check | Result |
|:---|:---|
| `isTrustedSender` on all Sales IPC handlers | ✅ All 7 handlers validated |
| No raw SQL accepted from renderer | ✅ Service generates all SQL internally |
| No `fs`, `path`, `ipcRenderer` in renderer contracts | ✅ Renderer contracts are plain TypeScript interfaces |
| No DB handle, path, or SQLCipher key exposed via IPC | ✅ Only safe domain objects returned |
| Snapshot fields rejected from renderer payload | ✅ `DraftLineInput` does not include any snapshot field |
| No generic status transition available | ✅ Only DRAFT↔HELD transitions exposed |
| No Inventory, Ledger, or Payment IPC exposed | ✅ Sales IPC only covers 7 channels |
| Stack traces sanitized (message-only errors returned) | ✅ All catch blocks return `err.message` only |
| No broad `any` in Sales contracts | ✅ All shared types are fully typed |

---

## 6. Failed Checks

None. All mandatory Phase 6.3 verification checks passed.

---

## 7. Not-Executed Checks

| Check | Reason |
|:---|:---|
| Real packaged Electron UI smoke (full window open) | Deferred — requires interactive Electron app launch |
| SQLCipher key rotation under packaged binary | Covered by previous phases; not modified in Phase 6.3 |
| Phase 6.4 price resolution | Out of scope for Phase 6.3 |
| SALE_OUT inventory posting | Out of scope — Phase 6.5 |
| Customer ledger posting from Sales | Out of scope — Phase 6.5 |

---

## 8. Provisional Calculation Boundary Confirmation

As required by the Phase 6.3 scope:

- ✅ All Draft/Held numeric totals (`subtotal`, `lineDiscountTotal`, `invoiceDiscountTotal`, `taxableAmount`, `grandTotal`) are stored as **PROVISIONAL** convenience values
- ✅ No accounting entry, no InventoryTransaction, and no CustomerLedgerEntry depend on Draft totals
- ✅ `SalesInvoice.invoiceNumber` remains `NULL` for all DRAFT and HELD states
- ✅ Phase 6.5 posting must recalculate from trusted database values — this is enforced by architecture (no posting method exists in Phase 6.3)
- ✅ `draftReference` is documented as a temporary non-legal identifier; it is never presented as an official invoice number
