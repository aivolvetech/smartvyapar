# Supplier Purchase UI Walkthrough

Supplier module:

- List/search suppliers
- Create supplier
- Edit supplier
- View supplier details and outstanding
- Activate/deactivate supplier

Purchase module:

- List/search purchases
- Create draft purchase
- Add product lines
- Preview calculated totals
- Save draft
- Post purchase
- View posted purchase
- Cancel posted purchase with reason

The purchase renderer calls purchase APIs only. It does not call inventory posting or supplier ledger APIs directly.
