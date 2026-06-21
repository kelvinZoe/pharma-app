# Pharma Flow Financial System Audit

Last updated: 2026-06-11

## Executive Summary

The current financial side of Pharma Flow is best described as **cash collection and operational reporting**, not a complete accounting system yet.

It has useful foundations:

- Clinic invoice creation.
- Full clinic payment collection.
- Pharmacy POS sales.
- Pharmacy register open/close sessions.
- Expense logging.
- Voiding clinic payments and pharmacy sales.
- Combined dashboard summaries and CSV export.

But it is missing several core accounting/finance workflows:

- Partial payments and receivables.
- Insurance/NHIS billing.
- Discounts, waivers, taxes, and adjustments.
- Refunds.
- Proper cash drawer reconciliation for clinic/frontdesk.
- Accounts payable/vendor payments.
- Supplier purchase invoices.
- Profit/margin reporting.
- Immutable audit-grade financial ledger.
- User/role restrictions for voids and expenses.
- Production-grade receipt numbering and sequence safety.

## Current Finance Architecture

### Clinic Billing

Main files:

- `backend/src/visits/visits.service.ts`
- `backend/src/billing/billing.service.ts`
- `backend/src/billing/billing.controller.ts`
- `frontend/src/app/features/frontdesk/pages/billing-desk-page.component.ts`

Current flow:

1. Frontdesk creates a visit with selected services.
2. Backend creates `VisitService` rows.
3. Backend creates a `ClinicInvoice` in `draft` status.
4. Departments mark services as `done` or `not_done`.
5. Billing desk retrieves invoice.
6. Billing desk collects a full payment only.
7. Backend creates `ClinicPayment`.
8. Backend marks invoice as `paid`.
9. Backend marks visit as `paid`.

Important limitation:

- The backend currently enforces **full payment only**.

### Pharmacy POS

Main files:

- `backend/src/pharmacy/pharmacy.service.ts`
- `backend/src/pharmacy/pharmacy.controller.ts`
- `frontend/src/app/features/pharmacy/pages/pharmacy-pos-sales-page.component.ts`

Current flow:

1. Pharmacy user opens a register session.
2. Pharmacy processes sales with cash or mobile money.
3. Backend deducts stock from selected batches.
4. Backend creates `PharmacySale` and `PharmacySaleItem`.
5. Sale is linked to active pharmacy closure/session.
6. Pharmacy user closes the session by entering counted cash and mobile money.

Important limitation:

- Pharmacy has register session closure, but clinic/frontdesk billing does not.

### Financial Dashboard

Main file:

- `frontend/src/app/features/admin/pages/admin-financials-page.component.ts`

Current tabs:

- Dashboard
- Clinic
- Pharmacy
- Closures
- Expenses
- Inventory
- Audit Logs

Backend sources:

- `backend/src/reports/reports.service.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/src/expenses/expenses.service.ts`

Current dashboard calculates:

- Clinic revenue.
- Pharmacy revenue.
- Combined revenue.
- Cash vs mobile money totals.
- Manual expenses.
- Inventory batch purchase cost.
- Net profit.
- Low stock and expiry alerts.

Important limitation:

- “Net profit” is a rough operational estimate, not accounting-grade profit.

## Concrete Bugs / Inconsistencies Found

### 1. Mobile Money Reference Preservation

Status: fixed in the clinic cashier reconciliation pass.

Frontend now sends:

```ts
referenceNumber: ref
```

Backend accepts both the new key and the old legacy key:

```ts
data.referenceNumber ?? data.transactionReference
```

Files:

- `frontend/src/app/features/frontdesk/pages/billing-desk-page.component.ts`
- `backend/src/billing/billing.service.ts`

Impact:

- Mobile Money transaction references are preserved for clinic payment reconciliation.

### 2. Clinic Has No Register / Cashier Closure

Pharmacy has `PharmacyDailyClosure`.

Clinic/frontdesk payments have no equivalent cashier session.

Impact:

- A frontdesk cashier can collect payments all day, but there is no structured end-of-day cash count.
- Accounting cannot compare expected clinic cash vs counted clinic cash.
- Mobile money reference reconciliation is weak.

