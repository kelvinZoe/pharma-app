# Pharma Flow Pharmacy: Full-System Roadmap

## Purpose

This document is the implementation backlog for turning the current pharmacy module into a complete clinic and community pharmacy system. It covers operational workflows, database changes, backend rules, frontend redesign, security, reporting, testing, deployment, and acceptance criteria.

The work should be delivered in phases. Each phase must be usable, tested, and deployable before the next phase begins.

## Product Goal

The pharmacy workspace should support the complete operating cycle:

```text
Medicine catalogue
    -> Pharmacy location and stock ownership
    -> Supplier and procurement
    -> Goods receipt and batch creation
    -> Stock control and expiry management
    -> Prescription review or walk-in sale
    -> Dispensing and payment
    -> Receipt and patient history
    -> Cashier reconciliation
    -> Financial, stock, and audit reporting
```

## Experience Goal

The redesigned pharmacy should feel like a professional workstation:

- Fast enough for a cashier or pharmacist serving a waiting patient.
- Dense enough to show stock, batch, price, supplier, and location information together.
- Calm and consistent, with one teal accent and neutral surfaces.
- Explicit about risky actions such as expired stock, substitutions, adjustments, voids, and controlled medicines.
- Keyboard-friendly and barcode-ready.
- Responsive for desktop and tablet, with safe mobile fallbacks.
- Free of decorative animation that could distract from clinical or financial work.

## Priority Legend

- `P0`: Production blocker, security issue, incorrect data, or broken workflow.
- `P1`: Required for a dependable pharmacy release.
- `P2`: Required for a full operational pharmacy.
- `P3`: Advanced capability after the core system is stable.

---

# Foundation Phase: Multi-Location Pharmacy Network

This phase must be completed before the larger inventory, procurement, dispensing, and reporting work. A tenant may operate several independently licensed pharmacy shops while sharing one medicine catalogue and consolidated management view.

## F.1 Ownership Model

Use the following hierarchy:

```text
Tenant
├── Shared medicine catalogue
├── Pharmacy Location A
│   ├── Users and permissions
│   ├── Stock lots and batches
│   ├── Registers and sessions
│   ├── Sales and returns
│   ├── Procurement and receipts
│   └── Stock counts and adjustments
├── Pharmacy Location B
│   └── Independent operational records
└── Consolidated network reporting
```

- [ ] `P0` create `PharmacyLocation` with tenant, code, name, address, phone, licence details, supervising pharmacist, status, and timestamps.
- [ ] `P0` keep `PharmacyProduct` as a shared tenant-wide medicine catalogue.
- [ ] `P0` create `UserPharmacyLocation` to assign users to one or more locations.
- [ ] `P0` support a default location for each pharmacy user.
- [ ] `P0` support location-specific roles and permissions where a user has different responsibilities by shop.
- [ ] `P0` add `locationId` to pharmacy stock lots, movements, sales, sale items, registers, sessions, closures, purchase orders, goods receipts, stock counts, adjustments, returns, and refunds.
- [ ] `P0` require a location for every pharmacy operational record.
- [ ] `P0` enforce tenant and location consistency before related records can be linked.
- [ ] `P0` prevent users from reading or operating locations to which they are not assigned.
- [ ] `P0` create tenant-and-location compound indexes for operational queries.
- [ ] `P1` support location archive without deleting its historical records.
- [ ] `P1` retain licence, responsible pharmacist, and operational status history by location.

## F.2 Location-Aware Stock

- [ ] `P0` replace tenant-wide batch quantity assumptions with location-owned stock lots.
- [ ] `P0` record available, reserved, quarantined, in-transit, damaged, and expired quantities separately.
- [ ] `P0` ensure the same product and manufacturer batch can exist at multiple locations without sharing quantity.
- [ ] `P0` preserve acquisition cost by receipt or transferred stock layer.
- [ ] `P0` calculate stock on hand by location and across the tenant network.
- [ ] `P0` calculate available stock as on-hand stock minus reserved and unavailable quantities.
- [ ] `P0` make every stock movement location-specific and immutable.
- [ ] `P0` make every sale deduct stock only from its fulfilling location.
- [ ] `P0` make every return restore or quarantine stock only at the original fulfilling location.
- [ ] `P0` enforce FEFO within the selected location.
- [ ] `P1` create `PharmacyLocationProduct` for location-specific reorder point, minimum stock, maximum stock, safety stock, preferred supplier, and optional price override.
- [ ] `P1` calculate average daily usage and days of stock by product and location.
- [ ] `P1` expose network availability without allowing direct cross-location sale deductions.

## F.3 Active Location Experience

