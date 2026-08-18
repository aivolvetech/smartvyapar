# Smart Vyapar

Smart Vyapar is a secure, offline-first Windows desktop application for shopkeepers.

## Technology Stack
*   **Renderer:** React 18, Vite, TypeScript, Vanilla CSS
*   **Main Process:** Electron 30, esbuild
*   **Database Engine:** SQLCipher (`better-sqlite3-multiple-ciphers` v11.10.0)
*   **Key Protection:** Windows Data Protection API (DPAPI) under `CurrentUser` scope
*   **Build Pipeline:** `electron-builder`

## Project Architecture
```text
React Renderer
      ↓
Secure Preload API (contextBridge)
      ↓
IPC Handlers (with trusted sender domain checks)
      ↓
Business Service Layer (ShopService, ProductService, PricingService, etc.)
      ↓
Repository Layer (ShopRepository, ProductRepository, ProductPriceRepository, etc.)
      ↓
better-sqlite3-multiple-ciphers
      ↓
SQLCipher Encrypted SQLite Database
```

## Isolated Database Paths
*   **Application Development:** `<userData>/data/smart-vyapar.db`
*   **Automated Integration Tests:** `test-data/primary-integration/smart-vyapar.db`
*   **Packaged Electron Smoke Tests:** `test-data/electron-product-smoke/user-data`, `test-data/electron-purchase-smoke/user-data`

## Running the Project
*   **Development:** `npm run dev`
*   **Run Primary Integration Tests:** `npx esbuild scripts/test-primary-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-primary-integration.js && cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-primary-integration.js"`
*   **Run Product Master Integration Tests:** `npx esbuild scripts/test-product-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-product-integration.js && cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-product-integration.js"`
*   **Run Inventory Foundation Integration Tests:** `npx esbuild scripts/test-inventory-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-inventory-integration.js && cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-inventory-integration.js"`
*   **Run Supplier & Purchase Integration Tests:** `npx esbuild scripts/test-supplier-purchase-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-supplier-purchase-integration.js && cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-supplier-purchase-integration.js"`
*   **Run Customer Foundation Integration Tests:** `npx esbuild scripts/test-customer-foundation-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-customer-foundation-integration.js && cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-customer-foundation-integration.js"`
*   **Run Customer UI Smoke Verification:** `node scripts/run-customer-ui-smoke.js`
*   **Run Packaged Purchase Smoke Tests:** `node scripts/run-packaged-purchase-smoke.js`
*   **Build & Package:** `npm run package` (produces installer executable and win-unpacked directory under `dist-package/`).

## Product Master Evidence

*   Completion audit: `docs/20_product_master_completion_audit.md`
*   Browser mock UI evidence: `docs/21_product_ui_visual_evidence.md`
*   Real packaged Electron smoke: `docs/22_product_electron_smoke_test.md`
*   Screenshot artifacts: `docs/evidence/product-ui/`
*   Packaged smoke artifacts: `docs/evidence/product-electron-smoke/`

## Inventory Foundation Evidence

*   Implementation plan: `docs/31_inventory_foundation_implementation_plan.md`
*   Database design: `docs/32_inventory_database_design.md`
*   Ledger design: `docs/33_inventory_ledger_and_stock_calculation.md`
*   Adjustment design: `docs/34_inventory_adjustment_design.md`
*   UI walkthrough: `docs/35_inventory_ui_walkthrough.md`
*   Test evidence: `docs/36_inventory_test_evidence.md`
*   Performance evidence: `docs/37_inventory_performance_evidence.md`
*   Packaged Electron smoke: `docs/38_inventory_electron_smoke_test.md`
*   Inventory artifacts: `docs/evidence/inventory-foundation/`

## Supplier and Purchase Foundation Evidence

*   Implementation plan: `docs/40_supplier_purchase_implementation_plan.md`
*   Supplier database design: `docs/41_supplier_database_design.md`
*   Purchase database design: `docs/42_purchase_database_design.md`
*   Tax and calculation design: `docs/43_purchase_tax_and_calculation_design.md`
*   Inventory integration: `docs/44_purchase_inventory_integration.md`
*   Supplier ledger design: `docs/45_supplier_ledger_design.md`
*   UI walkthrough: `docs/46_supplier_purchase_ui_walkthrough.md`
*   Test evidence: `docs/47_supplier_purchase_test_evidence.md`
*   Performance evidence: `docs/48_supplier_purchase_performance_evidence.md`
*   Packaged Electron smoke test: `docs/49_supplier_purchase_electron_smoke_test.md`
*   Completion audit: `docs/50_supplier_purchase_completion_audit.md`
*   Smoke test artifacts: `docs/evidence/supplier-purchase-foundation/`

## Phase 5 UI and Calculation Verification Evidence

*   UI Test Evidence: `docs/51_supplier_purchase_ui_test_evidence.md`
*   Purchase Calculation Test Evidence: `docs/52_purchase_calculation_test_evidence.md`
*   Phase 5 Final Verification Report: `docs/53_phase5_final_verification.md`
*   Visual UI & Calculation Artifacts: `docs/evidence/supplier-purchase-ui-calculation/`

## Phase 6.2 Customer Foundation Evidence

*   Implementation plan: `docs/64_phase6_customer_billing_implementation_plan.md`
*   Customer database design: `docs/65_customer_database_design.md`
*   Customer ledger design: `docs/66_customer_ledger_design.md`
*   Test evidence: `docs/77_phase6_customer_foundation_test_evidence.md`
*   UI smoke screenshots: `docs/evidence/phase6-customer-foundation/`

## Phase 6.3 Sales Database & Draft/Hold Backend Evidence

**Status**: PHASE 6.3 IMPLEMENTED & VERIFIED ✅

*   Sales invoice database design: `docs/67_sales_invoice_database_design.md`
*   Backend test evidence: `docs/78_phase6_sales_backend_test_evidence.md`
*   Intermediate package build report: `docs/79_phase6_3_intermediate_package_build.md`

### Phase 6.3 Key Facts
- `SalesInvoice`, `SalesInvoiceLine`, `SalesPayment` tables created via `20260805150000_sales_foundation` migration
- `invoiceNumber` is NULL in DRAFT and HELD states — official number generated only at Phase 6.5 posting
- `draftReference` is a temporary non-legal identifier (`DFT-000001` format), unique per shop
- All Draft totals are **provisional** — Phase 6.5 posting must recalculate from trusted database values
- Trusted product/unit/tax snapshots populated by main process from SQLCipher — never from renderer
- Zero SalesPayment rows created during the complete Phase 6.3 draft lifecycle
- Windows installer: `Smart Vyapar Setup 0.1.1.exe` (82.1 MB), `query_engine_count = 0`

