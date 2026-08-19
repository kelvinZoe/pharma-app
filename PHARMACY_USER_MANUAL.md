# PharmaFlow Pharmacy User Manual

**Version:** 1.4  
**Last updated:** 19 August 2026  
**Audience:** Pharmacy staff, pharmacy managers, administrators, and accounting staff

## 1. Purpose of the Pharmacy Module

The PharmaFlow Pharmacy module manages the day-to-day work of one or more pharmacy shops under the same organisation. It supports:

- Multiple pharmacy locations.
- A shared clinical medicine library and packaged product catalogue.
- Location-specific stock and batches.
- Supplier records and purchase history.
- Purchase-order preparation and approval.
- Supplier stock receiving.
- Walk-in and clinic-referred medicine sales.
- Cash and Mobile Money payment recording.
- End-of-shift register reconciliation.

Stock, purchase orders, receipts, and sales are always handled for the **active pharmacy location** shown at the top of the screen.

---

## 2. User Roles

| Role | Main responsibilities |
|---|---|
| **Administrator** | Create pharmacy locations, assign staff, manage catalogue, prices, suppliers and stock policies, approve purchase orders and controlled stock changes, and review operations. |
| **Pharmacy user** | Prepare purchase orders, receive approved deliveries, request counts/adjustments/transfers, sell medicines, and close their register. |
| **Accounting user** | Review supplier liabilities, post independently approved supplier payments/returns, review sales and closures, and investigate exceptions. |

Some buttons may not appear if your account does not have permission to perform the action.

---

## 3. Before You Start

1. Sign in to PharmaFlow.
2. Select **Pharmacy** from the **Active Workspace** menu.
3. Confirm the correct shop under **Active Pharmacy** on the top bar.
4. If you work at more than one shop, change the active location before entering stock or making a sale.

> **Important:** Always check the active pharmacy before receiving stock, viewing balances, preparing an order, or selling medicine. A transaction posted to the wrong shop affects that shop's stock and financial records.

---

## 4. Recommended Setup Order

For a new pharmacy, complete setup in this order:

1. Create pharmacy locations.
2. Assign pharmacy staff to their locations.
3. Define medicines in the Medicine Library.
4. Create their saleable packages in Product Catalogue.
5. Register suppliers.
6. Create and approve purchase orders, when required.
7. Receive supplier stock.
8. Confirm stock balances and expiry dates.
9. Open the POS register and begin sales.

---

## 5. Pharmacy Locations

Open **Pharmacy → Locations**.

### Add a location

Only an administrator can create a pharmacy location.

1. Select **Add location**.
2. Enter the location code, name, address, phone number, and licence number.
3. Select **Create location**.

Use a short, recognisable code such as `MAIN`, `EAST`, or `KSI`. The code may appear in operational records.

### Assign staff to a location

1. Find the location card.
2. Select an available pharmacy staff member.
3. Select **Assign**.

Assigned staff can access that location's pharmacy records.

### Switch shops

Use either:

- **Work from this shop** on the Locations page; or
- The **Active Pharmacy** selector on the top bar.

After switching, verify that the new location name appears on the top bar.

---

## 6. Medicine Library and Product Catalogue

PharmaFlow separates a medicine's clinical identity from the commercial packages that the pharmacy buys and sells.

### A. Define the medicine

Open **Pharmacy → Medicine Library**.

1. Select **Add medicine definition**.
2. Enter the generic name and dosage form.
3. Build the strength using the structured value and unit fields. For liquids, also enter the quantity and dosage unit, for example `120 mg per 5 mL`.
4. Select the supply category: OTC, Pharmacy Medicine, or Prescription Only.
5. Add the administration route, therapeutic class, and optional notes.
6. Select **Create definition**.

Create one definition for each distinct generic medicine, strength, and dosage form. Do not create separate definitions for brands or package sizes.

### B. Create a packaged product

Open **Pharmacy → Product Catalogue**.

1. Select **Add packaged product**.
2. Select the medicine definition.
3. Add the brand, manufacturer, and barcode where available.
4. Define the package:
   - Package type, such as box, bottle, pack, or tube.
   - Number of units in the package.
   - Package content unit and selling unit.
   - Package size for liquids or creams where useful.
   - Whether loose units may be sold.
   - Minimum sale quantity.
5. Configure the active shop:
   - Reorder level.
   - Shelf or bin.
   - Current selling price.
   - Whether the product is available for sale at this shop.
