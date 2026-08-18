# Phase 6: Invoice Print Design

This document describes the offline-first print architecture and templates for Smart Vyapar.

---

## 1. Printing Architecture

To prevent thread blockages and secure the main renderer process, Smart Vyapar utilizes a dedicated print window execution model.

### The Flow
1. **Trigger**: Renderer invokes the IPC channel `printSalesInvoice` or `previewSalesInvoice`, passing the raw SalesInvoice ID.
2. **Data Loading**: The main process loads the sales invoice details, customer details, and line item records from the database directly. 
    - *Security Rule*: The main process **never** accepts arbitrary HTML strings or pre-rendered template scripts from the renderer. It loads structured raw data from the DB to construct the print templates.
3. **Print Window**: Spawns a dedicated, hidden `BrowserWindow` (the Print Window) with:
   - Node integration disabled.
   - Context isolation enabled.
   - A minimalist, local HTML layout template loaded from bundled package resources.
4. **Transmission**: The main process passes the sanitised invoice dataset to the print window.
5. **Rendering**: The print window renders the HTML layout locally based on the selected format (A4 GST or 80mm thermal).
6. **Execution**:
   - For **Print**: Executes `webContents.print` with target printer parameters (silent print configuration enabled).
   - For **Preview**: Displays the rendered view in a dialog panel.
   - For **PDF**: Executes `webContents.printToPDF` and writes the resulting buffer atomic-safely to a file path requested by the user via a native Save Dialog.
7. **Destruction**: Close and destroy the print window once printing or PDF export completes.

---

## 2. Safety and Security Rules

- **No Remote Fonts**: Font files (e.g. Roboto, Inter, Courier) must be bundled locally inside Electron package resources. No remote CDN font loads allowed.
- **Watermarks**: Cancelled invoices must render a prominent diagonal semi-transparent red watermark reading **"CANCELLED"** on both print and PDF formats.
- **Escape Variables**: All fields typed by the user (notes, product names, customer names, addresses) must be fully HTML-escaped during template construction to prevent layout disruption or script execution.
