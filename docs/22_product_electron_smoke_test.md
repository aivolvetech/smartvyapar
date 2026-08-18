# Product Electron Smoke Test

Date: 2026-08-02

## Summary

Real packaged Electron functional smoke testing passed against the packaged app at:

`dist-package/win-unpacked/Smart Vyapar.exe`

The run used an isolated workspace-only Electron user-data directory:

`test-data/electron-product-smoke/user-data`

This avoids touching the real per-user Smart Vyapar data under `%APPDATA%`.

## Command

The automated smoke harness is:

`cmd /c node scripts\run-packaged-product-smoke.js`

It launches the packaged app with:

`SMART_VYAPAR_ELECTRON_SMOKE=true "dist-package/win-unpacked/Smart Vyapar.exe" --remote-debugging-port=9333 --disable-gpu`

## Evidence Files

- Results: `docs/evidence/product-electron-smoke/smoke-results.json`
- Packaged app log: `docs/evidence/product-electron-smoke/packaged-app.log`
- SQLCipher DB summary: `docs/evidence/product-electron-smoke/test-database-summary.json`
- Progress log: `docs/evidence/product-electron-smoke/smoke-progress.log`
- Screenshots: `docs/evidence/product-electron-smoke/*.png`

## Real Packaged App Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Application window opens | PASS | Captured `01-packaged-shop-setup.png`. |
| Products module opens | PASS | Product Master loaded in packaged renderer. |
| Supporting master records load from SQLCipher | PASS | Units count `8`, TaxRates count `8`. |
| Category and Brand create | PASS | Created through real preload IPC. |
| Product create succeeds | PASS | Product `PKG-PROD-001` created through real preload IPC. |
| Default ProductPrice persists | PASS | Selling price updated to `255`, MRP `260` after edit. |
| Opening balance persists for GOODS product | PASS | Quantity `12`, unit cost `210`. |
| Product appears in Product List | PASS | Captured `02-packaged-product-list.png`. |
| Product View displays saved data | PASS | Captured `04-packaged-product-view.png`. |
| Product update succeeds | PASS | Name persisted as `Packaged Smoke Product Edited`. |
| Duplicate Product Code rejected | PASS | Captured `06-duplicate-product-code-error.png`. |
| Duplicate Barcode rejected | PASS | Captured `07-duplicate-barcode-error.png`. |
| Product search by code works | PASS | Captured `08-product-search-result.png`. |
| Product search by barcode works | PASS | Verified through packaged IPC response. |
| Product activation/deactivation persists | PASS | Deactivate then reactivate returned persisted states. |
| Product persists after restart | PASS | Captured `10-product-after-restart.png`. |
| Renderer has no Node access | PASS | `window.require`, `window.process`, `window.ipcRenderer`, `window.fs`, and generic invoke APIs were unavailable. |
| No database key/path/encryption details exposed in renderer body | PASS | Renderer body leak regex returned false. |
| No fatal console/native module errors | PASS | No renderer console messages captured; packaged logs show SQLCipher and DPAPI loaded. |
| Native and packaging verification | PASS | Migration, SQLCipher native module, DPAPI native module present; query-engine count `0`. |

## Database Summary

Safe DB summary from the isolated encrypted SQLCipher database:

```json
{
  "shopCount": 1,
  "unitCount": 8,
  "taxRateCount": 8,
  "categoryCount": 1,
  "brandCount": 1,
  "productCount": 1,
  "product": {
    "productCode": "PKG-PROD-001",
    "name": "Packaged Smoke Product Edited",
    "isActive": true
  },
  "price": {
    "sellingPrice": 255,
    "mrp": 260,
    "isActive": 1
  },
  "barcode": {
    "barcode": "989898989801",
    "isPrimary": true,
    "isActive": true
  },
  "openingBalance": {
    "quantity": 12,
    "unitCost": 210
  }
}
```

## Fixes Made During Smoke Enablement

- Added `SMART_VYAPAR_ELECTRON_SMOKE=true` support in `electron/main/main.ts` to redirect packaged Electron `userData` to `test-data/electron-product-smoke/user-data`.
- Set the smoke window size to `1366x768` for stable packaged UI evidence.
- Added `scripts/run-packaged-product-smoke.js` for real packaged UI/preload/IPC smoke automation.
- Added `scripts/summarize-electron-smoke-db.js` to summarize the isolated SQLCipher DB under Electron's native-module ABI.
- Hardened smoke close/restart handling so packaged sessions close cleanly before persistence checks.