- [ ] `P0` add an active pharmacy location selector to the application top bar.
- [ ] `P0` show the active location persistently on every pharmacy page.
- [ ] `P0` default single-location users directly into their assigned shop.
- [ ] `P0` require multi-location users to select or confirm their active shop.
- [ ] `P0` clear carts, drafts, and incomplete checkout state before switching locations.
- [ ] `P0` include the active location in pharmacy API requests through trusted session context rather than accepting an unrestricted client-provided location.
- [ ] `P0` reject operations when the active location is missing, inactive, or unauthorized.
- [ ] `P1` allow tenant managers to switch between location and network views.
- [ ] `P1` show location name and code on receipts, labels, purchase orders, goods receipts, transfers, and closure slips.
- [ ] `P1` add a Location Management screen for authorized administrators.

## F.4 Inter-Location Stock Transfers

Transfer stock through a documented state machine:

```text
draft -> requested -> approved -> reserved -> dispatched -> received -> completed
                                      └──────── cancelled / rejected
                                                   └──── discrepancy review
```

- [x] `P1` create `PharmacyTransfer` with source, destination, requester, approver, dispatcher, receiver, status, reason, dates, and tenant.
- [x] `P1` create `PharmacyTransferLine` with product, source stock lot, batch, requested, approved, dispatched, received, rejected, and discrepancy quantities.
- [x] `P1` prevent source and destination from being the same location.
- [x] `P1` prevent transfer quantities from reducing the source below available stock.
- [x] `P1` reserve approved stock so it cannot be sold while awaiting dispatch.
- [x] `P1` pick transfer stock using FEFO unless an authorized override is recorded.
- [x] `P1` create a `transfer_out` movement when stock is dispatched.
- [x] `P1` hold dispatched stock as in transit and unavailable to both shops.
- [x] `P1` preserve product, batch, expiry, acquisition cost, storage requirements, and source identity throughout transport.
- [x] `P1` capture dispatch documentation and transporter details where required.
- [x] `P1` require destination quantity and condition checks on receipt.
- [x] `P1` create a `transfer_in` movement only for accepted quantities.
- [x] `P1` quarantine damaged, suspect, temperature-affected, recalled, or mismatched stock.
- [ ] `P1` record shortages, excesses, damage, and batch mismatches as transfer discrepancies.
- [x] `P1` require authorized discrepancy review and corrective action.
- [x] `P1` prevent completed, cancelled, or rejected transfers from being reposted.
- [x] `P1` keep transfers out of sales revenue and expense totals.
- [x] `P1` add transfer request, source approval, dispatch, destination receipt, and discrepancy notifications.
- [x] `P1` provide printable transfer request, dispatch note, and receipt confirmation.

## F.5 Replenishment and Stock Balancing

- [x] `P1` calculate shortage using current availability, reservations, expected demand, safety stock, and supplier lead time.
- [x] `P1` calculate transferable excess without reducing the source below its safety stock.
- [x] `P1` show other-location availability when a product is unavailable locally.
- [ ] `P1` recommend a donor location based on excess quantity, expiry, distance, and demand.
- [x] `P1` suggest redistribution of near-expiry stock only where projected demand can consume it before expiry.
- [x] `P1` allow managers to convert a shortage recommendation into a transfer request.
- [x] `P1` require approval rather than silently moving stock automatically.
- [ ] `P2` support central procurement with allocation to destination locations.
- [x] `P2` support location-specific procurement where operationally permitted.
- [ ] `P2` create replenishment dashboards for shortages, excesses, near expiry, in-transit stock, and overdue transfers.
- [ ] `P2` notify management when multiple locations are below reorder level and supplier procurement is needed.

## F.6 Sales, Cost, and Revenue Rules

- [ ] `P0` assign every sale and refund to the location that fulfils the transaction.
- [ ] `P0` assign every cashier register and session to one location.
- [ ] `P0` prevent a register session from accepting sales from another location.
- [ ] `P0` record transfers as inventory movements rather than revenue.
- [ ] `P0` carry acquisition cost with transferred stock to the destination.
- [ ] `P0` recognize COGS and gross profit at the destination when transferred stock is sold.
- [ ] `P0` record returns and refunds against the original sale and location.
- [ ] `P1` support tenant default prices with authorized location-specific overrides.
- [ ] `P1` retain clinic, branch, or campaign referral source separately from the location that earns sales revenue.
- [ ] `P1` report sales, COGS, gross profit, returns, discounts, taxes, expenses, and cash reconciliation by location.
- [ ] `P1` provide consolidated tenant reporting that removes any transfer double counting.
- [ ] `P1` compare location performance without exposing restricted financial data to unauthorized users.
- [ ] `P1` assign shared tenant expenses using an explicit allocation rule rather than silently attributing them to a shop.