6. Set controlled-medicine, tax, lifecycle, storage, and note fields.
7. Select **Create product**.

The display name and product code are generated automatically. Create separate products when the brand, manufacturer, barcode, package, or sale unit differs.

### Edit or review a product

1. Search for the packaged product.
2. Select **Edit** to update package or active-shop controls.
3. Select the product row to view:

- Available and expired stock.
- Active batch count.
- Nearest expiry.
- Stock value.
- Classification and storage information.
- Stock by batch.
- Recent stock movements.

### Lifecycle statuses

| Status | Meaning |
|---|---|
| **Active** | Available for normal pharmacy operations. |
| **Archived** | Retained for historical records but no longer used normally. |
| **Discontinued** | Product is no longer supplied or sold. |

Inactive products and products not marked **Available for sale** do not appear at POS.

---

## 7. Suppliers

Open **Pharmacy → Suppliers**.

### Register a supplier

1. Select **Add supplier**.
2. Enter the supplier's registered name.
3. Add the supplier code, tax ID, contact person, phone, email, and address where available.
4. Enter the agreed payment terms in days.
5. Keep **Supplier is active** selected.
6. Add delivery or ordering notes if needed.
7. Select **Register supplier**.

Only active suppliers can be selected for new purchase orders and stock receipts.

### Review a supplier

Select a supplier row to view:

- Contact and commercial details.
- Number and value of recorded deliveries.
- Recent goods receipts.
- Medicines previously supplied.

### Archive a supplier

Archive a supplier only when the business should no longer place new orders with them. Historical receipts remain available.

The supplier profile shows current outstanding payables, supplier credits, payments, and purchase-return values.

---

## 8. Purchase Orders

Open **Pharmacy → Purchase Orders**.

Use a purchase order to document planned supplier purchases before stock arrives.

### Purchase-order workflow

| Status | Meaning | Available action |
|---|---|---|
| **Draft** | The order is being prepared. | Edit, submit, or cancel. |
| **Submitted** | The order is awaiting administrator approval. | Approve or cancel. |
| **Approved** | The supplier order is authorised for receiving. | Receive stock or cancel before receiving begins. |
| **Partially received** | Part of the order has arrived. | Receive the remaining quantities. |
| **Received** | All ordered quantities have been received. | View or print. |
| **Cancelled** | The order is closed without further processing. | View only. |

### Create a purchase order

1. Confirm the correct active pharmacy location.
2. Select **Create purchase order**.
3. Select the supplier.
4. Enter the order date and expected delivery date.
5. Add notes or delivery instructions where needed.
6. For each medicine line, enter:
   - Medicine.
   - Purchase unit.
   - Number of packs.
   - Units per pack.
   - Expected cost per pack.
   - Discount and tax, if applicable.
7. Review the calculated units and order total.
8. Select **Save draft**.

### Submit and approve an order

1. Open the draft order.
2. Check the supplier, quantities, costs, discount, tax, and delivery date.
3. Select **Submit for approval**.
4. An administrator opens the submitted order and selects **Approve order**.

Only an administrator can approve a submitted purchase order.

### Print an order

1. Open the order.
2. Select **Print**.
3. Allow browser pop-ups if the print window does not appear.

### Receive an approved order

1. Open an order with **Approved** or **Partially received** status.
2. Select **Receive outstanding stock**.
3. PharmaFlow opens the Receive Stock page and loads the supplier and outstanding order lines.

The system prevents receiving more than the outstanding order quantity.

---

## 9. Receive Stock

Open **Pharmacy → Receive Stock**.

Each posted medicine line creates a traceable batch and adds stock to the active location.

The selected product supplies the purchase package, units-per-package conversion, and current shop selling price automatically. Receiving staff enter the delivered package count, supplier batch, expiry date, and acquisition cost; they do not redefine packaging or retail price during receipt.

### Receive against a purchase order

1. Select an approved purchase order.
2. Confirm that the supplier is correct.
3. Enter the supplier invoice number and date received.
4. Review the outstanding medicine lines.
5. Remove any line that did not arrive if this is a partial delivery.
6. For each received line, enter:
   - Batch number.
   - Expiry date.
   - Purchase unit.
   - Number of packs received.
   - Units per pack.
   - Cost per pack.
   - The displayed current shop selling price is read-only.
7. Check the calculated stock quantity, unit cost, and line value.
8. Select **Post stock receipt**.

