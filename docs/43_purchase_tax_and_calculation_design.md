# Purchase Tax and Calculation Design

The main process is authoritative for purchase calculations.

Line calculation:

- Base = quantity * unit price
- Line discount = percent or amount
- Taxable = base - line discount
- Tax = CGST/SGST for intra-state, IGST for inter-state
- Line total = taxable + tax + cess

Invoice-level discount is allocated proportionally across lines and rounded to two decimal places. Grand total is rounded to nearest rupee and `roundOff` stores the delta.

If shop/supplier state cannot be confidently compared, Phase 5 defaults to intra-state.