## F.7 Network UI Redesign

- [x] `P1` add Network Stock to the pharmacy navigation for authorized users.
- [x] `P1` add Transfers with Incoming, Outgoing, In Transit, Discrepancy, and Completed views.
- [ ] `P1` show local availability first and network availability second in product search.
- [x] `P1` clearly distinguish On Hand, Available, Reserved, In Transit, Quarantined, and Expired quantities.
- [ ] `P1` add a location comparison view for stock, sales, gross profit, shortages, excesses, and expiry exposure.
- [ ] `P1` make transfer status and responsibility visible without opening each record.
- [x] `P1` provide source and destination action panels appropriate to the current transfer state.
- [ ] `P1` prevent users from editing source quantities after dispatch or destination quantities after completion.

## F.8 Migration and Backfill

- [ ] `P0` create one default `Main Pharmacy` location for every existing tenant with pharmacy data.
- [ ] `P0` backfill existing batches, movements, sales, items, sessions, and closures into the default location.
- [ ] `P0` assign existing pharmacy users to the default location.
- [ ] `P0` backfill location ownership before making `locationId` mandatory.
- [ ] `P0` verify per-tenant stock totals before and after migration.
- [ ] `P0` verify per-tenant sales, closure, and revenue totals before and after migration.
- [ ] `P0` include rollback instructions and verification queries in the production SQL patch.
- [ ] `P0` prevent new unscoped records once the location feature is enabled.
- [ ] `P1` seed the first client's additional pharmacy locations through the supported admin workflow rather than direct production edits.

## F.9 Multi-Location Tests

- [ ] `P0` test user access to one, several, and no pharmacy locations.
- [ ] `P0` test active-location selection and operation rejection without an active location.
- [ ] `P0` test that a sale cannot deduct another location's stock.
- [ ] `P0` test that a register cannot accept another location's sale.
- [ ] `P0` test that location and consolidated totals reconcile.
- [ ] `P1` test transfer reservation, dispatch, receipt, cancellation, rejection, and discrepancy states.
- [ ] `P1` test that in-transit stock is unavailable at both locations.
- [ ] `P1` test preservation of batch, expiry, and acquisition cost during transfer.
- [ ] `P1` test that transfers do not create revenue or duplicate expenses.
- [ ] `P1` test that destination gross profit uses the transferred acquisition cost.
- [ ] `P1` test shortage and excess recommendations against safety stock.
- [ ] `P1` test cross-tenant and unauthorized cross-location access rejection.

## Foundation Acceptance Criteria

- One tenant can create and operate multiple pharmacy locations.
- Users can work only in assigned locations and always see their active location.
- Stock, registers, sales, procurement, costs, and reconciliation are location-owned.
- Managers can see consolidated network availability without directly selling another shop's stock.
- A shortage can be resolved through an approved, batch-traceable transfer with reservation, dispatch, in-transit, receipt, and discrepancy handling.
- Location and consolidated sales, COGS, profit, stock, and register totals reconcile without transfer double counting.

---

# Phase 0: Stabilize the Existing Pharmacy

## 0.1 Fix Current Functional Defects

- [ ] `P0` Align the inventory API and frontend on one stock field name: `stockOnHand`.
- [ ] `P0` Add `unitOfMeasure` to the medicine registration form and request payload.
- [ ] `P0` Either add `description` to `PharmacyProduct` or remove the unsupported field from the UI.
- [ ] `P0` Filter inactive products out of POS results.
- [ ] `P0` Filter batches with zero stock out of sale selection.
- [ ] `P0` block expired batches in both frontend and backend checkout validation.
- [ ] `P0` Correct stock movement `unitCost` to use purchase cost rather than selling price.
- [ ] `P0` allow a register session with zero sales to be closed.
- [ ] `P0` show the active register session inside the pharmacy POS.
- [ ] `P0` add an Open Register flow directly inside the pharmacy workspace.
- [ ] `P0` disable checkout until the current user has an open register.
- [ ] `P0` show opening float in expected cash and discrepancy calculations.
- [ ] `P0` separate expected cash and expected MoMo in the closure record.
- [ ] `P0` persist the walk-in customer name if it is collected.
- [ ] `P0` collect and persist a MoMo reference for mobile-money sales.
- [ ] `P0` prevent an empty, invalid, inactive, or expired batch from being submitted by direct API calls.

## 0.2 Security and Tenant Isolation

