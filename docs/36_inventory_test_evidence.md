# 36. Inventory Test Evidence

Date: 2026-08-02

## Automated Tests

Inventory integration command:

```powershell
npx esbuild scripts/test-inventory-integration.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/test-inventory-integration.js
cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\test-inventory-integration.js"
```

Result: PASS.

Covered:

- Inventory migration applies.
- `InventoryTransaction`, `InventoryAdjustment`, and `InventoryAdjustmentLine` tables exist.
- Opening balance posts one `OPENING` ledger row.
- Restart does not duplicate opening entries.
- Adjustment-in/out work.
- Damage, expiry, and loss work.
- Negative stock is blocked when not allowed.
- Reversal restores stock.
- Double reversal rejected.
- Service product movement rejected.
- Barcode search in stock list works.
- Movement history pagination works.
- Dashboard summary derives from ledger.
- Foreign-key check passes.

Existing Product integration test was rerun after Phase 4 changes and passed.

## Build and Package

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npx electron-builder --win`: PASS
- Package query-engine count: `0`

## Evidence Directory

`docs/evidence/inventory-foundation/`

