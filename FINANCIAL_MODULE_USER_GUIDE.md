# PharmaFlow Financial Module User Guide

**Last updated:** 19 August 2026

## Purpose

The financial workspace brings clinic receipts, pharmacy sales, cashier closures, operating expenses, supplier settlements, and stock exposure into one controlled review area. It is available to administrators and accounting users.

## Main Pages

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

Use **Accounting → Pharmacy Stream** to review POS sales by pharmacy location. Every sale shows its receipt number, customer, payment method, cashier, and total. An approved open-shift void returns stock to quarantine. Closed shifts are locked; the current release rejects direct voiding after closure, so management must retain the record and use its approved manual correction process until the planned formal reversal workflow is delivered.

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
npx prisma generate
```

The security patch normalizes payment references, rejects collisions, protects one active cashier/register/count per scope, and adds financial audit indexes. It stops with a clear error if conflicting production rows must be resolved first.

For a local SQLite development database, back up `backend/dev.db` and run `npx prisma db push` after updating the schema.
