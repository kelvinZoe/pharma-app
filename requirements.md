# Radiography Clinic System Requirements Document

## 1. Purpose
Build a clinic management system for one radiography clinic that handles patient records, frontdesk registration, lab and scanning workflow, billing, pharmacy sales and inventory, role-based access, and financial reporting.

The system is walk-in only and supports full payments only. There is no credit, no unpaid visits, no discounts, and no voids in V1.

## 2. Scope
### In Scope
- Frontdesk patient registration and visit creation
- Returning patient search and record reuse
- Service selection and price lookup
- Department worklists for Laboratory and Scanning
- Adding extra services during service delivery
- Marking services as done or not done
- Service-specific result templates
- Free-text prescriptions from labs/scans
- Separate clinic billing and pharmacy billing
- Pharmacy stock, inventory, and POS
- Admin setup for services, prices, users, roles, and templates
- Financial and operational reports
- Printable A4 summaries and receipts

### Out of Scope for V1
- Credit sales
- Partial payments
- Appointment scheduling
- Insurance claims processing
- Uploading documents or lab images
- Discounts
- Voids and reversals
- Guardian details for minors
- Pharmacy item search when prescribing
- Barcode integration unless added later

## 3. Business Rules
1. The system is for one clinic only.
2. Currency is Ghana cedis.
3. Payments are accepted by cash or mobile money.
4. Every visit must be paid in full before it is closed.
5. No unpaid visits are allowed.
6. The clinic is walk-in only.
7. Returning patients are matched by full name and phone number, then opened as a new visit linked to the existing patient record.
8. Patient records may be updated over time as new visits are created.
9. A service can be performed more than once in the same visit, and each occurrence is billed.
10. Extra services may be added by labs/scans staff or supervisors.
11. Department staff may mark a service as done or not done only.
12. If a service is not done, a preset reason or free-text reason must be recorded.
13. Service prices are maintained by admin.
14. Service templates are configured by admin per service.
15. Clinic billing and pharmacy billing are separate, but both feed into the overall financial reports.
16. The system must retain records for at least six years.

## 4. User Roles
### 4.1 Admin
- Full access to all modules
- Creates services and sets prices
- Creates and manages users
- Assigns roles and permissions
- Defines service result templates
- Views all financial and operational reports

### 4.2 Frontdesk
- Registers new patients
- Searches returning patients
- Opens a new visit for a patient
- Selects services for a visit
- Checks and informs the patient of service prices
- Generates clinic invoice
- Records payment
- Prints frontdesk receipt and clinic summary

### 4.3 Laboratory Staff
- Views assigned visits
- Adds extra lab services when needed
- Marks services as done or not done
- Records not-done reasons
- Enters results and notes
- Creates free-text prescriptions

### 4.4 Scanning Staff
- Views assigned visits
- Adds extra scan services when needed
- Marks services as done or not done
- Records not-done reasons
- Enters results and notes
- Creates free-text prescriptions

### 4.5 Supervisor
- Performs all department actions for the assigned department
- Can add extra services and complete records

### 4.6 Pharmacist
- Views clinic prescriptions
- Sells medicines as pharmacy stock items
- Manages pharmacy stock and inventory
- Creates pharmacy sales receipts

### 4.7 Accountant
- Views clinic revenue
- Views pharmacy revenue
- Reviews financial summaries and exports

### 4.8 Custom Roles
- Admin may create custom roles with selected permissions

## 5. Patient Management
### 5.1 Patient Search
Frontdesk must search for returning patients using:
- Full name
- Phone number

If a match is found, the user opens the patient record and creates a new visit.

### 5.2 Patient Registration Fields
Required fields:
- Surname
- First name
- Middle name
- Sex
- Age
- Telephone number
- Referral center
- Reason for visit / investigation requested
- Insurance status: insured or uninsured
- Emergency contact

Optional or not required:
- Email
- Occupation
- Guardian details for minors

### 5.3 Patient Identifier
- The clinic patient ID prefix is `CL`
- The system should generate unique patient IDs automatically

## 6. Visit Management
### 6.1 Visit Creation
Each clinic attendance creates a new visit linked to the patient record.

### 6.2 Visit Statuses
Suggested statuses:
- Registered
- Sent to department
- In progress
- Completed
- Awaiting payment
- Paid
- Closed

### 6.3 Visit Contents
A visit must store:
- Patient information snapshot
- Selected services
- Added services
- Department notes
- Results
- Prescriptions
- Payment details
- Receipt references

## 7. Services and Departments
### 7.1 Departments
Initial departments:
- Laboratory
- Scanning

The system must support adding more departments later.

### 7.2 Service Catalog
Admin creates all services offered by the clinic.

Each service must have:
- Service name
- Department assignment
- Price
- Result template
- Required/optional result fields
- Active/inactive status

### 7.3 Service Rules
- A service belongs to one department only
- A service has one assigned department
- A service may be repeated in the same visit if medically necessary
- Repeated services add to the total bill
- Frontdesk and department staff must be able to view the service price before adding it

### 7.4 Quick Price Lookup
Frontdesk and department staff need a fast way to search service prices for enquiries before or during registration.

## 8. Department Workflow
### 8.1 Department Worklist
When frontdesk saves a visit, the assigned department receives a new work item.

### 8.2 Department Actions
Department staff can:
- Open a patient visit
- Review patient details and requested services
- Add extra services
- Record observations and results
- Mark services done or not done
- Add not-done reasons
- Create a prescription note

### 8.3 Extra Services
When a department adds an extra service:
- The new service must immediately update the visit total
- The staff must see the new total before saving
- The patient must approve before the service is finalized
- The added service becomes part of the final bill