- [ ] `P0` add backend role guards for pharmacy routes.
- [ ] `P0` restrict product, batch, stock, and sales operations to pharmacy and admin roles.
- [ ] `P0` restrict closure review to pharmacy, accounting, and admin roles.
- [ ] `P0` restrict voids, refunds, price overrides, and stock adjustments to explicitly authorized roles.
- [ ] `P0` add `tenantId` to `PharmacyBatch`, `PharmacyStockMovement`, and `PharmacySaleItem` where direct queries require tenant filtering.
- [ ] `P0` add tenant-aware compound indexes for batch number, barcode, and stock queries.
- [ ] `P0` verify that every transaction lookup is constrained to the current tenant.
- [ ] `P0` ensure every product, batch, movement, sale, and register belongs to the same tenant and location before linking them.
- [ ] `P0` add authorization tests proving users cannot access another tenant or another module.

## 0.3 API Reliability

- [ ] `P0` replace `any` request bodies with validated DTOs.
- [ ] `P0` enable global request validation with whitelist and transform behavior.
- [ ] `P0` validate numeric precision, positive quantities, dates, statuses, and allowed payment methods.
- [ ] `P0` make sale-number generation concurrency-safe.
- [ ] `P0` make stock deduction concurrency-safe so two checkouts cannot oversell one batch.
- [ ] `P0` standardize API errors into field errors and operation errors.
- [ ] `P1` add idempotency protection to checkout and goods-receipt submissions.
- [ ] `P1` add pagination, search, filtering, and sorting to product, batch, sale, and movement endpoints.

## 0.4 Baseline Tests

- [ ] `P0` test medicine creation.
- [ ] `P0` test batch intake and stock movement creation.
- [ ] `P0` test successful stock deduction.
- [ ] `P0` test insufficient-stock rejection.
- [ ] `P0` test expired-batch rejection.
- [ ] `P0` test concurrent sale protection.
- [ ] `P0` test register-required checkout.
- [ ] `P0` test cash and MoMo reconciliation.
- [ ] `P0` test sale void and exact stock restoration.
- [ ] `P0` test tenant isolation for every pharmacy model.

## Phase 0 Acceptance Criteria

- A pharmacist can create a medicine, receive a batch, open a register, sell stock, print a receipt, and close the register without an API mismatch.
- Expired, inactive, unavailable, or cross-tenant stock cannot be sold.
- Current stock, expected cash, expected MoMo, discrepancy, and audit history are accurate.
- Backend tests cover critical stock and financial invariants.

---

# Phase 1: Pharmacy Visual Foundation and Navigation

## 1.1 New Pharmacy Information Architecture

Replace the current four-page menu with:

```text
Pharmacy
├── Overview
├── Network
│   ├── Locations
│   ├── Network Stock
│   └── Transfers
├── Dispensing
│   ├── Prescription Queue
│   ├── Walk-in Sale
│   └── Dispensing History
├── Inventory
│   ├── Medicines
│   ├── Batches
│   ├── Stock Movements
│   ├── Stock Count
│   └── Expiry and Low Stock
├── Procurement
│   ├── Suppliers
│   ├── Purchase Orders
│   ├── Goods Receipts
│   └── Purchase Returns
├── Register
│   ├── Current Shift
│   ├── Sales History
│   └── Closures
└── Reports
```

## 1.2 Visual System

- [ ] `P1` define pharmacy page, panel, table, form, drawer, modal, badge, and alert tokens.
- [ ] `P1` use one muted teal accent with slate or zinc neutral surfaces.
- [ ] `P1` use a high-legibility sans-serif interface font and monospaced numerals for quantities, prices, codes, and batch numbers.
- [ ] `P1` standardize spacing, field heights, table row heights, radii, borders, and focus states.
- [ ] `P1` replace emojis with the existing application icon system or consistent SVG icons.
- [ ] `P1` establish status colors for active, low stock, near expiry, expired, quarantined, pending, completed, partially dispensed, and voided.
- [ ] `P1` provide skeleton loading states that match each page layout.
- [ ] `P1` provide useful empty states with the next available action.
- [ ] `P1` provide inline errors rather than browser alerts.
- [ ] `P1` add success confirmation without blocking the operator.
- [ ] `P1` use animation only for drawers, status changes, loading, and confirmation feedback.
- [ ] `P1` ensure all controls have visible keyboard focus and accessible labels.

## 1.3 Shared Angular Components