Recommended feature:

- Add `ClinicCashSession` or generalized `CashSession`.
- Link `ClinicPayment` rows to the session.
- Support opening float, expected cash, expected MoMo, counted cash, counted MoMo, discrepancy, closure notes.

### 3. Full Payment Only

Backend rejects payments unless payment equals current balance.

File:

- `backend/src/billing/billing.service.ts`

Impact:

- No deposits.
- No partial payments.
- No outstanding receivables list.
- No patient balance tracking.

Recommended feature:

- Support partial payments.
- Invoice statuses should include `draft`, `unpaid`, `partially_paid`, `paid`, `voided`, maybe `refunded`.
- Add receivables report.

### 4. No Insurance / NHIS Claim Flow

Patient has `insuranceStatus`, but billing does not use it.

Impact:

- Insured and self-pay patients are financially treated the same.
- No insurance invoice, claim status, insurer balance, co-pay, approval code, or claim export.

Recommended feature:

- Add insurance plans/payers.
- Add invoice payer split: patient amount vs insurer amount.
- Track claim lifecycle: `pending`, `submitted`, `approved`, `rejected`, `paid`.

### 5. No Discounts, Waivers, or Adjustments

Invoice totals equal sum of billable services.

Impact:

- Cannot record approved discounts.
- Cannot separate charity/management waiver from payment.
- Cannot audit who approved reductions.

Recommended feature:

- Add `InvoiceAdjustment`.
- Fields: type, amount, reason, approvedByUserId, createdAt.

### 6. No Refund Workflow

The system supports voiding payments/sales, but not refunds.

Impact:

- A void is not the same as returning money.
- There is no way to record refunded amount, refund method, refund approval, or refund receipt.

Recommended feature:

- Add refund records for clinic and pharmacy.
- Require approval role.
- Reflect refunds in summary reports separately from voids.

### 7. Voids Need Stronger Authorization and Policy

Voids are available from financial dashboard endpoints.

Current backend only requires JWT, not a stricter finance/admin role check at the controller level.

Impact:

- A user with access to the route could potentially void transactions if frontend guards fail or API is called directly.

Recommended fix:

- Enforce role-based permission on void endpoints.
- Allow only admin/accounting, or require configured permission.
- Add stronger audit data: previous status, amount, reason, IP/user agent if available.

### 8. Expense Deletion Is Hard Delete

Expense deletion physically deletes the record.

File:

- `backend/src/expenses/expenses.service.ts`

Impact:

- Weak audit trail.
- Financial reports can change historically without trace.

Recommended fix:

- Use soft delete/cancel status.
- Add `status`, `voidReason`, `voidedByUserId`, `voidedAt`.

### 9. Expense Categories Are Too Small

Current categories:

- `rent`
- `utilities`
- `salaries`
- `inventory`
- `other`

Missing likely categories:

- Lab consumables
- Pharmacy purchases
- Repairs/maintenance
- Fuel/transport
- Internet/telecom
- Cleaning/sanitation
- Bank/MoMo charges
- Taxes/levies
- Professional fees
- Equipment
- Marketing

Recommended feature:

- Make categories configurable per tenant.

### 10. Inventory Purchases Are Treated as Expenses Immediately

Summary calculates inventory expense from batch purchase costs.

Impact:

- This is not proper accounting.
- Inventory purchases should become stock asset first.
- Cost should hit profit when items are sold, as COGS, not when purchased.

Recommended future accounting model:

- Track inventory asset value.
- Track cost of goods sold from sale item batch purchase cost.
- Gross profit = pharmacy revenue - pharmacy COGS.

### 11. Pharmacy Sale Movement Uses Selling Price as Unit Cost

When logging a stock movement for a sale, code stores:

```ts
unitCost: batch.sellingPrice
```

Impact:

- Stock movement cost is not actual cost.
- Margin/profit reporting will be wrong if based on stock movements.

Recommended fix:

- For sale movements, store purchase cost as `unitCost`.
- Sale item may need both `unitPrice` and `unitCost`.

