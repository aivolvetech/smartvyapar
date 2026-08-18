# 49. Supplier Purchase Electron Smoke Test

Date: 2026-08-02

Real packaged Electron Supplier & Purchase foundation smoke test passed against:

`dist-package/win-unpacked/Smart Vyapar.exe`

Isolated user-data path:

`test-data/electron-purchase-smoke/user-data`

Command:

```powershell
node scripts\run-packaged-purchase-smoke.js
```

## Result

PASS, defects `[]`.

Verified Checkpoints:
- **Packaged App Launch & DB Bootstrap**: Initializes Shop profile and tables.
- **Supplier Master & Opening Balance**: Creates a supplier with a Rs 1,200 opening balance, updating outstanding.
- **Vite renderer build & Esbuild Electron build**: Correctly loads React frontend and Electron preload/main assets.
- **Authoritative Calculations**: Product line discounts and proportional invoice-level discount (Rs 150) allocate across lines correctly.
- **Tax State Split**: CGST/SGST total to Rs 90 each for intra-state (Maharashtra to Maharashtra) transaction.
- **Lifecycle Status transitions**: Posts draft and updates stock of tracked `GOODS` items (+10) while skipping `SERVICE` items.
- **Posted Immutability**:
  - Rejects draft update commands from the renderer on posted purchases.
  - Rejects draft delete commands from the renderer on posted purchases.
  - Verification performed at the preload/main-process level.
- **Rejection of Duplicate Actions**:
  - Rejects double posting.
  - Rejects double cancellation.
  - Rejects posting a cancelled purchase.
- **Restart Persistence**: Closing the app and launching again preserves stock (10) and outstanding (Rs 2,380) with no duplication of database seeds.
- **Cancellation & Reversals**: Reverses stock transaction (restores stock to 0) and reverses supplier ledger entries (restores outstanding to Rs 1,200).
- **Renderer Security**: No native modules (`require`, `process`, `ipcRenderer`, `fs`, `invoke`) are exposed to the main window context. No SQLCipher keys or DPAPI keys leak.
- **Prisma Decommissioning Check**: `query_engine_count` is confirmed to be exactly `0`.
- **SQLCipher & DPAPI Native Module packaging**: Loaded successfully from `app.asar.unpacked`.

## Evidence files

- Results log: `docs/evidence/supplier-purchase-foundation/purchase-smoke-results.json`
- DB summary: `docs/evidence/supplier-purchase-foundation/purchase-database-summary.json`
- App log: `docs/evidence/supplier-purchase-foundation/purchase-packaged-app.log`
- Progress log: `docs/evidence/supplier-purchase-foundation/purchase-smoke-progress.log`
- Setup screenshot: `docs/evidence/supplier-purchase-foundation/01-shop-setup.png`
- Purchase list screenshot: `docs/evidence/supplier-purchase-foundation/02-purchase-list.png`