- [ ] `P1` create a pharmacy page header with title, context, primary action, and secondary actions.
- [ ] `P1` create a metric strip for operational metrics without excessive cards.
- [ ] `P1` create a reusable data grid wrapper with search, filters, sorting, pagination, loading, empty, and error states.
- [ ] `P1` create a product and batch search command component.
- [ ] `P1` create a medicine identity block showing brand, generic name, strength, form, and pack.
- [ ] `P1` create stock and expiry status badges.
- [ ] `P1` create a side drawer for medicine and batch details.
- [ ] `P1` create confirmation dialogs for destructive and controlled actions.
- [ ] `P1` create a money input and quantity input with consistent validation.
- [ ] `P1` create reusable printable receipt, dispensing label, goods-receipt, and closure layouts.

## 1.4 Responsive Rules

- [ ] `P1` optimize pharmacy workflows for 1280px and wider desktops.
- [ ] `P1` provide a tablet mode with collapsible detail panes.
- [ ] `P1` collapse all asymmetric layouts to one column below 768px.
- [ ] `P1` prevent tables, drawers, and checkout summaries from causing horizontal page overflow.
- [ ] `P1` keep primary actions reachable without covering important form fields.

---

# Phase 2: Medicine and Product Catalogue

## 2.1 Data Model

- [x] `P1` separate clinical `PharmacyMedicine` definitions from commercial `PharmacyProduct` SKUs.
- [x] `P1` add structured generic name, strength, dosage form, route, therapeutic class, and prescription category.
- [x] `P1` add brand, manufacturer, barcode, and generated internal SKU to products.
- [x] `P1` add package type, units per package, content unit, package size, and selling unit.
- [x] `P1` add loose-sale and minimum-sale-quantity controls.
- [x] `P1` add location sale availability, reorder point, shelf, and current price controls.
- [x] `P1` add controlled-medicine classification.
- [x] `P1` add tax category and tax-exempt configuration.
- [x] `P1` add storage instructions.
- [x] `P1` add active, archived, and discontinued lifecycle states.
- [ ] `P2` add alternate barcodes and supplier product codes.
- [ ] `P2` add medicine image or package reference where useful.

## 2.2 Catalogue Workflows

- [x] `P1` create medicine-definition and packaged-product create, read, and update endpoints.
- [x] `P1` prevent duplicate active definitions and products through tenant catalogue identities.
- [x] `P1` support archive instead of destructive deletion.
- [x] `P1` show total stock, available stock, average cost, last purchase cost, and selling price.
- [x] `P1` show all batches and movement history from the product detail drawer.
- [x] `P1` support barcode, SKU, brand, generic, manufacturer, and strength search.
- [ ] `P2` support CSV medicine import with validation preview.
- [ ] `P2` support catalogue export.

## 2.3 Catalogue UI Redesign

- [x] `P1` use a full-width operational table instead of placing permanent forms beside the table.
- [x] `P1` provide separate focused drawers for medicine definitions and packaged products.
- [x] `P1` make the product row open a detail drawer without navigating away.
- [x] `P1` expose low-stock, expiry, inactive, and controlled status in the main table.
- [ ] `P1` allow saved filters for frequently used stock views.

---

# Phase 3: Suppliers and Procurement

## 3.1 Supplier Management

- [ ] `P2` create `PharmacySupplier` with name, contacts, address, tax details, payment terms, status, and tenant.
- [ ] `P2` create supplier contact and supplier medicine relationships.
- [ ] `P2` build supplier list, create, edit, archive, and detail screens.
- [ ] `P2` show supplier purchase history, returns, balances, and performance.

## 3.2 Purchase Orders

- [ ] `P2` create purchase order header and line models.
- [ ] `P2` support draft, submitted, approved, partially received, received, cancelled, and closed states.
- [ ] `P2` support expected quantities, unit costs, discounts, taxes, and expected delivery dates.
- [ ] `P2` add configurable approval requirements.
- [ ] `P2` create purchase-order number generation safe under concurrency.
- [ ] `P2` build purchase-order list, editor, approval, print, and detail screens.

## 3.3 Goods Receipt

- [ ] `P2` create goods-receipt header and line models.
- [ ] `P2` receive against a purchase order or as an authorized direct receipt.
- [ ] `P2` capture batch number, manufacture date, expiry date, quantity, bonus quantity, purchase cost, and selling price.
- [ ] `P2` support partial receipt and backordered quantities.
- [ ] `P2` create batches and stock movements atomically when a receipt is posted.
- [ ] `P2` prevent duplicate posting.
- [ ] `P2` print a goods-received note.

## 3.4 Purchase Returns and Payables

- [x] `P2` record returns to supplier by original receipt and batch.
- [x] `P2` deduct returned stock atomically.
- [x] `P2` record supplier invoice number, invoice date, due date, and amount.
- [x] `P2` track paid, partially paid, and outstanding supplier balances.
- [x] `P2` connect supplier payments to the financial module.

