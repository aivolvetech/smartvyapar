# 37. Inventory Performance Evidence

Date: 2026-08-02

Benchmark command:

```powershell
npx esbuild scripts/measure-inventory-performance.ts --bundle --platform=node --target=node20 --format=cjs --external:electron --external:better-sqlite3 --external:better-sqlite3-multiple-ciphers --external:@primno/dpapi --outfile=dist-test/measure-inventory-performance.js
cmd /c "set ELECTRON_RUN_AS_NODE=1&&set SMART_VYAPAR_TEST=true&&node_modules\electron\dist\electron.exe dist-test\measure-inventory-performance.js"
```

Dataset:

- Products: `20,000`
- Inventory transactions: `100,000`
- Seed time: `11252.42 ms`

Measured results are saved at:

`docs/evidence/inventory-foundation/inventory-performance.json`

| Query | Actual | Target | Result |
| --- | ---: | ---: | --- |
| Single Product stock lookup | `1.79 ms` | `<100 ms` | PASS |
| Paginated stock list | `1053.47 ms` | `<250 ms` | MISSED |
| Movement history page | `2.32 ms` | `<250 ms` | PASS |
| Dashboard summary | `839.97 ms` | `<300 ms` | MISSED |

## Notes

Phase 4 keeps `InventoryTransaction` authoritative and does not introduce an `InventoryBalance` projection. The stock list and dashboard misses are expected pressure points for a future rebuildable read-model/cache. The ledger design and tests remain correct.

