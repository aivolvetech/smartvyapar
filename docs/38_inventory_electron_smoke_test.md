# 38. Inventory Electron Smoke Test

Date: 2026-08-02

Real packaged Electron inventory smoke passed against:

`dist-package/win-unpacked/Smart Vyapar.exe`

Isolated user-data path:

`test-data/electron-inventory-smoke/user-data`

Command:

```powershell
node scripts\run-packaged-inventory-smoke.js
```

## Result

PASS, defects `[]`.

Verified:

- Packaged app launches.
- Shop setup works.
- Existing Product Master creates inventory product.
- Opening balance posts to ledger.
- Current stock displays correctly.
- Adjustment-in works.
- Adjustment-out works.
- Damage works.
- Expiry works.
- Loss works.
- Negative stock blocked where configured.
- Product Stock View displays stock.
- Movement history displays.
- Dashboard low-stock count displays.
- App closes and restarts.
- Stock and movements persist after restart.
- Renderer security boundaries pass.
- Native modules load.
- Prisma query-engine count remains `0`.

## Evidence

- Results: `docs/evidence/inventory-foundation/inventory-smoke-results.json`
- DB summary: `docs/evidence/inventory-foundation/inventory-database-summary.json`
- App log: `docs/evidence/inventory-foundation/inventory-packaged-app.log`
- Progress log: `docs/evidence/inventory-foundation/inventory-smoke-progress.log`
- Screenshots: `docs/evidence/inventory-foundation/*.png`