The order becomes **Partially received** if quantities remain outstanding and **Received** when all quantities have been posted.

### Record a direct receipt

Only an administrator may use a direct receipt when there is no approved purchase order. This is an exception workflow, not the normal receiving process.

1. Leave **Purchase order** set to **Administrator direct receipt override**.
2. Search for and select an active supplier.
3. Enter the delivery details.
4. Add one line for each medicine batch received.
5. Enter a specific reason explaining why no approved order exists.
6. Select **Post stock receipt**.

### Pack conversion example

If the supplier delivers 4 boxes and each box contains 24 tablets:

- Number of packs: `4`
- Units per pack: `24`
- Stock added: `96 tablets`

Enter the supplier's **cost per pack**. The current retail price is maintained separately in the Product Catalogue and is not changed by receiving. Purchase costs remain batch-specific for valuation and margin reporting.

### Receiving controls

- Expired stock cannot be received.
- Every line requires a batch number and expiry date.
- Every batch is assigned to the active location.
- Stock and its stock-movement record are posted together.
- Purchase-order receiving cannot exceed the approved outstanding quantity.
- Pharmacy users must receive against an approved purchase order.
- A direct receipt is administrator-only and requires an audit reason.
- Duplicate supplier invoice numbers are rejected for the same supplier.

> **Important:** A posted goods receipt changes stock. Review all quantities, prices, batches, and expiry dates before posting.

---

## 10. Supplier Payables and Returns

Open **Pharmacy → Supplier Payables**. Accounting users can open the same workspace from **Accounting → Supplier Payables**.

Every posted goods receipt creates a supplier invoice record using the receipt value. If no due date is entered during receiving, PharmaFlow calculates it from the supplier's payment terms.

### Review supplier invoices

1. Confirm the active pharmacy location.
2. Use the invoice status filters to view unpaid, partly paid, overdue, paid, or credit-due invoices.
3. Search by supplier, supplier invoice number, internal invoice number, or goods receipt number.
4. Select an invoice row to review its original receipt, payment history, return credits, and balance.

### Update invoice details

Administrators and accounting users can update the supplier invoice number, invoice date, due date, and notes. The invoice value remains tied to the posted goods receipt.

### Record a supplier payment

1. Open an invoice with a positive balance.
2. Select **Record payment**.
3. Enter the amount, date, method, and payment reference.
4. Add remittance or approval notes where required.
5. Select **Record payment**.

Non-cash payments require a reference number. Payments cannot exceed the outstanding invoice balance. Each successful supplier payment creates a linked inventory expense in the financial module.

The user who recorded the supplier invoice cannot post its payment. A second administrator or accounting user must complete the payment approval.

### Return stock to a supplier

1. Open the invoice linked to the original goods receipt.
2. Select **Return stock**.
3. Select the return reason and date.
4. Enter the quantity physically returned for each original batch.
5. Add the supplier credit-note or return-authorisation details in the notes.
6. Review the calculated supplier credit.
7. Select **Post supplier return**.

The system prevents returns above the original unreturned quantity or the current batch stock. A posted return deducts stock, creates a stock movement, and credits the linked supplier invoice.

The user who posted the original goods receipt cannot post its supplier return. A separate administrator or accounting user must review and post the return.

### Print a supplier statement

1. Select a supplier in the statement selector.
2. Select **Supplier statement**.
3. Optionally enter a date range.
4. Review invoices, payments, returns, and the running balance.
5. Select **Print**.

When a start date is selected, the statement includes the opening balance before that date.

---

## 11. Stock Overview

Open **Pharmacy → Stock Overview**.

This screen shows the stock position for the active pharmacy location.

### Table fields

| Field | Meaning |
|---|---|
| **Medicine** | Catalogue name and identifying code or generic information. |
| **Shelf / Bin** | Where the medicine is stored at the selected shop. **Not assigned** means no shelf location has been entered. |
| **On hand** | Total quantity currently recorded for the medicine at this location. |
| **Reorder at** | The quantity at or below which the medicine is considered low stock. |
| **Active batches** | Number of batches that still have stock available. |
| **Nearest expiry** | Earliest expiry date among batches with stock. |
| **Status** | Healthy, Low stock, or Out of stock. |
| **Details** | Opens the location's batch ledger for the medicine. |

### Filter stock

Use the summary counters or filters to find:

- Healthy stock.
- Low stock.
- Out-of-stock medicines.
- Batches expiring within 30 or 90 days.
- Expired batches.

