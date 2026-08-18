# Bulk Import Foundation — Packaged Smoke Test

This document logs the successful execution of the packaged Electron UI smoke tests against the isolated production distribution installer.

## 1. Test Setup Configuration

- **Target Executable**: `dist-package/win-unpacked/Smart Vyapar.exe`
- **Isolated User-Data Directory**: `test-data/electron-import-smoke/user-data`
- **CDP Remote Debugging Port**: `9336`
- **Test Automation Harness**: `scripts/run-packaged-bulk-import-smoke.js`

---

## 2. Execution Log & Verification Steps

The automated test runner spawns the production packaged app and performs the following verification checklist:

### Step 1: Initial Setup Screen (Shop Profile Creation)
- **Action**: Launches application with clean isolated directory.
- **Verification**: Form loads with "Smart Vyapar Setup" header. Inputs filled:
  - Shop Name: `Maharashtra Import Warehouse`
  - Phone: `9111122222`
  - Address: `Import Hub, Pune, Maharashtra`
  - GSTIN: `27AAAAA1111A1Z1`
- **Submission**: Fires submits, initializes SQLCipher database and seeds master records. Redirects cleanly to Dashboard.

### Step 2: Dashboard Navigation
- **Action**: Verifies `Dashboard` title and shop details.
- **Verification**: Confirms SQLCipher Status indicates `Connected` and database key unlocked successfully.

### Step 3: Navigate to Bulk Data Import
- **Action**: Clicks `Data Import` menu button in sidebar.
- **Verification**: Confirms "Step 1: Select What You Want to Import" displays.
- **Entity Coverage**: Confirms the following 9 cards render with correct names:
  1. Units of Measure
  2. Tax Rates & GST Slabs
  3. Price Books
  4. Product Master
  5. Product Barcodes
  6. Product Prices
  7. Opening Stock
  8. Supplier Master
  9. Supplier Opening Balance

### Step 4: Step 2 Routing & Template Download
- **Action**: Clicks `Units of Measure` card.
- **Verification**: Confirms redirection to "Step 2: File Upload & Mapping" screen and displays "Download Sample UNIT Template" button.

---

## 3. Evidence Screenshots & Logs

The following artifacts were captured during the smoke test:

- **Dashboard & Sidebar Screenshot**: [import_dashboard.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/bulk-import-foundation/import_dashboard.png)
- **Step 2 Navigation Screenshot**: [import_step2_uom.png](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/bulk-import-foundation/import_step2_uom.png)
- **Isolated Renderer Console Log**: [import-smoke-console.log](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/bulk-import-foundation/import-smoke-console.log)
- **Packaged App System Log**: [import-packaged-app.log](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/bulk-import-foundation/import-packaged-app.log)
- **Verification Summary**: [import-smoke-results.json](file:///c:/Users/DELL7480/Desktop/Practice%20Project%2026/Mobile%20Smart%20Vyapar/docs/evidence/bulk-import-foundation/import-smoke-results.json)
