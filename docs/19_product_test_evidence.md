# 19. Product Test Evidence

This document contains automated test execution outputs for the Product Master module. Results below are from the continuation validation run on 2026-08-02.

---

## 1. Test Environment

- **Node.js**: `v20.11.1`
- **Electron**: `30.0.9`
- **Node ABI**: `123`
- **SQLCipher Driver**: `better-sqlite3-multiple-ciphers` (v11.10.0)
- **Key Provider**: Windows DPAPI CurrentUser
- **Command**: `$env:ELECTRON_RUN_AS_NODE="1"; $env:SMART_VYAPAR_TEST="true"; .\node_modules\electron\dist\electron.exe dist-test\test-product-integration.js`
- **Exit Code**: `0`

---

## 2. Integration Test Output

```text
==================================================
SMART VYAPAR - PRODUCT MASTER INTEGRATION TESTS
==================================================

ABI/Node version info:
Node Version: v20.11.1
Electron Version: 30.0.9
Platform: win32

Initializing Database...
[INFO] Detected database state: ABSENT
[INFO] SQLCipher connection established and verified.
[INFO] Found 2 bundled migrations.
[INFO] Applying pending migration: 20260727094027_init
[INFO] Migration applied successfully: 20260727094027_init
[INFO] Applying pending migration: 20260802120000_product_master
[INFO] Migration applied successfully: 20260802120000_product_master
[INFO] Database initialization completed successfully.
[INFO] Database Driver: better-sqlite3-multiple-ciphers
[INFO] Database Encryption: SQLCipher enabled
[INFO] Prisma Runtime: disabled
[INFO] Database Path: ...\test-data\primary-integration\smart-vyapar.db
[INFO] Key Provider: Windows DPAPI CurrentUser
SUCCESS: initializeDatabase should return true
SUCCESS: UoM table should be seeded
SUCCESS: TaxRate table should be seeded
[INFO] SQLCipher database connection closed.
[INFO] Detected database state: VALID_ENCRYPTED
[INFO] SQLCipher connection established and verified.
[INFO] Found 2 bundled migrations.
[INFO] Migration already applied: 20260727094027_init
[INFO] Migration already applied: 20260802120000_product_master
[INFO] Database initialization completed successfully.
SUCCESS: Second initializeDatabase should succeed
SUCCESS: Seed data must remain idempotent (no duplicate seed rows)

Setting up Shop...
SUCCESS: Shop profile created
[INFO] PricingService: Assigned shop 67351e9d-a5fd-4d46-8dde-c53eee3ea155 to default PriceBook
SUCCESS: Default PriceBook should resolve
SUCCESS: Shop assigned to default PriceBook

Testing: Product Creation Transaction Rollback...
SUCCESS: Validation error detected
SUCCESS: Product count did not change
SUCCESS: Barcode row was rolled back

Testing: Barcode Rules & Uniqueness...
[INFO] PricingService: Created default price for product 562e0d8e-6c7d-4341-a6a5-0fc17c36828f
[INFO] ProductService: Created product 562e0d8e-6c7d-4341-a6a5-0fc17c36828f (PROD-A)
SUCCESS: Product A created
SUCCESS: Two barcodes created
SUCCESS: Exactly one primary barcode
SUCCESS: Duplicate barcode correctly rejected
[INFO] ProductService: Updated product 562e0d8e-6c7d-4341-a6a5-0fc17c36828f
SUCCESS: Primary barcode successfully swapped
SUCCESS: Previous primary barcode cleared

Testing: Product-Type Rules (GOODS vs SERVICE)...
SUCCESS: SERVICE opening balance correctly rejected
[INFO] PricingService: Created default price for product a9184859-23b4-429a-b5e3-4153eecf9aec
[INFO] ProductService: Created product a9184859-23b4-429a-b5e3-4153eecf9aec (SERV-1)
SUCCESS: Service created
SUCCESS: Service disables inventory tracking
SUCCESS: Service disables negative stock
SUCCESS: Goods without tracking opening balance correctly rejected
[INFO] PricingService: Created default price for product 3fd3b875-0d8e-43f1-86bb-a030172efe2e
[INFO] ProductService: Created product 3fd3b875-0d8e-43f1-86bb-a030172efe2e (GOODS-1)
SUCCESS: Goods created
SUCCESS: Opening balance record created successfully

Testing: PriceBook & ProductPrice Effective-Date Overlaps...
SUCCESS: Overlapping active price correctly rejected

Testing: Normalized Search & Pagination...
SUCCESS: Find by barcode successful
SUCCESS: Search by exact code matches
SUCCESS: Prefix search matches
[INFO] PricingService: Created default price for product 992d305b-a607-465d-8f97-0d98b675f22d
[INFO] ProductService: Created product 992d305b-a607-465d-8f97-0d98b675f22d (P-1)
[INFO] PricingService: Created default price for product 3395678f-246c-4f38-8eda-41f4da06bae3
[INFO] ProductService: Created product 3395678f-246c-4f38-8eda-41f4da06bae3 (P-2)
SUCCESS: Page size limit enforced
SUCCESS: Total item count resolved

ALL INTEGRATION TESTS PASSED!
```

## 3. Build and Package Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | PASS | `tsc --noEmit` and Electron TS project passed. |
| `npm run build` | PASS | Vite renderer and Electron bundles generated. Prisma Client generation is no longer part of the build. |
| `npx electron-builder --win` | PASS | `dist-package/win-unpacked` and `dist-package/SmartVyaparSetup-0.1.0.exe` generated. |
| `node scripts\run-packaged-product-smoke.js` | PASS | Real packaged Electron smoke passed with isolated user-data under `test-data/electron-product-smoke/user-data`. |

Package content checks:

- Product migration bundled: PASS
- SQLCipher native module bundled: PASS
- DPAPI native module bundled: PASS
- Renderer assets bundled: PASS
- Prisma query-engine files in package: PASS, count `0`

## 4. Coverage Notes

- Browser UI screenshots are documented separately in `docs/21_product_ui_visual_evidence.md`.
- Real packaged app smoke is documented separately in `docs/22_product_electron_smoke_test.md` and passed without touching the real per-user app data location.
- Packaged Electron smoke artifacts are under `docs/evidence/product-electron-smoke/`.
