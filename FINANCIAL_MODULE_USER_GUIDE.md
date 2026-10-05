# PharmaFlow Financial Module User Guide

**Last updated:** 5 October 2026

## Purpose

The financial workspace brings clinic receipts, pharmacy sales, cashier closures, operating expenses, supplier settlements, and stock exposure into one controlled review area. It is available to administrators and accounting users.

## Main Pages

Backend financial access is enforced by named permissions, not just visible navigation. Administrators and accounting staff retain their financial review permissions; frontdesk can collect clinic payments and review their own cashier sessions without receiving unrestricted financial access. Permissions do not bypass tenant/branch boundaries or independent approval. See `ACCESS_CONTROL_GUIDE.md` for the full role summary.

### Financial Overview

Use **Accounting → Dashboard** or **Accounting → Reports** to review:

- Combined clinic and pharmacy collections.
- Pharmacy cost of goods sold and gross profit.
- Posted operating expenses.
- Estimated operating result.
- Cash and Mobile Money collection mix.
- Supplier cash payments and inventory purchases.
- Clinic and pharmacy closure exceptions.

Select a date range before reviewing or exporting a period. Select a pharmacy location when a location-specific pharmacy report is required.

### Clinic Stream

Use **Accounting → Clinic Stream** to trace each clinic payment to its patient, invoice, payment method, reference, cashier, and collection date. Voiding a receipt requires a reason and automatically reopens the invoice balance.

### Pharmacy Stream

Use **Accounting → Pharmacy Stream** to review POS sales by pharmacy location. Every sale shows its receipt number, customer, payment method, cashier, and total. An open-shift void returns stock to quarantine. For a closed shift, select **Request reversal** and obtain independent approval through the **Reversals** tab.

### Accounting Period Locks

1. Reconcile and close every cashier shift opened in or before the period you want to lock.
2. Open the financial workspace and select **Period locks → Lock completed period**.
3. Enter the start date, end date, and a closing note. The end date must be before today; overlapping locked ranges are rejected.
4. Confirm **Lock period**. This is permanent: historical receipts, sales, expenses, goods receipts, supplier payments, and supplier returns cannot be edited, deleted, or backdated into this range.

Period locks apply to the whole tenant and all pharmacy locations. The period-lock and reversal tabs show paginated tenant-wide history independently of the report date/location filters.

### Approved Reversals

1. Find the original entry in **Clinic**, **Pharmacy**, or **Expenses**.
2. Choose **Request reversal** and explain the correction. This reverses the full original amount; partial refunds are not supported in this release.
3. Another administrator or accounting user opens **Reversals** and reviews the reason and original entry. Neither the requester nor the original cashier/expense creator can approve it.
4. The reviewer selects **Review approval → Approve and post**, or **Reject** with a reason.

Approval records a separate correction dated today. The original receipt and closed-shift reconciliation remain intact. A clinic reversal reopens the invoice balance. For pharmacy reversals, confirm that all sold items have physically returned; approval returns them to their original batches in quarantine, where inspection is required before release. Reversals must not be used to create stock for medicines that were not returned.

This workflow records financial corrections; it does not send a cash, bank, or Mobile Money refund. Arrange the refund or reimbursement separately and retain supporting evidence. It does not add a payout to a current cashier shift. Supplier settlements require Supplier Payables corrections and cannot use operating-expense reversals.

Pending requests block another void or reversal of the same original entry. Rejected requests remain in the audit history and can be followed by a new request. Approved reversals cannot be edited or repeated. The **Reversals** tab and export show original dates, posting dates, reasons, actors, and amounts.

Reports retain original revenue and expense in the original period and apply the correction in the approval period. Therefore a day with more reversals than new collections can show negative net collections, and an expense reimbursement can show negative net operating spend. Revenue, COGS, payment-method totals, and operating results incorporate approved corrections.

### Cashier Reconciliation

Use **Pharmacy Shifts** and **Clinic Shifts** to compare:

- Opening float.
- Expected cash.
- Expected Mobile Money.
- Counted total.
- Difference or discrepancy.

A difference of more than GHS 0.01 is shown as an exception and should be investigated before management sign-off.

### Expense Register

Use **Expenses → Post expense** to capture the title, category, date, amount, payee, payment method, reference, cost centre, supporting-document URL, and notes.

