# 67. Sales Invoice Database Design

**Phase**: 6.3 — Sales Database & Draft/Hold Backend Foundation  
**Status**: IMPLEMENTED & VERIFIED  
**Last Updated**: 2026-08-04

---

## 1. Overview

This document describes the authoritative database schema for the Sales Invoice subsystem introduced in Phase 6.3. The schema supports the full lifecycle from **DRAFT** → **HELD** → **POSTED** → **CANCELLED**, while enforcing strict boundaries around invoice number generation, snapshot immutability, and provisional calculation handling.

> [!IMPORTANT]
> All Draft and Held totals (subtotal, discounts, taxes, grandTotal) are **provisional only**. They are convenience fields for UI display and must never be used as authoritative financial values. Phase 6.5 final posting **must recalculate** all totals from trusted database values before generating any accounting entry.

---

## 2. Tables

### 2.1 SalesInvoice

The primary invoice header. Each row represents one customer billing session.

| Column | Type | Nullable | Notes |
|:---|:---|:---|:---|
| `id` | TEXT PK | No | UUID generated in main process |
| `shopId` | TEXT FK | No | FK → Shop.id |
| `customerId` | TEXT FK | No | FK → Customer.id |
| `draftReference` | TEXT | No | Human-readable temp ID (e.g., `DFT-000001`), unique per shop |
| `invoiceNumber` | TEXT | **Yes** | **NULL until Phase 6.5 POSTED transition** — official document number |
| `invoiceDate` | TEXT | No | `YYYY-MM-DD` format |
| `dueDate` | TEXT | Yes | Optional payment due date |
| `status` | TEXT | No | `DRAFT` \| `HELD` \| `POSTED` \| `CANCELLED` |
| `paymentStatus` | TEXT | No | `UNPAID` \| `PARTIAL` \| `PAID` \| `OVERPAID` |
| `salesChannel` | TEXT | No | `POS` \| `COUNTER` \| `ONLINE` \| `PHONE` |
| `subtotal` | REAL | No | **Provisional** — sum of line totals before discounts |
| `lineDiscountTotal` | REAL | No | **Provisional** — sum of all per-line discount amounts |
| `invoiceDiscountType` | TEXT | No | `NONE` \| `PERCENT` \| `AMOUNT` |
| `invoiceDiscountValue` | REAL | No | Raw input value |
| `invoiceDiscountTotal` | REAL | No | **Provisional** — computed invoice-level discount |
| `taxableAmount` | REAL | No | **Provisional** — amount subject to tax |
| `cgstTotal` | REAL | No | **Provisional** — total CGST |
| `sgstTotal` | REAL | No | **Provisional** — total SGST |
| `igstTotal` | REAL | No | **Provisional** — total IGST |
| `cessTotal` | REAL | No | **Provisional** — total Cess |
| `roundOff` | REAL | No | **Provisional** — rounding adjustment |
| `grandTotal` | REAL | No | **Provisional** — final payable amount |
| `paidAmount` | REAL | No | Total collected (Phase 6.5) |
| `outstandingAmount` | REAL | No | grandTotal − paidAmount |
| `changeAmount` | REAL | No | Excess payment returned |
| `notes` | TEXT | Yes | Optional free text |
| `heldAt` | TEXT | Yes | ISO timestamp when bill was held |
| `postedAt` | TEXT | Yes | ISO timestamp of final posting |
| `cancelledAt` | TEXT | Yes | ISO timestamp of cancellation |
| `cancellationReason` | TEXT | Yes | Optional reason |
| `createdAt` | TEXT | No | ISO timestamp |
| `updatedAt` | TEXT | No | ISO timestamp |
| `version` | INTEGER | No | Optimistic locking counter |

**Key Constraints:**
```sql
UNIQUE(shopId, draftReference)   -- Shop-safe draft identity
UNIQUE(invoiceNumber) WHERE invoiceNumber IS NOT NULL  -- Sparse unique on official numbers
CHECK(status IN ('DRAFT','HELD','POSTED','CANCELLED'))
CHECK(paymentStatus IN ('UNPAID','PARTIAL','PAID','OVERPAID'))
CHECK(salesChannel IN ('POS','COUNTER','ONLINE','PHONE'))
CHECK(invoiceDiscountType IN ('NONE','PERCENT','AMOUNT'))
```

---

### 2.2 SalesInvoiceLine

One row per product line within an invoice.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | TEXT PK | UUID |
| `salesInvoiceId` | TEXT FK | FK → SalesInvoice.id (CASCADE DELETE) |
| `productId` | TEXT FK | FK → Product.id |
| `productCodeSnapshot` | TEXT | **Trusted** — copied from DB at save time, never from renderer |
| `productNameSnapshot` | TEXT | **Trusted** — copied from DB at save time |
| `barcodeSnapshot` | TEXT | Primary barcode from ProductBarcode table |
| `hsnSacCodeSnapshot` | TEXT | HSN/SAC code from Product table |
| `productTypeSnapshot` | TEXT | `GOODS` or `SERVICE` from Product table |
| `unitId` | TEXT FK | FK → UnitOfMeasure.id |
| `unitNameSnapshot` | TEXT | `shortName` from UnitOfMeasure table |
| `taxRateId` | TEXT FK | FK → TaxRate.id |
| `taxCategorySnapshot` | TEXT | e.g., `GST`, `EXEMPT` |
| `taxRateSnapshot` | REAL | Total tax % (e.g., 18) |
| `quantity` | REAL | CHECK > 0 |
| `unitPrice` | REAL | CHECK >= 0 |
| `mrp` | REAL | CHECK >= 0 |
| `minimumSellingPrice` | REAL | Optional floor price |
| `discountType` | TEXT | `NONE` \| `PERCENT` \| `AMOUNT` |
| `discountValue` | REAL | CHECK >= 0 |
| `discountAmount` | REAL | **Provisional** |
| `invoiceDiscountAllocation` | REAL | **Provisional** — share of invoice-level discount |
| `taxableAmount` | REAL | **Provisional** |
| `cgstRate` | REAL | Half the intra-state tax rate |
| `cgstAmount` | REAL | **Provisional** |
| `sgstRate` | REAL | Half the intra-state tax rate |
| `sgstAmount` | REAL | **Provisional** |
| `igstRate` | REAL | Full inter-state tax rate |
| `igstAmount` | REAL | **Provisional** |
| `cessRate` | REAL | Additional cess % |
| `cessAmount` | REAL | **Provisional** |
| `lineTotal` | REAL | **Provisional** — quantity × (unitPrice − discount) |
| `inventoryTransactionId` | TEXT | NULL in DRAFT/HELD; populated only in Phase 6.5 POSTED |
| `createdAt` | TEXT | ISO timestamp |
| `updatedAt` | TEXT | ISO timestamp |

