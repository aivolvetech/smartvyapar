# Phase 6: Customer Ledger Design

This document describes the customer ledger design, including ledger entries, outstanding calculation rules, and walk-in exclusions.

---

## 1. Terminology and Scope

All references to "double-entry customer ledger" are replaced by **"immutable customer receivable/activity ledger"**. General Ledger double-entry accounting is not part of Phase 6. The ledger acts solely as an audit log of receivables and activities between the customer and the shop.

---

## 2. Customer Ledger Table Schema

The outstanding balance of a customer is a derived value calculated by summing ledger entries. There is no direct mutable column on the `Customer` table, enforcing auditability.

```sql
CREATE TABLE "CustomerLedgerEntry" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "customerId"      TEXT NOT NULL,
    "shopId"          TEXT NOT NULL,
    "entryType"       TEXT NOT NULL,
    "referenceType"   TEXT NOT NULL,
    "referenceId"     TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debitAmount"     REAL NOT NULL DEFAULT 0,
    "creditAmount"    REAL NOT NULL DEFAULT 0,
    "occurredAt"      TEXT NOT NULL,
    "notes"           TEXT,
    "createdAt"       TEXT NOT NULL,
    
    CHECK ("entryType" IN ('OPENING_BALANCE', 'SALE', 'SALE_CANCELLATION', 'RECEIPT', 'RECEIPT_REVERSAL', 'SALES_RETURN', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADJUSTMENT')),
    CHECK ("debitAmount" >= 0),
    CHECK ("creditAmount" >= 0),
    CHECK (
        ("debitAmount" > 0 AND "creditAmount" = 0) OR 
        ("creditAmount" > 0 AND "debitAmount" = 0) OR 
        ("debitAmount" = 0 AND "creditAmount" = 0)
    ),
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id"),
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
);

CREATE INDEX "CustomerLedgerEntry_customerId_idx" ON "CustomerLedgerEntry"("customerId");
CREATE INDEX "CustomerLedgerEntry_shopId_idx" ON "CustomerLedgerEntry"("shopId");
CREATE INDEX "CustomerLedgerEntry_occurredAt_idx" ON "CustomerLedgerEntry"("occurredAt");
CREATE INDEX "CustomerLedgerEntry_reference_idx" ON "CustomerLedgerEntry"("referenceType", "referenceId");
```

---

## 3. Full-Statement Customer Ledger Policy

We implement a full-statement customer ledger policy for non-Walk-In customers:
- **SALE debit** = invoice grand total
- **RECEIPT credit** = actual paid amount
- **Outstanding** = total debit minus total credit
- **Walk-In Customer Exclusion**: The system Walk-In Customer is blocked from having ledger entries. Walk-In bills must be fully paid via immediate cash/UPI/card payments, meaning credit is disallowed. Walk-in bills do not create customer ledger rows.

### Query Implementation
```sql
SELECT 
    COALESCE(SUM(debitAmount), 0) AS totalDebits,
    COALESCE(SUM(creditAmount), 0) AS totalCredits,
    COALESCE(SUM(debitAmount - creditAmount), 0) AS outstanding
FROM CustomerLedgerEntry
WHERE customerId = ?;
```

---

## 4. Precision and Arithmetic Strategy

- Monetary fields in the database remain as `REAL` for schema consistency with legacy modules.
- Calculations in JavaScript utilize a shared two-decimal rounding utility:
  ```typescript
  function money(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  ```
- **Deterministic Test Verification**: For assertion correctness, integration tests must convert decimal balances to integer paise before comparison (e.g., `Math.round(balance * 100) === expectedPaise`) to eliminate decimal float representation differences.

---

## 5. Controlled Opening Balance Posting

- Customer creation must **not** automatically post an opening balance.
- Setting or editing opening balances must be performed as a separate, controlled operation invoking `CustomerLedgerService.recordOpening` explicitly.
- Only one `OPENING_BALANCE` ledger entry is allowed per customer. Subsequent edits must use `ADJUSTMENT` entries to maintain an immutable log.