The search box accepts medicine names, generic names, product codes, and batch numbers.

### Review batches

Select **View batches** to inspect:

- Batch number.
- Quantity remaining and originally received.
- Unit cost.
- Selling price.
- Expiry date.
- Expiry condition.

Use **Receive stock** from the expanded batch area when a new delivery must be recorded.

### Recommended stock practice

- Investigate every low-stock item before it reaches zero.
- Sell the earliest-expiring safe batch first.
- Do not sell expired stock.
- Assign clear shelf or bin references to reduce picking errors.
- Compare physical stock with the system regularly.

---

## 12. Stock Control

Open **Pharmacy → Stock Control** to review movement history, count physical stock, and request controlled corrections for the active pharmacy location.

### Review the stock ledger

The **Stock ledger** tab shows every posted stock movement with:

- Medicine and batch.
- Movement type and date.
- Quantity before, quantity changed, and quantity after.
- Unit cost, source reference, reason, and responsible user.

Use the movement filter and search box to trace a receipt, sale, supplier return, void restock, count variance, or approved adjustment. Ledger entries cannot be edited; any correction must be posted as a new approved movement.

### Start a physical stock count

1. Select the **Physical counts** tab.
2. Select **Start stock count**.
3. Choose **Full location count** to count every batch, or **Cycle count** to select specific batches.
4. Add a note describing the count scope or reason.
5. Select **Start count**.
6. Open the count sheet and enter the physical quantity for each batch.
7. Add line notes for damaged packs, misplaced stock, or other findings.
8. Select **Save progress** to continue later, or **Save & submit** when complete.

The system snapshots expected quantities when the count starts and calculates unit and cost variances. If stock changes before approval, the count cannot post until the difference is reviewed through a fresh count.

### Approve a stock count

Administrators review submitted count sheets and select **Approve and post variances**. The person who created the count cannot approve it. Approval is atomic, creates stock adjustments and ledger movements, and does not overwrite movement history.

### Request a stock adjustment

1. Select the **Adjustments** tab.
2. Select **Request adjustment**.
3. Choose the medicine batch.
4. Choose **Damaged stock**, **Lost stock**, **Expired write-off**, **Correction out**, or **Correction in**.
5. Enter the quantity and a specific reason.
6. Add supporting notes where necessary.
7. Select **Send for approval**.

Administrators can approve or reject pending requests, but the requester cannot review their own adjustment. Stock changes only after one atomic approval. An expired write-off can only be posted against a batch whose expiry date has passed.

> **Control rule:** Never use a goods receipt to hide a stock shortage or correction. Use a physical count or approved adjustment so the audit trail remains accurate.

---

## 13. Network Stock and Replenishment

Open **Pharmacy → Network Stock** to compare stock positions across all pharmacy shops you are allowed to access.

### Understand the location comparison

- **On hand** is the full physical batch quantity recorded at the shop, including reserved, quarantined, or expired units.
- **Available** is unexpired stock that is not reserved or quarantined and can safely be sold or transferred.
- **Reserved** is stock committed to approved outgoing transfers.
- **Quarantine** is physically present stock blocked from sale pending review.
- **Expired** is stock past its expiry date and excluded from availability.
- **Transit in** is dispatched stock not yet received at the destination.
- **Daily use** is the average quantity sold per day over the recent 30-day period.
- **Days cover** estimates how many days current available stock can support.
- **Target** combines demand, supplier lead time, safety stock, and configured maximum stock.
- **Position** shows a shortage, transferable excess, or balanced stock level.

### Configure a location stock policy

Administrators can select **Edit** in the Policy column and set:

1. **Reorder level** — the minimum trigger for replenishment.
2. **Safety stock** — protected buffer stock that should remain at the location.
3. **Maximum stock** — optional upper target; leave blank to calculate it from demand.
4. **Supplier lead time** — expected days between ordering and delivery.
5. **Target cover** — desired number of selling days after replenishment.

Set policies per medicine and location. A busy shop and a smaller shop should not automatically use the same thresholds.

### Use replenishment recommendations

The **Replenishment** tab recommends a donor shop only when it has safe transferable excess and another shop has a calculated shortage. Suggested batches follow FEFO. Near-expiry stock is suggested only when projected destination demand can consume it before expiry.

1. Review the source, destination, shortage, donor excess, daily use, and suggested batches.
2. If the donor is not the active shop, select **Switch to** the donor shop.
3. Select **Create transfer request**.
4. Review and submit the generated request in **Stock Transfers**.

