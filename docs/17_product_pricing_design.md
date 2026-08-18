# 17. Product Pricing Design

> Continuation note, 2026-08-02: Final validation confirmed `ProductPrice` remains the authoritative pricing source, with Product cached price fields updated only by `PricingService`. Packaging no longer includes Prisma query-engine runtime files.

This document describes the Product Pricing design, date-range overlap validation, and default price-book integration.

---

## 1. Authoritative Source of Truth

- **Direct Pricing Rejection**: To support multi-tier price lists and customer-specific contract rates, Smart Vyapar rejects raw price fields directly inside the `Product` table as the authority.
- **ProductPrice Table**: The `ProductPrice` table is the sole source of truth for all pricing data.
- **Caching**: The `Product` table contains read-only cache fields (`cachedPurchasePrice`, `cachedSellingPrice`, `cachedMrp`, `cachedWholesalePrice`) which are derived and updated exclusively by the `PricingService` in a transaction.

---

## 2. Effective-Date Overlap Validation

To prevent multiple active prices at a given date, the `PricingService` performs date-range overlap validation before inserting or modifying price records.

### Logic
The overlap check looks for any records for the same product and price-book matching:
$$\text{effectiveFrom}_A \le \text{effectiveTo}_B \quad \text{and} \quad \text{effectiveFrom}_B \ge \text{effectiveTo}_A$$

Where a null `effectiveTo` represents an open-ended validity (resolved to `'9999-12-31'`).

```ts
let sql = `
  SELECT count(*) as c FROM ProductPrice
  WHERE productId = ? AND priceBookId = ? AND isActive = 1
    AND effectiveFrom <= COALESCE(?, '9999-12-31')
    AND COALESCE(effectiveTo, '9999-12-31') >= ?
`;
```

Any detected overlap results in a transaction rollback.

---

## 3. Seed Default PriceBook

1. A default PriceBook `pricebook-default` ("Standard Price List") is seeded chronologically by the custom migration runner.
2. During initialization, if a Shop profile exists, the `PricingService` registers an active assignment (`StorePriceBook` mapping Shop -> default PriceBook) effective immediately.
3. Full administration and custom price-book UI is deferred for future modules.
