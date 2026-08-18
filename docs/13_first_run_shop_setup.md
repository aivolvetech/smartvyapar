# First-Run Shop Setup

This document describes the workflow, field validation, and state machine behind the first-run installation setup screen.

---

## 1. Checkpoint Verification Matrix

| Checkpoint | Status | Details |
| :--- | :---: | :--- |
| **First-run check** | **PASS** | Bypasses dashboard and prompts profile creation when shop database table is empty. |
| **Name validation** | **PASS** | Submitting empty name blocks submit and renders validation error message. |
| **Phone validation** | **PASS** | Non-10 digit inputs trigger validation. |
| **GST validation** | **PASS** | Validates 15-character uppercase alpha-numeric format (optional field). |
| **Loading state** | **PASS** | Button renders spinner/text changes. |
| **Duplicate block** | **PASS** | Submit buttons disable instantly on submit. |

---

## 2. Form Field Specs & Constraints

| Form Field | HTML Identifier | Validation Rule | Error Message |
| :--- | :--- | :--- | :--- |
| **Shop Name** | `setup-name` | Required, non-empty text | "Shop name is required." |
| **Contact Phone** | `setup-phone` | Optional, must match `^[6-9]\d{9}$` | "Enter a valid 10-digit contact number." |
| **Shop Address** | `setup-address`| Optional, text area | N/A |
| **GSTIN** | `setup-gst` | Optional, must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` | "Enter a valid 15-character GSTIN format." |

---

## 3. Double-Submit & Validation Safety

*   **Submitting state indicator:** When submit button is clicked, state is set to `submitting = true`. Form inputs and submit buttons are disabled to prevent duplicate submissions or race conditions.
*   **Transition verification:** Main-process verification validates payload constraints inside `shop.ipc.ts`. Setup screen transitions only when the newly updated `Shop` row records are successfully returned from the raw database handle.