Recommendations never move stock automatically. The normal transfer approval, dispatch, and receipt controls still apply.

### Resolve quarantined stock

The **Quarantine** tab lists stock blocked during transfer receipt. Administrators must inspect it and choose:

- **Release** — returns the inspected quantity to available stock.
- **Write off** — permanently removes unusable stock and records a stock movement.

Do not release damaged, recalled, mismatched, or temperature-affected stock until the responsible manager has confirmed it is safe.

---

## 14. Stock Transfers

Open **Pharmacy → Stock Transfers** to move stock between pharmacy locations under the same organisation.

### Create and submit a transfer request

1. Switch to the pharmacy shop that will send the stock.
2. Select **New transfer request**.
3. Choose a different destination shop.
4. Enter the operational reason for the transfer.
5. Select the exact medicine batch and enter the requested quantity.
6. Add more batch lines when needed.
7. Select **Save draft**.
8. Review the draft and select **Submit for approval**.

Expired batches and quantities above available stock cannot be requested. The same batch can appear only once in a transfer.

The system expects FEFO batch selection. Only an administrator can override the recommended FEFO allocation, and a specific override reason is required.

### Approve and reserve stock

Administrators open a requested transfer, review each line, adjust approved quantities where necessary, and select **Approve & reserve**.

The transfer requester cannot approve or reject the same request. Only an administrator can cancel a transfer after it has been approved.

Approved quantities become reserved at the source shop. Reserved units remain physically on hand but cannot be sold, returned to a supplier, written off, or allocated to another approved transfer. Cancelling an approved transfer releases the reservation.

### Dispatch the transfer

At the source shop:

1. Open an approved transfer.
2. Confirm the exact batches and quantities being packed.
3. Enter transporter name, phone, vehicle or dispatch reference, and notes where available.
4. Select **Dispatch stock**.

Dispatch deducts the stock from the source shop, releases its reservation, creates a **transfer out** ledger movement, and marks the quantity as in transit. It does not create revenue or an expense.

### Receive at the destination

1. Switch the active pharmacy location to the destination shop.
2. Open the dispatched transfer.
3. Inspect batch number, expiry, packaging, condition, and quantity.
4. Enter the physically received quantity for every line.
5. Enter any quantity that must be quarantined and select its condition.
6. Explain shortages, damage, rejected quantities, or other differences.
7. Add receipt notes and select **Confirm receipt**.

Received quantities enter destination stock and create **transfer in** ledger movements. Quarantined quantities remain physically on hand but cannot be sold or transferred until released. The system preserves batch identity and calculates a weighted acquisition cost when the same batch already exists at the destination.

Use **Print request**, **Dispatch note**, or **Receipt** on the transfer detail to produce the appropriate handover document and signatures.

### Resolve a discrepancy

Transfers received with rejected or missing quantities move to **Discrepancy review**. An administrator must document one of these outcomes:

- **Return to source stock** — restores the unresolved quantity to its original source batch.
- **Write off discrepancy** — closes the transfer without restoring the unresolved quantity when the approved investigation supports a loss or damage decision.

The user who received the transfer cannot resolve its discrepancy. A second administrator must complete the review.

> **Control rule:** Never imitate a transfer by entering a new goods receipt at the destination. That duplicates stock value and breaks the audit trail.

---

## 15. POS Sales

Open **Pharmacy → POS Sales**.

### Open the register

Every user must open their own register session before collecting payment.

1. Confirm the active pharmacy location.
2. Enter the physical cash opening float.
3. Select **Open register**.

The opening float is cash already in the drawer before sales begin. Enter `0.00` if there is no opening cash.

### Make a walk-in sale

1. Open the **Sale** tab.
2. Scan a barcode and press Enter to add an exact match immediately, or search by medicine name, generic, brand, manufacturer, strength, product code, or barcode.
3. Review the product card. It shows the medicine identity, package, safe stock, current shop price, and any expiry warning.
4. Select the card to add the permitted starting quantity to the cart:
   - Loose-sale products begin at their configured minimum quantity and increase one selling unit at a time.
   - Whole-package products begin at one complete package and increase only by complete package quantities.
