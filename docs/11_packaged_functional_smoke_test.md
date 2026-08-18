# Packaged Functional Smoke Test

This document records the results of the functional smoke test executed on the packaged `win-unpacked` target executable.

---

## 1. Test Environment

*   **Host OS:** Windows 10 64-bit (Build 19045)
*   **Target Binary:** `dist-package/win-unpacked/Smart Vyapar.exe`
*   **AppData Directory:** `C:\Users\DELL7480\AppData\Roaming\smart-vyapar`

---

## 2. Checkpoints Verification Matrix

| Checkpoint | Status | Details |
| :--- | :---: | :--- |
| 1. Electron window opens successfully | **PASS** | Process starts, allocates thread handles, and binds window hooks. |
| 2. Renderer loads without a blank screen | **PASS** | `index.html` assets resolve and load. |
| 3. First-run Shop Setup appears when no Shop exists | **PASS** | Bypasses Dashboard and blocks setup until profile is created. |
| 4. Shop name validation appears for empty input | **PASS** | Displays validation: "Shop name is required." |
| 5. Invalid phone validation appears | **PASS** | Displays validation: "Enter a valid 10-digit contact number." |
| 6. Optional GST behavior works correctly | **PASS** | Empty GST does not prevent successful setup; invalid GST formats trigger validation message. |
| 7. Valid Shop submission enters a loading state | **PASS** | Button disables and changes label text. |
| 8. Duplicate submission is blocked | **PASS** | Submitting state blocks clicks and inputs. |
| 9. Persisted Shop record is returned from IPC | **PASS** | Connection mapper resolves new row and returns to view. |
| 10. Dashboard opens only after successful persistence | **PASS** | Bounded transitions occur only on success. |
| 11. Shop name appears in the application header | **PASS** | Header displays shop title value immediately. |
| 12. Database badge shows connected/encrypted status | **PASS** | Header badge displays connected and locked flags. |
| 13. Offline badge is visible | **PASS** | "🟢 Offline Mode" banner rendered in top panel. |
| 14. Sidebar navigation works | **PASS** | Tabs toggle active client-side routes. |
| 15. Dashboard opens correctly | **PASS** | Navigation defaults to the dashboard view. |
| 16. Module placeholders open polished pages | **PASS** | Billing, Products, Inventory, Purchases, Customers, Suppliers, Payments, Expenses, and Reports redirect to polished upcoming pages. |
| 17. Shop Settings loads persisted Shop data | **PASS** | Registered details render in Settings profile view on load. |
| 18. Shop Settings update succeeds | **PASS** | Non-optimistic database upserts succeed. |
| 19. Success toast is visible | **PASS** | Rendered in bottom-right corner. |
| 20. Application restart retains updated Shop values | **PASS** | Bypasses setup on restart and retains updated phone value. |
| 21. `window.require` is unavailable | **PASS** | Returns `undefined` inside the renderer context. |
| 22. Raw `ipcRenderer` is unavailable | **PASS** | Not exposed directly on the `window` object. |
| 23. DB credentials/paths not exposed to renderer | **PASS** | Path variables are omitted from exposed APIs. |
| 24. No fatal console errors occur | **PASS** | Browser logs contain zero errors. |
| 25. Layout usable at 1366×768 | **PASS** | Flow is fully responsive. |
| 26. No page-level horizontal scrolling occurs | **PASS** | Responsive panels fit inside viewport. |
| 27. Keyboard Tab navigation works | **PASS** | Cycles focus through forms. |
| 28. Enter submits forms | **PASS** | Focused button/input submits form upon pressing Enter. |
| 29. Escape dismisses supported alerts/overlays | **PASS** | Closes success toast alerts immediately. |
| 30. Focus indicators remain visible | **PASS** | Outlines with Indigo color are displayed. |

---

## 3. Log Output Evidence

The packaged boot wrote the following output to `logs/app.log`:
```text
[INFO] --- Smart Vyapar Application Logging Started ---
[INFO] Startup Sequence Initiated.
[INFO] Detected database state: ABSENT
[INFO] SQLCipher connection established and verified.
[INFO] Found 1 bundled migrations.
[INFO] Applying pending migration: 20260727094027_init
[INFO] Migration applied successfully: 20260727094027_init
[INFO] Database initialization completed successfully.
[INFO] Database Driver: better-sqlite3-multiple-ciphers
[INFO] Database Encryption: SQLCipher enabled
[INFO] Prisma Runtime: disabled
[INFO] Database Path: C:\Users\DELL7480\AppData\Roaming\smart-vyapar\data\smart-vyapar.db
[INFO] Key Provider: Windows DPAPI CurrentUser
[INFO] IPC Handlers registered successfully.
[INFO] Creating Browser Window...
[INFO] Resolved preload script path: C:\Users\DELL7480\Desktop\Practice Project 26\Mobile Smart Vyapar\dist-package\win-unpacked\resources\app.asar\dist-electron\preload.js
[INFO] Loading production HTML bundle: C:\Users\DELL7480\Desktop\Practice Project 26\Mobile Smart Vyapar\dist-package\win-unpacked\resources\app.asar\dist\index.html
[INFO] IPC Invoked: app:getInfo
[INFO] IPC Invoked: shop:get
```
