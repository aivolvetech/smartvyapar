# Product UI Visual Evidence

Date: 2026-08-02

Label: `Renderer UI verification using browser mock APIs`

This evidence verifies the React renderer using browser mock APIs loaded from the built renderer bundle. It does not prove real Electron IPC, SQLCipher, DPAPI, or native module behavior.

Real packaged Electron UI/preload/IPC evidence is captured separately under `docs/evidence/product-electron-smoke/` and documented in `docs/22_product_electron_smoke_test.md`.

## Result

| Check | Result | Evidence |
| --- | --- | --- |
| Product List renders | PASS | `docs/evidence/product-ui/01-product-list-1366x768.png` |
| Create Product form renders | PASS | `docs/evidence/product-ui/02-create-product.png` |
| Edit Product form renders | PASS | `docs/evidence/product-ui/03-edit-product.png` |
| Product View renders | PASS | `docs/evidence/product-ui/04-product-view.png` |
| Unit Manager renders | PASS | `docs/evidence/product-ui/05-unit-manager.png` |
| Category Manager renders | PASS | `docs/evidence/product-ui/06-category-manager.png` |
| Brand Manager renders | PASS | `docs/evidence/product-ui/07-brand-manager.png` |
| Tax Rate Manager renders | PASS | `docs/evidence/product-ui/08-tax-rate-manager.png` |
| Duplicate Product Code validation displays | PASS | `docs/evidence/product-ui/09-duplicate-product-code.png` |
| Duplicate Barcode validation displays | PASS | `docs/evidence/product-ui/10-duplicate-barcode.png` |
| 1366x768 full window usable | PASS | `docs/evidence/product-ui/01-product-list-1366x768.png` |
| No page-level horizontal scrolling observed in captured views | PASS | Screenshots above |
| Renderer console errors | PARTIAL | Only Electron CSP security warnings were captured in this file-mode evidence run; see `docs/evidence/product-ui/manifest.json`. |

## Evidence Files

Screenshots and capture manifest are saved under:

`docs/evidence/product-ui/`

The capture script is:

`scripts/capture-product-ui-evidence.js`