5. Use `+` and `−`, enter a permitted quantity, or select **Remove** to delete the line.
6. Enter the customer's name if required.
7. Select **Cash** or **Mobile Money**.
8. For cash, enter the amount received and confirm the displayed change.
9. For Mobile Money, enter the transaction reference.
10. Check the cart total and select **Complete payment**.
11. Print the receipt or close the receipt preview. The completed cart is cleared immediately for the next customer.

When searching, unavailable products may remain visible in a disabled state with a reason such as **Out of stock**, **Expired stock only**, or **No selling price**. They cannot be added to the cart.

The system prevents the sale when:

- The register is closed.
- There is insufficient safe stock across all available batches.
- The medicine is inactive.
- The product has no current selling price at the active shop.
- The requested quantity is below the minimum sale quantity.
- A whole-package product is not entered in complete package quantities.
- A Mobile Money reference is missing.
- A Mobile Money reference has already been used at that location.

After a successful sale, the system allocates the requested quantity automatically using FEFO, deducts the earliest-expiring safe stock first, and records the payment in the open register session. If one batch cannot satisfy the quantity, the system continues into the next safe batch without extra cashier steps.

### Sell medicines from a printed clinical prescription

1. Ask the client for the printed laboratory or scan report containing the prescription note.
2. Read and verify the written medicines and instructions.
3. Search each medicine in the **Sale** tab and select it to add it to the cart.
4. Adjust each quantity and verify the current shop price.
5. Enter the patient name as the customer name when required.
6. Select the payment method and complete checkout.

> **Clinical safety:** The printed note is the clinical handoff. The pharmacy POS does not import, interpret, match, or track prescription completion automatically. Pharmacy staff must verify the paper and key the correct medicines and quantities.

### Review and reprint a receipt

1. Open the **Transactions** tab.
2. Find the server-recorded receipt number, date, customer, cashier, payment, and status.
3. Select **Receipt**.
4. Choose **58 mm** or **80 mm** and select **Print receipt**. The browser print dialog can also save it as PDF.

Reprints use the original server sale number, sale time, cashier, location, item prices, batch references, payment method, and Mobile Money reference. A voided transaction prints with a visible void notice.

### Automatic batch allocation

The cashier does not select a batch. The POS only counts non-expired, non-quarantined, unreserved stock and allocates FEFO automatically. Batch identity remains recorded in the stock ledger and receipt data for traceability.

---

## 16. End-of-Shift Reconciliation

Each user closes their own register for the active pharmacy location.

1. Open **POS Sales**.
2. Select the **Close shift** tab.
3. Review:
   - Number of unclosed transactions.
   - Expected cash.
   - Expected Mobile Money.
4. Count the physical cash drawer.
5. Confirm the Mobile Money amount received.
6. Enter both counted amounts.
7. Review the calculated discrepancy.
8. If there is a surplus or shortage, enter a clear explanation in the notes.
9. Select **Close and lock shift**.
10. Print the closure slip and retain it according to clinic policy.

### Reconciliation calculation

- **Expected cash** = opening float + cash sales in the session.
- **Expected Mobile Money** = Mobile Money sales in the session.
- **Total counted** = physical cash counted + Mobile Money counted.
- **Discrepancy** = total counted − total expected.

A discrepancy of `0.00` means the register balances. A positive amount is a surplus; a negative amount is a shortage. Notes are required when there is a variance.

After closing the shift, open a new register session before recording more sales.

Closed shifts are locked. A sale from a closed shift cannot be directly voided or used to recalculate the closure; it requires the organisation's approved formal reversal process. An open-shift void must be approved by someone other than the original cashier, and returned stock enters quarantine.

---

## 17. Multi-Location Operating Rules

For organisations with several pharmacy shops:

- Each location has its own batches, stock balances, purchase orders, goods receipts, sales, and register sessions.
- The medicine catalogue and supplier directory are shared across the organisation.
- Staff only access pharmacy locations assigned to them, while administrators may have wider access.
- Always switch to the receiving shop before posting a delivery.
- Use **Stock Transfers** for every movement between shops.
- Review **Network Stock** before placing an urgent supplier order; another shop may have safe transferable excess.
- Source staff dispatch stock; destination staff independently confirm receipt.
- Quarantine questionable received stock instead of making it available for sale.
- Investigate every transfer discrepancy before an administrator closes it.

---

## 18. Daily Operating Checklist

### Start of day

- Confirm the correct active location.
- Review low-stock and expiry alerts.
- Review Network Stock shortages, excesses, in-transit quantities, and quarantine.
- Check pending approved purchase orders and expected deliveries.
- Open the POS register with the correct cash float.