### 12. Invoice and Sale Number Generation Is Race-Prone

Invoice/sale numbers are generated by finding the last number and adding 1.

Impact:

- Concurrent requests can generate duplicate numbers.
- This gets riskier in production with multiple users.

Recommended fix:

- Use a tenant-scoped sequence/counter table.
- Generate numbers transactionally.

### 13. Accounting Routes Reuse Admin Financials Page

Accounting module routes point to `AdminFinancialsPageComponent`.

Impact:

- Accounting role gets an admin-shaped financial interface.
- Tabs do not map cleanly to route intent.
- `/accounting/clinic-stream`, `/accounting/pharmacy-stream`, and `/accounting/reports` all load same default dashboard unless component reads route context.

Recommended fix:

- Create dedicated accounting pages or route-aware default tab selection.

### 14. Dedicated Billing Pages Are Placeholders

Files:

- `frontend/src/app/features/billing/pages/billing-invoices-page.component.ts`
- `frontend/src/app/features/billing/pages/billing-payments-page.component.ts`

Impact:

- Billing module exists structurally but is not implemented.
- Actual payment capture lives under frontdesk billing desk.

Recommended decision:

- Either remove placeholder billing module/routes or build a full cashier module.

## Missing Core Finance Features

### Cashier / Register Management

Needed:

- Open clinic cashier session.
- Close clinic cashier session.
- Expected cash/MoMo.
- Counted cash/MoMo.
- Discrepancy.
- Supervisor approval.
- Session report.

### Accounts Receivable

Needed:

- Outstanding invoice list.
- Partial payments.
- Patient balances.
- Aging report.
- Balance reminders.

### Insurance Claims

Needed:

- Insurer/payer records.
- Claim creation.
- Claim submission.
- Claim status.
- Rejection reason.
- Co-pay and insurer split.

### Refunds and Adjustments

Needed:

- Refund records.
- Discount records.
- Waiver records.
- Approval chain.
- Report separation between voids, refunds, and discounts.

### Supplier / Accounts Payable

Needed:

- Supplier records.
- Purchase invoices.
- Payables.
- Supplier payment tracking.
- Inventory purchase linkage.

### Profitability

Needed:

- Pharmacy gross margin by sale/product/date.
- COGS from purchase price.
- Clinic service profitability if costs are configured.
- True net profit calculation.

### Bank / MoMo Reconciliation

Needed:

- Payment provider references.
- Settlement batches.
- Bank/MoMo deposit matching.
- Unmatched transactions.
- Charges/fees.

### Audit and Compliance

Needed:

- Immutable financial ledger events.
- Soft void/cancel instead of hard deletes.
- Strong role checks for finance operations.
- Approval workflow for sensitive actions.

## Recommended Implementation Roadmap

### Phase 1 — Quick Integrity Fixes

1. Fix MoMo reference mismatch.
2. Enforce backend role checks for voids and expenses.
3. Soft-delete or void expenses instead of hard delete.
4. Make accounting routes open the correct default tab.
5. Remove or implement placeholder billing pages.

### Phase 2 — Cashier Reconciliation

1. Add clinic cashier session model.
2. Link `ClinicPayment` to cashier session.
3. Add open/close session endpoints.
4. Add clinic closure tab to financial dashboard.
5. Add discrepancy report.

### Phase 3 — Receivables and Adjustments

1. Support partial payments.
2. Add receivables page/report.
3. Add invoice adjustments.
4. Add discounts/waivers with approval.

### Phase 4 — Insurance

1. Add insurers/payers.
2. Add claim records.
3. Add claim status workflow.
4. Add claim export/reporting.

### Phase 5 — Accounting-Grade Ledger

1. Add `FinancialLedgerEntry`.
2. Record all money movements as immutable ledger rows.
3. Add COGS and inventory valuation.
4. Add profit/margin reports.

## Implemented Quick Fix

The MoMo reference mismatch has been fixed:

- Frontend sends `referenceNumber`.
- Backend accepts both `referenceNumber` and legacy `transactionReference`.
- This should be deployed before relying on MoMo reconciliation reports.
