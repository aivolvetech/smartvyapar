# 15. Product Master Implementation Plan

> Continuation note, 2026-08-02: Phase 3 was audited and validated in `docs/20_product_master_completion_audit.md`. Browser mock UI evidence is in `docs/21_product_ui_visual_evidence.md`; real packaged Electron launch remains not executed pending explicit approval because it can touch the real per-user SQLCipher database.

This document details the architectural decisions and execution steps taken to integrate the Product Master and supporting catalog tables into Smart Vyapar.

---

## 1. Architectural Decisions

- **Raw SQLCipher connection (Option B)**: The data access layer uses raw sqlite queries via `better-sqlite3-multiple-ciphers` to support secure runtime encryption at rest.
- **ProductPrice Authoritative Pricing**: Pricing is separated from the `Product` entity. Price columns on `Product` are strictly derived/cached fields updated inside price list transactions.
- **Service Layer Transaction Wrapper**: Product creation/update operations run inside a single database transaction, ensuring atomicity across Product, ProductBarcode, ProductPrice, and InventoryOpeningBalance tables.
- **Normalized Columns**: Uniqueness and indexed lookups are performed on normalized lowercase forms of codes, names, and SKUs.
- **Category Depth Enforced**: A maximum category depth of 3 levels is verified inside the service layer.

---

## 2. Component Deliverables

### A. SQLite Schema (20260802120000_product_master)
- `UnitOfMeasure`: Seeded with standard items (PCS, KG, LTR, etc.) with decimal constraints.
- `ProductCategory`: Custom hierarchy up to depth of three levels.
- `Brand`: Standard catalog lookup.
- `TaxRate`: GST rate slabs (0%, 5%, 12%, 18%, 28%) and custom tax types (EXEMPT, ZERO_RATED, etc.).
- `PriceBook`: Deterministic default PriceBook seeded.
- `Product`: Main product data with derived pricing caches.
- `ProductBarcode`: Separate lookup table supporting primary barcodes.
- `ProductPrice`: Effective-date driven product pricing.
- `StorePriceBook`: Mapping shop to active price books.
- `InventoryOpeningBalance`: Stock opening records mapped by product+shop.

### B. Service and Repository Layer
- Services: `ProductService`, `PricingService`, `OpeningBalanceService`, `UnitOfMeasureService`, `ProductCategoryService`, `BrandService`, `TaxRateService`.
- Repositories: Direct connection connection lookups with prepared SQL queries.

### C. IPC & Preload Expositions
- Custom IPC handlers registered safely under `electron/ipc/product.ipc.ts`.
- Expositions mapped via `electron/preload/preload.ts` inside `contextBridge`.

### D. UI Shell Integration
- Tab navigation routing integrated inside React `App.tsx`.
- Master configuration UI created under `src/components/products/masters/`.