### During the day

- Receive all deliveries with batch and expiry information.
- Check supplier invoice numbers and quantities before posting.
- Use the correct batch for every sale.
- Record a Mobile Money reference for every Mobile Money payment.
- Verify clinic prescriptions before dispensing.
- Record damaged, lost, expired, or mismatched stock through Stock Control rather than altering receipts.
- Dispatch approved transfers from the source and receive delivered transfers at the destination without delay.

### End of day

- Finish all pending checkouts.
- Count cash and confirm Mobile Money receipts.
- Explain every surplus or shortage.
- Close and print the register reconciliation slip.
- Report low stock, expired stock, and receiving discrepancies to the responsible manager.

---

## 19. Troubleshooting

### I cannot see a pharmacy location

- Ask an administrator to assign your account to the location.
- Refresh the page after assignment.
- Sign out and sign in again if the location still does not appear.

### I cannot find a medicine during receiving

- Confirm that the medicine exists in **Medicine Library** and has a package in **Product Catalogue**.
- Confirm that it is active.
- Register the medicine before receiving its stock.

### I cannot find a supplier

- Confirm that the supplier exists in **Suppliers**.
- Confirm that the supplier is active.
- Archived suppliers cannot be used for new receipts or orders.

### I cannot receive a purchase order

- Confirm the order is **Approved** or **Partially received**.
- Confirm you are working in the same location as the order.
- Confirm the received quantity does not exceed the outstanding quantity.

### I cannot complete a sale

- Confirm your register is open.
- Confirm the correct location is selected.
- Confirm the selected batch has enough stock and is not expired.
- Confirm the medicine is active.
- Enter the Mobile Money reference when using Mobile Money.

### The stock balance looks wrong

- Confirm the active location.
- Open **View batches** and compare each batch with physical stock.
- Review the medicine's recent movements in **Stock Control → Stock ledger**.
- Start a cycle count for the affected batch and submit the variance for approval.
- Do not enter a new receipt only to correct the balance.

### My stock count cannot be approved

- Confirm the count was submitted.
- Confirm every selected batch has a physical quantity.
- Check whether a receipt, sale, return, or adjustment changed stock after the count began.
- Start a fresh count when the original snapshot no longer matches current stock.

### I cannot approve or dispatch a transfer

- Confirm the active location is the source shop.
- Confirm the transfer is **Requested** before approval or **Approved** before dispatch.
- Check that enough unreserved stock remains in every source batch.
- Refresh the transfer if a sale, return, adjustment, or another approval changed availability.

### I cannot receive a transfer

- Switch to the destination pharmacy location shown on the transfer.
- Confirm the transfer status is **Dispatched**.
- Enter accepted quantities for every dispatched line.
- Explain every shortage, damaged pack, or rejected quantity.

### No replenishment recommendations appear

- Confirm stock policies are configured for the affected medicine and locations.
- Confirm the destination has a calculated shortage.
- Confirm another location has stock above its protected requirement.
- Confirm suggested donor batches are unexpired, unreserved, and not quarantined.
- Near-expiry stock is excluded when projected demand cannot consume it safely.

### Quarantined stock cannot be sold

- This is expected. Quarantined units are excluded from available stock.
- Ask an administrator to inspect the batch in **Network Stock → Quarantine**.
- Release safe stock or write off unusable stock with a documented reason.

### The register does not balance

- Recount the cash drawer.
- Check the opening float.
- Compare Mobile Money references with the wallet statement.
- Confirm no payment was entered under the wrong method.
- Record a clear explanation before closing with a variance.

---

## 20. Current Version Limitations

The following workflows are not yet available as complete pharmacy features:

- POS refunds, returns, and sale voiding from the pharmacy screen.
- Holding and resuming an unfinished sale.
- Split payment across Cash and Mobile Money.
- Advanced transaction search, date filtering, and pagination.
- Controlled discounts and cashier price overrides.

Follow the organisation's approved manual process for these activities until the corresponding PharmaFlow workflow is introduced.

---

## 21. Support Information to Provide

When reporting a problem, provide:

- Your username and role.
- The active pharmacy location.
- The screen where the issue occurred.
- The medicine, supplier, order, receipt, sale, or batch reference.
- The exact error message.
- The date and approximate time.
- A screenshot that does not expose passwords or access tokens.

Do not send passwords, login tokens, or other private authentication details to support.