---

# Phase 4: Inventory Control

## 4.1 Stock Ledger

- [ ] `P1` replace free-text movement types with a controlled enum.
- [ ] `P1` support purchase receipt, sale, return, void restock, adjustment in, adjustment out, expiry, damage, transfer, count correction, and opening balance.
- [x] `P1` record quantity before, quantity changed, and quantity after.
- [x] `P1` record cost, reference type, reference ID, reason, user, date, and tenant.
- [x] `P1` make the ledger immutable; corrections should create reversing movements.
- [x] `P1` expose a filtered stock-movement report.

## 4.2 Batch Safety

- [ ] `P1` enforce FEFO by default.
- [ ] `P1` prevent expired batches from becoming available stock.
- [ ] `P1` add available, quarantined, recalled, exhausted, expired, and written-off states.
- [ ] `P1` support manual batch override only with permission and a reason.
- [ ] `P1` add configurable near-expiry windows.
- [ ] `P1` send in-app alerts for low stock, near expiry, expired stock, and recalled batches.

## 4.3 Stock Count

- [x] `P2` create stock-count sessions.
- [x] `P2` support full and cycle counts.
- [x] `P2` freeze or snapshot expected quantities when counting begins.
- [x] `P2` capture physical quantities by batch.
- [x] `P2` calculate variance quantity and variance cost.
- [x] `P2` require review and approval before adjustments post.
- [x] `P2` retain count sheets and approval audit history.

## 4.4 Adjustments, Transfers, and Recalls

- [x] `P2` add damaged, lost, expired, and correction workflows.
- [x] `P2` require reason and permission for every stock adjustment.
- [x] `P2` support location-level stock if multiple stores or dispensaries are needed.
- [x] `P2` support transfers between locations with send and receive confirmation.
- [ ] `P2` support product or batch recall with sale traceability.

## 4.5 Inventory UI Redesign

- [ ] `P1` add metric strip: stock value, low stock, near expiry, expired stock, and pending counts.
- [ ] `P1` add quick views for Available, Low Stock, Near Expiry, Expired, Quarantined, and Out of Stock.
- [ ] `P1` create a dedicated batch explorer.
- [ ] `P1` display dates, quantities, costs, and prices in aligned monospaced columns.
- [ ] `P1` make risky stock visually prominent without using oversaturated color.

---

# Phase 5: Clinical Prescription Print Handoff

- [x] Keep laboratory and scan prescription notes linked to the clinical visit.
- [x] Print the prescription note on the diagnostic report given to the client.
- [x] Remove the pharmacy prescription queue and digital prescription-to-sale linking.
- [x] Let pharmacy staff search and key medicines manually from the printed note.
- [ ] `P2` add optional dispensing-label printing without reintroducing a prescription queue.
- [ ] `P2` add patient medication history only after privacy, consent, and clinical ownership rules are defined.

---

# Phase 6: Pharmacy POS and Payments

## 6.1 Checkout

- [x] `P1` support barcode scanning and keyboard-first product search.
- [x] `P1` add products to the cart directly and allocate batches automatically using FEFO.
- [x] `P1` support walk-in customer details without requiring a clinic patient.
- [ ] `P1` optionally link a walk-in sale to an existing patient.
- [ ] `P1` calculate subtotal, discount, tax, rounding, and total explicitly.
- [x] `P1` support cash and mobile money with reference capture.
- [ ] `P2` support split payments.
- [ ] `P2` support credit and insurance only after business rules are defined.
- [ ] `P2` support suspended and resumed carts.
- [ ] `P2` support approved price overrides with reason and audit trail.
- [ ] `P2` support discounts with configurable permission thresholds.

## 6.2 Returns, Refunds, and Voids

- [ ] `P1` separate void-before-completion from return-after-sale.
- [x] `P1` require reason and permission for both.
- [ ] `P1` allow full and line-level returns.
- [ ] `P1` inspect returned medicine before restoring it to sellable stock.
- [x] `P1` support quarantine instead of automatic restocking when appropriate.
- [ ] `P1` record refund payment method and reference.
- [ ] `P1` keep the original sale immutable and create reversal records.
- [x] `P1` update register reconciliation after valid returns and voids.

## 6.3 Receipt Redesign

- [x] `P1` support 58mm and 80mm thermal receipt widths.
- [ ] `P1` show pharmacy name, address, contact, receipt number, cashier, date, and register.
- [ ] `P1` show medicine, quantity, unit price, discount, and line total.
- [x] `P1` show payment method and MoMo reference when applicable.
- [x] `P1` show patient or customer identity when available.
- [ ] `P1` include return-policy text from settings.
- [x] `P1` support print, reprint, and browser PDF output.