### 8.4 Not Done Tracking
If a service is not performed:
- Mark it as not done
- Select a preset reason where possible
- Allow free-text reason if needed
- Keep the record in the visit history

## 9. Result Templates
### 9.1 Requirement
Admin must define result fields for each service.

### 9.2 Preferred Template Style
The sample result sheet shows a table-based layout with:
- Patient header fields
- A results table
- Section headings
- Method name
- Result
- Unit
- Evaluation
- Min
- Max

### 9.3 Recommended Implementation Approach
The easiest and most maintainable approach is:
- Admin builds the template using a structured form/table builder
- The system stores rows, columns, headings, and result fields
- The printed output renders as a table-based A4 form

This approach is preferred over image upload or automatic template reading because it is easier to control, edit, and print consistently.

### 9.4 Template Field Types
Supported field types should include:
- Text
- Number
- Decimal number with 2 decimal places
- Dropdown
- Checkbox
- Date
- Section heading

### 9.5 Field Rules
- Some fields may be required
- Some fields may be optional
- Numeric result fields may support reference ranges
- Printed templates must follow the configured layout

## 10. Prescription Workflow
### 10.1 Prescription Rules
- Department staff may enter a free-text prescription note
- The system does not require selecting medicines from stock during prescription creation
- Prescription dosage details are left to the physician or department user

### 10.2 Prescription Content
Prescription notes should support:
- Medicine name
- Quantity or quantity note
- Remarks
- Optional extra notes

### 10.3 Pharmacy Linkage
The pharmacy should receive prescriptions linked to clinic visits so the pharmacist can dispense or recommend alternates based on stock availability and professional discretion.

## 11. Billing and Payments
### 11.1 Billing Model
Clinic billing and pharmacy billing are separate.

### 11.2 Clinic Billing
Frontdesk generates a clinic invoice based on:
- Base services selected at registration
- Extra services added in departments
- Repeat services

### 11.3 Payment Rules
- Payment must be full
- No credit is allowed
- No unpaid visits are allowed
- Payment methods: cash and mobile money

### 11.4 Post-Payment Workflow
After successful payment:
- Frontdesk marks the visit as paid
- The transaction is recorded in clinic accounts
- The system prints the clinic receipt and summary

### 11.5 Receipts
The patient receives two separate receipts:
- Frontdesk clinic receipt
- Pharmacy receipt, if medicines were bought

Receipts should be A4 printable and include space for stamps for now.

## 12. Pharmacy Management
### 12.1 Pharmacy Scope
The pharmacy module is a full stock, inventory, and POS system.

### 12.2 Pharmacy Functions
The pharmacy should support:
- Product setup
- Stock intake
- Stock balances
- Sales transactions
- Sale history
- Inventory adjustments
- Low stock monitoring
- Batch and expiry tracking
- Supplier records
- Reorder levels
- Financial summaries

### 12.3 Clinic Prescription Sales
The pharmacy must be able to see clinic prescriptions and convert them into pharmacy sales.

### 12.4 Sale Type
Sales must be distinguishable as:
- Walk-in pharmacy sale
- Clinic-referred sale

### 12.5 Independent Billing
Pharmacy sales are billed independently from clinic services.

## 13. Financial and Reporting Requirements
The system should provide robust reporting for both clinic and pharmacy.

### 13.1 Clinic Reports
- Daily revenue
- Revenue by date range
- Revenue by staff member
- Revenue by service
- Revenue by department
- Service volume reports
- Patient visit history
- Paid visit summaries

### 13.2 Pharmacy Reports
- Daily sales
- Sales by date range
- Sales by product
- Stock on hand
- Stock movement
- Expiry report
- Low stock report
- Profit or margin summary where available

### 13.3 Combined Reports
- Total clinic plus pharmacy revenue
- Revenue comparison by module
- Cash and mobile money summaries

### 13.4 Export Formats
Reports should be exportable to:
- PDF
- Excel

## 14. Printing Requirements
- Clinic summary must print on A4
- Pharmacy receipt must print separately
- Printed clinic summary should include patient details, services, results, prescriptions, notes, and payment information
- Include a space for stamp on the clinic printout

## 15. Security and Access Control
- Role-based access control is required
- All major departments must have restricted permissions
- Admin can create custom roles
- Staff users can only access their assigned permissions
- Audit history should track key actions such as service changes, result entry, payment, and stock updates

## 16. Audit and Retention
The system should retain records for 6 years minimum, including:
- Patient records
- Visits
- Billing records
- Receipts
- Prescriptions
- Department results
- Pharmacy stock movements
- User activity logs

## 17. Data Entities
Minimum data entities include:
- Patients
- Visits
- Services
- Departments
- Visit services
- Results
- Prescriptions
- Invoices
- Payments
- Pharmacy products
- Stock entries
- Sales
- Users
- Roles
- Permissions
- Audit logs

## 18. V1 Acceptance Summary
The system will be considered ready for V1 when it can:
- Register a new patient
- Reopen a returning patient and create a new visit
- Assign services and show prices immediately
- Route the visit to Laboratory or Scanning
- Allow department staff to add extra services
- Track done and not done items with reasons
- Capture service-specific results
- Create prescriptions
- Generate a full clinic invoice
- Record full payment
- Print clinic receipt and summary
- Process pharmacy sales separately
- Generate pharmacy receipts
- Support admin setup, access control, and reporting

## 19. Notes for Later Phases
Future enhancements can include:
- Appointment scheduling
- Insurance claims
- Digital document upload
- Advanced receipt stamping/signature workflows
- Barcode-enabled pharmacy operations
- Mobile or tablet support
- Analytics dashboards with charts
