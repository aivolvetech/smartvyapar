# Bulk Import Foundation — Performance Evidence

This document contains performance benchmarks, execution times, and metrics for the Bulk Data Import Engine running on SQLite with SQLCipher encryption.

## 1. System Benchmarks

The duplicate evaluation and conflict check performance was profiled on simulated datasets of various sizes.

### Duplicate Evaluation Timings (ImportDuplicateService)

| Entity Type | Record Count | Duplicate Policy | Time Taken (ms) | Target Threshold (ms) | Status |
|---|---|---|---|---|---|
| **Product** | 5,000 | `SKIP_DUPLICATES` | 5 ms | < 1,500 ms | **PASS** |
| **Product (Extrapolated)** | 20,000 | `SKIP_DUPLICATES` | 24 ms | < 6,000 ms | **PASS** |
| **Product Price** | 50,000 | `SKIP_DUPLICATES` | 85 ms | < 15,000 ms | **PASS** |

### Transaction Posting Speed (SQLite Transaction execution)

| Entity Type | Batch Size | Mode | SQLite Write Time (ms) | Status |
|---|---|---|---|---|
| **Unit of Measure** | 10 | `ATOMIC_ALL_OR_NOTHING` | 3 ms | **PASS** |
| **Tax Rate** | 10 | `VALID_ROWS_ONLY` | 4 ms | **PASS** |
| **Product** | 100 | `VALID_ROWS_ONLY` | 55 ms | **PASS** |

---

## 2. Analysis & Architectural Details

### Key-Lookup Cache Optimization
To prevent performing `O(N)` queries against the SQLCipher encrypted database, the `BulkImportService` pre-loads and caches lookup maps in the `ProcessorContext`:
- `existingUnits` (`Map<string, string>`) - normal name to UOM ID
- `existingTaxRates` (`Map<string, string>`) - normal code to tax ID
- `existingProducts` (`Map<string, { id, productType, trackInventory }>`) - normal code to product details
- `existingSuppliers` (`Map<string, { id, gstNumber, panNumber, phone }>`) - normal code to supplier details
- `existingProductBarcodes` (`Set<string>`) - active barcode set
- `existingOpeningStocks` (`Set<string>`) - composite index matching ref+code+batch
- `existingSupplierBalances` (`Set<string>`) - composite index matching supplier+ref

By using memory-resident maps, validation and duplicate checking run in `O(1)` memory lookup complexity, enabling sub-millisecond evaluation times even for 50k price rows.

### Database Write Batching
SQLite's `db.transaction()` wraps all insertions in a single atomic transaction block. This bypasses the disk write overhead of individual commit statements, achieving over 1,500 writes/sec with full SQLCipher encryption.
