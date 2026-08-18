# 52. Purchase Calculation Test Evidence

Date: 2026-08-02

This report verifies that all 15 deterministic calculation test cases (A to O) match exactly across:
1. **Renderer Preview**: Front-end preview calculation.
2. **Main-Process Service**: Calculated during creation/posting transactions.
3. **SQLite Database**: Persisted values in the database.

All comparisons are verified using integer paise (precision = 100).

## 1. Expected vs Actual Calculation Matrix

| Case | Title | Status | Expected Target | Renderer & Service Results | Persisted DB Values |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Simple Intra-State GST | PASS | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 |
| **B** | Inter-State GST | PASS | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=180, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=180, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=180, Cess=0, Grand=1180 |
| **C** | Percentage Line Discount | PASS | Sub=1000, Taxable=900, CGST=81, SGST=81, IGST=0, Cess=0, Grand=1062 | Sub=1000, Taxable=900, CGST=81, SGST=81, IGST=0, Cess=0, Grand=1062 | Sub=1000, Taxable=900, CGST=81, SGST=81, IGST=0, Cess=0, Grand=1062 |
| **D** | Fixed Line Discount | PASS | Sub=1000, Taxable=850, CGST=51, SGST=51, IGST=0, Cess=0, Grand=952 | Sub=1000, Taxable=850, CGST=51, SGST=51, IGST=0, Cess=0, Grand=952 | Sub=1000, Taxable=850, CGST=51, SGST=51, IGST=0, Cess=0, Grand=952 |
| **E** | Multiple Lines | PASS | Sub=1500, Taxable=1500, CGST=102.5, SGST=102.5, IGST=0, Cess=0, Grand=1705 | Sub=1500, Taxable=1500, CGST=102.5, SGST=102.5, IGST=0, Cess=0, Grand=1705 | Sub=1500, Taxable=1500, CGST=102.5, SGST=102.5, IGST=0, Cess=0, Grand=1705 |
| **F** | Invoice-Level Percentage Discount | PASS | Sub=1250, Taxable=1125, CGST=101.25, SGST=101.25, IGST=0, Cess=0, Grand=1328 | Sub=1250, Taxable=1125, CGST=101.25, SGST=101.25, IGST=0, Cess=0, Grand=1328 | Sub=1250, Taxable=1125, CGST=101.25, SGST=101.25, IGST=0, Cess=0, Grand=1328 |
| **G** | Invoice-Level Fixed Discount | PASS | Sub=1250, Taxable=1100, CGST=99, SGST=99, IGST=0, Cess=0, Grand=1298 | Sub=1250, Taxable=1100, CGST=99, SGST=99, IGST=0, Cess=0, Grand=1298 | Sub=1250, Taxable=1100, CGST=99, SGST=99, IGST=0, Cess=0, Grand=1298 |
| **H** | EXEMPT | PASS | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 |
| **I** | ZERO_RATED | PASS | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 |
| **J** | NON_GST | PASS | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 | Sub=1000, Taxable=1000, CGST=0, SGST=0, IGST=0, Cess=0, Grand=1000 |
| **K** | Cess | PASS | Sub=1000, Taxable=1000, CGST=140, SGST=140, IGST=0, Cess=150, Grand=1430 | Sub=1000, Taxable=1000, CGST=140, SGST=140, IGST=0, Cess=150, Grand=1430 | Sub=1000, Taxable=1000, CGST=140, SGST=140, IGST=0, Cess=150, Grand=1430 |
| **L** | Round-Off (.50 Round Up) | PASS | Sub=100.42, Taxable=100.42, CGST=9.04, SGST=9.04, IGST=0, Cess=0, Grand=119 | Sub=100.42, Taxable=100.42, CGST=9.04, SGST=9.04, IGST=0, Cess=0, Grand=119 | Sub=100.42, Taxable=100.42, CGST=9.04, SGST=9.04, IGST=0, Cess=0, Grand=119 |
| **M** | Invalid Discount (>100% Rejection) | PASS | *Rejection Expected* | *Rejected (Success=false)* | *Absence in database confirmed* |
| **N** | Decimal Quantities | PASS | Sub=150, Taxable=150, CGST=13.5, SGST=13.5, IGST=0, Cess=0, Grand=177 | Sub=150, Taxable=150, CGST=13.5, SGST=13.5, IGST=0, Cess=0, Grand=177 | Sub=150, Taxable=150, CGST=13.5, SGST=13.5, IGST=0, Cess=0, Grand=177 |
| **O** | Service Product | PASS | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 | Sub=1000, Taxable=1000, CGST=90, SGST=90, IGST=0, Cess=0, Grand=1180 |


---

## 2. Calculation Auditing Confirmations

1. **Intra-state Tax splitting**: Verified CGST/SGST total Rs 90.00 each for Maharashtra SUP-A (Case A).
2. **Inter-state Tax splitting**: Verified IGST total Rs 180.00 for Gujarat SUP-B (Case B).
3. **Cess calculation**: Correctly aggregates Cess of Rs 150.00 on Case K, and verifies the tax snapshots independent of current rates.
4. **Invoice Discount allocation**: Correctly allocates discount proportionally before tax, handling last-line rounding corrections dynamically.
5. **Round-Off**: Mathematical rounding matches standard round-to-nearest integer convention.
