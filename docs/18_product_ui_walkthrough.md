# 18. Product UI Walkthrough

> Continuation note, 2026-08-02: Renderer visual verification was captured using browser mock APIs. Screenshots and manifest are under `docs/evidence/product-ui/`; see `docs/21_product_ui_visual_evidence.md`.

This document guides you through the new Product UI screens added to Smart Vyapar.

---

## 1. Product Route State Machine

To prevent impossible UI layouts, the renderer state is mapped using a single route union type:

```ts
type ProductRoute =
  | { page: 'LIST' }
  | { page: 'CREATE' }
  | { page: 'EDIT'; productId: string }
  | { page: 'VIEW'; productId: string }
  | { page: 'MASTERS' };
```

---

## 2. Screens and Functions

### A. Product List (`ProductList.tsx`)
- Displays all products in a clean, scrollable tabular layout.
- Provides indexed search field matching code, sku, barcode, or name.
- Custom checkbox to toggle displaying inactive/deactivated products.
- Column headers (Code, Name, Price, MRP) support interactive sorting with directional indicators (↑, ↓).
- Actions column to View (👁), Edit (✏️), or Deactivate/Activate (⏸ / ▶).

### B. Product Form (`ProductForm.tsx`)
Separated into 7 clean sections:
1. **Basic Information**: Product Code, SKU, Name, Print Name, Description.
2. **Classification**: Unit dropdown, Category dropdown (indented sub-levels), Brand dropdown.
3. **Tax & HSN/SAC**: HSN numeric validation, GST slab selector.
4. **Pricing**: Selling price, MRP, Purchase price, and optional Wholesale price.
5. **Barcodes**: Interactive barcode builder tag list. Supports assigning a primary barcode (★).
6. **Stock Configuration**: GOODS vs SERVICE selector. GOODS supports custom inventory tracking bounds and opening stock details.
7. **Status**: Lifecycle status toggle (active/inactive).

### C. Product Detail View (`ProductView.tsx`)
- Structured read-only view of all fields.
- Highlights pricing, classification, tax rates, active barcodes, and stock levels.
- Displays timestamps (Created At, Updated At) and entity version counters.

### D. Masters Manager (`MastersHome.tsx`)
- Manages Units, Categories, Brands, and Tax Rates through separate files under `src/components/products/masters/`.
- Prevents deleting/deactivating configuration records referenced by active products.
