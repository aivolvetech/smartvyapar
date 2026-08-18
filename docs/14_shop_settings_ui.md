# Shop Settings UI

This document outlines the workflow and UI actions for updating the Shop profile configurations from the Settings tab.

---

## 1. Checkpoint Verification Matrix

| Checkpoint | Status | Details |
| :--- | :---: | :--- |
| **Loads Persisted Shop Data** | **PASS** | Binds database columns directly into input fields on initialization. |
| **Shop Settings Update** | **PASS** | Triggers database upsert transaction. |
| **Success Toast Alert** | **PASS** | Renders bottom-right confirmation alert. |
| **Reload Persistence** | **PASS** | Reloading page preserves updated values. |

---

## 2. Shop Update Lifecycle

Settings updates utilize a non-optimistic UI synchronization flow to prevent displaying un-persisted parameters:

```text
User updates form fields
      ↓
Click "Save Profile Changes"
      ↓
Validate parameters in Renderer (Name, Phone, GSTIN checks)
      ↓
If invalid, show validation error below input
      ↓
Disable form inputs (submitting = true)
      ↓
Invoke window.smartVyapar.createShop(payload)
      ↓
Wait for secure IPC response from main process
      ↓
Main process updates SQLCipher Shop row and returns new record
      ↓
Renderer receives data, updates local state, shows success toast
      ↓
Enable inputs (submitting = false)
```

---

## 3. Toast Notification portal

Success or error states are logged to a notification portal positioned at the bottom right corner of the active page container:

*   **Success Alert:** Renders a green left-border strip with a check symbol (`toast-success`), informing the user that details are persisted.
*   **Error Alert:** Renders a red left-border strip with an cross symbol (`toast-error`), displaying the exact system message.
*   **A11y hooks:** Toast is dismissed automatically after 4 seconds, or instantly when the user hits the `Escape` key.