Expenses are never permanently deleted. If an entry is wrong, use **Void**, provide a detailed reason, and retain the original record in the audit trail. Supplier-payment expenses can only be controlled from Supplier Payables.

### Supplier Payables

Use **Accounting → Supplier Payables** to review supplier invoices, record payments, post purchase returns, and print supplier statements. Supplier payments reduce the payable balance and are recorded as cash outflows.

### Stock Exposure

Use **Stock Exposure** to review low stock and near-expiry batches by pharmacy location. This view supports purchasing decisions but does not treat stock intake as an immediate profit expense.

## Recovering an Unconfirmed Payment

If the connection fails or a payment has no confirmed receipt, **do not collect the money again**. The payment may already have been recorded.

1. Return to the same browser tab, signed in as the original cashier/accounting user.
2. For pharmacy and supplier payments, select the original pharmacy location.
3. In **Billing Desk** or **POS Sales**, select **Recover receipt**. In **Supplier Payables**, select **Recover payment**.
4. The system resubmits the original request with its saved payment details. A committed payment returns its original confirmation rather than creating another payment. A request that never committed can finish once using those original details.
5. Verify the recovered receipt or supplier payment against the money already collected or paid.

Unconfirmed requests retain their original details across page reloads in the same tab. Changed details are blocked until the outcome is resolved. If the server confirms that a rejected payment was completely rolled back, the form can be corrected and submitted again.

Keep the tab open and do not clear browser storage while a payment is unconfirmed. Recovery information is scoped to the original user, tenant, and pharmacy location; it is not shared across tabs or devices. If the tab was closed or an older request is reported as uncertain, an administrator/accounting user must check the transaction register before another payment is taken. Recovery does not send money or charge a bank/Mobile Money account.

## Financial Definitions

- **Collections:** Money received from clinic and pharmacy customers.
- **Cost of Goods Sold (COGS):** Recorded unit cost multiplied by the quantity of medicines sold.
- **Pharmacy Gross Profit:** Pharmacy revenue minus pharmacy COGS.
- **Operating Expenses:** Posted non-supplier operating costs such as utilities, salaries, maintenance, and rent.
- **Estimated Operating Result:** Clinic collections plus pharmacy gross profit minus operating expenses. It excludes clinic direct costs, tax, depreciation, and other formal accounting adjustments.
- **Inventory Purchases:** Value of posted goods receipts less supplier purchase returns. This is a procurement measure, not COGS.
- **Supplier Payments:** Cash paid against supplier invoices. This is a cash-flow measure and must not be deducted again as an expense after inventory cost is recognized through COGS.

## Exporting and Printing

The **Export complete view** action retrieves records in bounded pages, up to 2,000 rows for the selected period. Interactive report ranges are limited to one year and default to 31 days. CSV values are quoted and spreadsheet-formula prefixes are neutralized. The **Print** action produces a clean print version of the active section.

## Required Database Patch

Apply the financial-control patch to production before deploying the updated backend:

```bash
cd backend
npx prisma db execute --file prisma/migrations/20260817120000_strengthen_financial_controls/migration.sql
npx prisma db execute --file prisma/migrations/20260819120000_security_financial_integrity/migration.sql
npx prisma db execute --file prisma/migrations/20261005120000_add_idempotency_records/migration.sql
npx prisma db execute --file prisma/migrations/20261005150000_accounting_period_locks_and_reversals/migration.sql
npx prisma generate
```

The security patch normalizes payment references, rejects collisions, protects one active cashier/register/count per scope, and adds financial audit indexes. It stops with a clear error if conflicting production rows must be resolved first.

Accounting period locks use PostgreSQL triggers and transaction locks. Use PostgreSQL for this release. Do not apply the historical SQLite migration chain using `prisma migrate deploy`.

For developers, `backend/test/accounting-postgres.e2e-spec.ts` tests these rules against a disposable localhost PostgreSQL database whose name ends in `_test`. Load the current Prisma schema into that isolated database first, then set `TEST_DATABASE_URL` and run `npm run test:e2e -- --runInBand accounting-postgres`. The test replaces only the accounting-control tables and inserts synthetic tenant fixtures. Never point it at an operational database.