---

# Phase 7: Register and Cashier Reconciliation

## 7.1 Register Rules

- [x] `P1` allow one open register session per cashier and location.
- [x] `P1` require an open session before payment collection.
- [x] `P1` track opening float separately from sales.
- [ ] `P1` calculate expected cash as opening float plus cash sales minus cash refunds.
- [ ] `P1` calculate expected MoMo from MoMo sales minus MoMo refunds.
- [x] `P1` capture counted cash, counted MoMo, notes, and discrepancy.
- [x] `P1` allow zero-sale closure.
- [ ] `P1` require supervisor review above a configurable discrepancy threshold.
- [x] `P1` prevent closed sessions from receiving new sales.
- [ ] `P1` add reopen or correction workflow only through a controlled reversal.

## 7.2 Register UI Redesign

- [ ] `P1` show register state persistently in the pharmacy header.
- [x] `P1` use clear Open Register and Close Register actions.
- [ ] `P1` show transaction count, cash sales, MoMo sales, refunds, opening float, and expected totals.
- [ ] `P1` keep counted values private while the cashier enters them where blind counting is desired.
- [ ] `P1` show discrepancy only after counted values are submitted or when policy permits.
- [x] `P1` provide a printable closure slip and manager review screen.

---

# Phase 8: Reporting and Pharmacy Accounting

## 8.1 Correct Costing

- [x] `P1` store purchase cost on each sale item at the time of sale.
- [x] `P1` calculate COGS from quantities actually sold.
- [ ] `P1` calculate gross profit as net sales minus COGS.
- [ ] `P1` subtract refunds and voids correctly.
- [ ] `P1` separate inventory purchases from period expenses.
- [ ] `P1` calculate stock valuation using an agreed method.
- [ ] `P1` preserve historical cost even when current batch prices change.

## 8.2 Operational Reports

- [ ] `P1` daily sales by payment method.
- [ ] `P1` sales by cashier and register.
- [ ] `P1` sales by product, category, location, and customer type.
- [ ] `P1` gross margin by product, batch, category, and period.
- [ ] `P1` current stock valuation.
- [ ] `P1` stock movement ledger.
- [ ] `P1` low-stock and reorder report.
- [ ] `P1` near-expiry and expired-stock report.
- [ ] `P1` stock adjustment and variance report.
- [ ] `P2` fast-moving, slow-moving, and non-moving stock.
- [ ] `P2` stock ageing and dead-stock value.
- [ ] `P2` supplier purchase and return analysis.
- [ ] `P2` purchase-order and outstanding supplier balance reports.

## 8.3 Report UI

- [ ] `P1` add consistent date, cashier, payment, product, supplier, and status filters.
- [ ] `P1` show report assumptions and totals clearly.
- [ ] `P1` support CSV and print/PDF output.
- [ ] `P1` make summary figures traceable to transaction details.
- [ ] `P1` avoid fabricated fallback metrics when live data is unavailable.

---

# Phase 9: Controls, Audit, and Configuration

## 9.1 Permissions

- [ ] `P1` define granular permissions instead of depending only on module role.
- [ ] `P1` include catalogue manage, procurement create, procurement approve, stock receive, stock adjust, dispense, sell, discount, price override, return, void, close register, review closure, and reports permissions.
- [ ] `P1` let admin assign permission templates by pharmacy role.
- [ ] `P1` enforce every permission in the backend.

## 9.2 Audit

- [ ] `P1` audit medicine creation and edits.
- [ ] `P1` audit batch receipt and price changes.
- [ ] `P1` audit stock adjustments, counts, transfers, expiry, and recalls.
- [ ] `P1` audit substitutions and partial dispensing.
- [ ] `P1` audit discounts, overrides, returns, refunds, voids, and receipt reprints.
- [ ] `P1` audit register opening, closure, discrepancy review, and reversals.
- [ ] `P1` capture before and after data where applicable.
- [ ] `P1` make audit records tenant-scoped and read-only.

## 9.3 Settings

- [ ] `P2` configure receipt sizes and return-policy text.
- [ ] `P2` configure near-expiry windows and reorder behavior.
- [ ] `P2` configure discrepancy approval thresholds.
- [ ] `P2` configure tax and rounding rules.
- [ ] `P2` configure medicine numbering, purchase-order numbering, receipt numbering, and register numbering.
- [ ] `P2` configure whether blind cash counting is required.
- [ ] `P2` configure whether negative stock is always prohibited.

