# 16. Product Database Design

> Continuation note, 2026-08-02: The Product Master migration now removes the duplicate direct `Product.barcode` field, keeps `ProductPrice` as the authoritative price source, adds root category uniqueness, adds Shop foreign keys for StorePriceBook and InventoryOpeningBalance, and idempotently assigns existing shops to the default PriceBook. See `docs/20_product_master_completion_audit.md`.

This document describes the schema design, indexing, and validation strategies implemented for the Product Master module database.

---

## 1. Schema Diagram Overview

```text
  +-------------------+        +--------------------+
  |   UnitOfMeasure   |        |  ProductCategory   |
  +-------------------+        +--------------------+
  | id (PK)           |        | id (PK)            |
  | name              |        | name               |
  | shortName         |        | parentCategoryId   |<----+ (3-level recursion)
  +-------------------+        +--------------------+
           |                             |
           +------------+   +------------+
                        |   |
                    +---+---+------------+        +---------------+
                    |      Product       |------->|     Brand     |
                    +--------------------+        +---------------+
                    | id (PK)            |        | id (PK)       |
                    | productCode (UQ)   |        | name          |
                    | primaryUnitId (FK) |        +---------------+
                    | categoryId (FK)    |
                    | brandId (FK)       |
                    | taxRateId (FK)     |
                    +---------+----------+
                              |
        +---------------------+---------------------+
        |                     |                     |
  +-----+-------------+ +-----+-------------+ +-----+-------------+
  |  ProductBarcode   | |   ProductPrice    | | InventoryOpening  |
  +-------------------+ +-------------------+ +-------------------+
  | id (PK)           | | id (PK)           | | id (PK)           |
  | productId (FK)    | | productId (FK)    | | productId (FK)    |
  | barcode (UQ)      | | priceBookId (FK)  | | shopId            |
  | isPrimary         | | purchasePrice     | | quantity          |
  +-------------------+ | sellingPrice      | | unitCost          |
                        +-------------------+ +-------------------+
```

---

## 2. Integrity and Validation Constraints

### Case-Insensitive Uniqueness (Normalization)
Uniqueness constraints on strings (like productCode, SKU, category name, brand name) are verified using a dedicated normalization process:
1. `trim()`
2. `toLowerCase()`
3. Collapse repeated spaces to single space.

SQLite indexes are built on these normalized columns (e.g. `normalizedProductCode`, `normalizedSku`, `normalizedName`) for constant-time uniqueness checks.

### Product-Type Constraints
- **GOODS Products**:
  - Inventory tracking is configurable (`trackInventory = 0` or `1`).
  - Stock opening balance is permitted only when `trackInventory = 1`.
- **SERVICE Products**:
  - `trackInventory` is forced to `0`.
  - `allowNegativeStock` is forced to `0`.
  - Opening balance is strictly rejected at the service validation layer.
  - No running quantities are stored on the product table.

### Barcode Uniqueness
- Barcodes are tracked in a dedicated table `ProductBarcode` to support 1-to-many lookup (e.g., box barcode vs item barcode).
- Every barcode value is globally unique.
- Maximum of one primary barcode per product. Setting a new primary barcode unsets the previous one inside the same transaction.
