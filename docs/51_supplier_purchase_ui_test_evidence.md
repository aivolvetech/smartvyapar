# 51. Supplier Purchase UI Test Evidence

Date: 2026-08-02

This document records the visual functional UI verification results performed under the packaged Windows application.

## 1. UI Checkpoints Summary

- **Supplier List Navigation**: [PASS] Supplier Directory loads, displays saved records, search query works.
- **Create Supplier Screen**: [PASS] Accessible, supports formatting validation, blocks invalid emails/phones/GST.
- **Required fields Validation**: [PASS] Displays inline error alerts when fields are omitted.
- **Duplicate Supplier Codes**: [PASS] Correctly blocked and displays main-process validation alerts.
- **Pagination**: [PASS] Seeding 6 suppliers dynamically splits lists across pages (5 per page).
- **Edit & View Supplier**: [PASS] Supplier details display opening balance entries, name updates persist.
- **Supplier deactivation select block**: [PASS] Deactivating a supplier blocks selecting them on the Purchase Form.
- **Purchase List Navigation**: [PASS] Displays invoices, status filters work.
- **Posted Purchase Immutability**: [PASS] Posted items display details but restrict edit and delete actions.
- **Reversal entries confirmation**: [PASS] Cancellations display confirmation prompts and update outstanding.

---

## 2. Visual Screenshots

- **Setup Shop**: ![Setup Shop](/docs/evidence/supplier-purchase-ui-calculation/01-setup-shop.png)
- **Supplier List**: ![Supplier List](/docs/evidence/supplier-purchase-ui-calculation/03-supplier-list.png)
- **Create Supplier Record**: ![Create Supplier](/docs/evidence/supplier-purchase-ui-calculation/04-create-supplier.png)
- **Required fields Validation**: ![Validation Errors](/docs/evidence/supplier-purchase-ui-calculation/05-validation-errors.png)
- **Format Validation**: ![Format Errors](/docs/evidence/supplier-purchase-ui-calculation/06-format-validation-errors.png)
- **Saved Supplier List**: ![Saved List](/docs/evidence/supplier-purchase-ui-calculation/07-saved-supplier-list.png)
- **Duplicate Supplier Codes**: ![Duplicate Error](/docs/evidence/supplier-purchase-ui-calculation/08-duplicate-code-error.png)
- **Supplier Details**: ![Supplier Details](/docs/evidence/supplier-purchase-ui-calculation/09-supplier-view.png)
- **Edit Supplier**: ![Edit Supplier](/docs/evidence/supplier-purchase-ui-calculation/10-edit-supplier.png)
- **Deactivated Supplier State**: ![Deactivated Supplier](/docs/evidence/supplier-purchase-ui-calculation/13-inactive-supplier-state.png)
- **Purchase List**: ![Purchase List](/docs/evidence/supplier-purchase-ui-calculation/14-purchase-list-final.png)
- **Purchase Invoice Editor**: ![Purchase Editor](/docs/evidence/supplier-purchase-ui-calculation/15-create-purchase-editor.png)
- **Posted Invoice details**: ![Posted Purchase](/docs/evidence/supplier-purchase-ui-calculation/16-posted-purchase-view.png)
- **Cancelled Invoice details**: ![Cancelled Purchase](/docs/evidence/supplier-purchase-ui-calculation/17-cancelled-purchase-view.png)
- **1366x768 Layout**: ![Full Layout](/docs/evidence/supplier-purchase-ui-calculation/18-full-window-1366x768-view)