## 9.4 Regulatory Review

- [ ] `P2` document the exact pharmacy type and operating jurisdiction.
- [ ] `P2` verify local requirements for controlled medicines, retention periods, receipt content, tax handling, and patient privacy before claiming compliance.
- [ ] `P2` add any jurisdiction-specific registers or reports only after requirements are confirmed.

---

# Phase 10: Quality, Migration, and Release

## 10.1 Database Delivery

- [ ] `P0` create one reviewed SQL patch per phase for production Postgres.
- [ ] `P0` update Prisma schema alongside every SQL patch.
- [ ] `P0` make SQL patches safe to rerun where practical.
- [ ] `P0` include backfill steps for tenant IDs, costs, statuses, and references.
- [ ] `P0` include verification queries with each patch.
- [ ] `P0` avoid `prisma migrate deploy` while migration-provider history remains incompatible.
- [ ] `P1` create a long-term migration-history repair plan.

## 10.2 Automated Tests

- [ ] `P1` add unit tests for stock, cost, discount, tax, refund, and reconciliation calculations.
- [ ] `P1` add service tests for procurement, goods receipt, dispensing, checkout, returns, and stock count.
- [ ] `P1` add authorization and tenant-isolation tests.
- [ ] `P1` add frontend component tests for critical forms and state transitions.
- [ ] `P1` add end-to-end tests for the complete purchase-to-sale cycle.
- [ ] `P1` add end-to-end tests for sale-to-return and register closure.

## 10.3 Manual Acceptance Tests

- [ ] Receive stock from a supplier and verify batch and ledger values.
- [ ] Attempt to sell expired, quarantined, exhausted, and cross-tenant stock.
- [ ] Key medicines from a printed clinical report and complete a normal POS sale.
- [ ] Record a substitution with authorization.
- [ ] Complete walk-in cash, MoMo, and split-payment sales.
- [ ] Return one line from a multi-line sale.
- [ ] Close an exact register and a register with a discrepancy.
- [ ] Run stock valuation and verify it against batch balances.
- [ ] Run gross-profit reporting and verify it against sale-item costs.
- [ ] Verify printed receipts, labels, purchase orders, goods receipts, and closure slips.

## 10.4 Release Gates

- [ ] Backend build passes.
- [ ] Frontend build passes.
- [ ] Pharmacy automated tests pass.
- [ ] SQL patch is tested on a production-like Postgres database.
- [ ] Backup and rollback instructions are documented.
- [ ] Role and tenant access review passes.
- [ ] Desktop and tablet usability review passes.
- [ ] Financial totals reconcile with transaction details.
- [ ] Stock on hand reconciles with the movement ledger.

---

# Recommended Execution Order

## Release 1: Reliable Existing Pharmacy

Complete the Multi-Location Foundation, Phase 0, and the visual foundation in Phase 1. This release establishes location ownership, safely migrates existing data, and repairs the current pharmacy before expanding its business scope.

## Release 2: Dependable Inventory and POS

Complete medicine catalogue, location-aware FEFO, stock ledger, register workflow, payment references, transfers, returns, and accurate location-plus-network COGS reporting.

## Release 3: Structured Dispensing

Add optional dispensing labels and patient medication history only after privacy, consent, and clinical ownership rules are approved.

## Release 4: Procurement and Advanced Stock Control

Complete suppliers, purchase orders, goods receipts, purchase returns, stock counts, adjustments, advanced replenishment, and recalls.

## Release 5: Full Reporting and Governance

Complete operational reports, permission templates, advanced audit, configuration, regulatory review, and final quality gates.

---

# First Implementation Sprint

The first sprint should remain narrow and leave production safer than it is now:

1. Add pharmacy location, user-location access, and active-location data structures.
2. Create the existing-data migration and default-location backfill.
3. Scope batches, movements, sales, registers, sessions, and closures by location.
4. Add active-location selection and authorization enforcement.
5. Fix `stockOnHand` naming across backend and frontend.
6. Fix medicine creation fields and validation.
7. Add pharmacy role guards and DTOs.
8. Block expired and inactive stock at checkout.
9. Correct sale-item cost and movement cost capture.
10. Add location-owned register status, open, and close controls to Pharmacy POS.
11. Correct register expected cash and MoMo calculations.
12. Add focused backend tests for location, stock, sale, and register isolation.
13. Redesign the Inventory and POS shells with persistent active-location context.
14. Build both applications and prepare the production SQL patch with verification queries.

Completing this sprint creates a location-safe base for the larger pharmacy build without mixing procurement, dispensing, transfers, and advanced reporting into the first deployment.