---

### 2.3 SalesPayment

Structural schema only. **Payment capture is deferred to Phase 6.5.**

| Column | Type | Notes |
|:---|:---|:---|
| `id` | TEXT PK | UUID |
| `salesInvoiceId` | TEXT FK | FK → SalesInvoice.id (CASCADE DELETE) |
| `paymentMode` | TEXT | CHECK IN (`CASH`,`UPI`,`CARD`,`CHEQUE`,`CREDIT`,`MIXED`) |
| `amount` | REAL | CHECK > 0 (zero and negative amounts rejected) |
| `paymentDate` | TEXT | `YYYY-MM-DD` |
| `referenceNumber` | TEXT | Optional — UPI transaction ID, cheque number |
| `status` | TEXT | CHECK IN (`CAPTURED`,`REFUNDED`,`FAILED`) |
| `notes` | TEXT | Optional |
| `createdAt` | TEXT | ISO timestamp |

> [!CAUTION]
> No SalesService method, no IPC handler, and no preload API creates SalesPayment rows in Phase 6.3. The Phase 6.3 test suite verifies that zero SalesPayment rows are created during the complete draft lifecycle.

---

## 3. Draft Reference Numbering

`draftReference` is a **temporary, non-legal human-readable identifier** for UI display during active drafting sessions.

**Format**: `DFT-NNNNNN` where NNNNNN is a zero-padded 6-digit monotonic sequence per shop.  
**Generation**: Main process only — reads all existing `DFT-*` references from the shop and computes `max(seq) + 1`.  
**Uniqueness**: Enforced by `UNIQUE(shopId, draftReference)` database constraint.  
**Restart Safety**: Sequence is computed from persisted database records, so it survives application restarts.

> [!WARNING]
> `draftReference` must never be presented to the customer as an invoice number or a legal document identifier. The official sales invoice number is generated only during atomic Phase 6.5 final posting.

---

## 4. Status Machine

```
              createDraft()
                   │
                   ▼
              ┌─────────┐
              │  DRAFT  │◄──── resumeBill()
              └─────────┘
                   │
              holdBill()
                   │
                   ▼
              ┌─────────┐
              │  HELD   │
              └─────────┘

Phase 6.5 only:
  DRAFT ──postSale()──► POSTED
  POSTED ──cancel()──► CANCELLED
```

**Rules enforced in service layer:**
- Only `DRAFT` can be saved, updated, or held
- Only `HELD` can be resumed
- Only `DRAFT` or `HELD` can be deleted
- `POSTED` and `CANCELLED` transitions are not available in any Phase 6.3 API
- `invoiceNumber` remains NULL in all Phase 6.3 states

---

## 5. Provisional Calculation Boundary

All numeric totals stored in `SalesInvoice` and `SalesInvoiceLine` during DRAFT/HELD states are **provisional**. They are computed using a two-decimal money utility (`Math.round(x * 100) / 100`) and persisted for UI convenience.

**Authoritative posting (Phase 6.5) must:**
1. Re-read all product prices, tax rates, and discount rules from the live database
2. Recalculate all subtotals, tax amounts, and grand totals from trusted sources
3. Never blindly copy Draft numeric fields into a posted financial record
4. Generate the official `invoiceNumber` from a locked document sequence
5. Create `InventoryTransaction` rows for each GOODS line
6. Post `CustomerLedgerEntry` for the receivable

---

## 6. Trusted Snapshot Population

The following snapshot fields are **always populated by the main process** (SalesService) from the SQLCipher database. They are **never accepted from the renderer**:

| Field | Source |
|:---|:---|
| `productCodeSnapshot` | `Product.productCode` |
| `productNameSnapshot` | `Product.name` |
| `barcodeSnapshot` | `ProductBarcode.barcode` WHERE `isPrimary = 1` |
| `hsnSacCodeSnapshot` | `Product.hsnSacCode` |
| `productTypeSnapshot` | `Product.productType` |
| `unitNameSnapshot` | `UnitOfMeasure.shortName` |
| `taxCategorySnapshot` | `TaxRate.taxCategory` |
| `taxRateSnapshot` | `TaxRate.rate` |
| `cgstRate` | `TaxRate.cgstRate` |
| `sgstRate` | `TaxRate.sgstRate` |
| `igstRate` | `TaxRate.igstRate` |
| `cessRate` | `TaxRate.cessRate` |

The renderer `DraftLineInput` contract does **not** contain any snapshot field. Supplying extra fields in the renderer payload is ignored — they are stripped at the IPC boundary and never forwarded to the service.
