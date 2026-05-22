# Radiography Clinic System Database Schema Draft

This is a first-pass relational schema for V1. It is designed for a single clinic, separate clinic and pharmacy billing, walk-in visits, full payment only, service repetition, department worklists, configurable result templates, and six-year record retention.

## 1. Schema Design Notes
- Primary keys are shown as `id` unless a natural key is more useful.
- Foreign keys are implied by naming and table relationships.
- Timestamps should use `created_at`, `updated_at`, and where relevant `deleted_at`.
- Monetary values should use a decimal type with 2 decimal places.
- Status columns should use enums or lookup tables.
- Flexible result templates can use a mix of normalized tables and a `jsonb` layout column if the implementation stack supports it.

## 2. Core Reference Tables

### 2.1 `clinics`
For single-clinic setup, this can hold the clinic profile and configuration.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| name | text | Clinic name |
| code | text | Optional clinic code |
| currency_code | text | `GHS` |
| patient_id_prefix | text | `CL` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 2.2 `departments`
Initial values: Laboratory, Scanning. Additional departments can be added later.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| name | text | Unique department name |
| code | text | Optional short code |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 2.3 `roles`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| name | text | Admin, Frontdesk, Laboratory, Scanning, Pharmacist, Accountant, Supervisor, custom |
| description | text | Optional |
| is_system_role | boolean | True for built-ins |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 2.4 `permissions`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| key | text | Unique permission key |
| description | text | Optional |
| created_at | timestamp |  |

### 2.5 `role_permissions`
Join table.

| Column | Type | Notes |
|---|---|---|
| role_id | FK |  |
| permission_id | FK |  |

### 2.6 `users`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK | Links to `clinics` |
| full_name | text |  |
| username | text | Unique |
| password_hash | text |  |
| phone | text | Optional |
| email | text | Optional |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 2.7 `user_roles`
Join table. A user can have one or more roles.

| Column | Type | Notes |
|---|---|---|
| user_id | FK |  |
| role_id | FK |  |

## 3. Patient and Visit Tables

### 3.1 `patients`
Stores the master patient record.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| patient_code | text | Auto-generated, prefix `CL` |
| surname | text | Required |
| first_name | text | Required |
| middle_name | text | Optional |
| sex | text | Suggested enum: male, female, other |
| age | integer | Age as captured at registration |
| phone | text | Required |
| referral_center | text | Required |
| insurance_status | text | insured / uninsured |
| reason_for_visit | text | Initial reason / investigation |
| emergency_contact_name | text | Required |
| emergency_contact_phone | text | Required |
| emergency_contact_relationship | text | Optional |
| is_minor | boolean | Optional flag |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 3.2 `patient_aliases`
Optional table for alternate spellings or previous names if needed later.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| patient_id | FK |  |
| alias_name | text |  |
| alias_phone | text | Optional |
| created_at | timestamp |  |

### 3.3 `visits`
Every attendance creates a new visit linked to an existing patient.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| patient_id | FK |  |
| visit_number | text | Human-readable visit reference |
| visit_date | date |  |
| visit_time | timestamp |  |
| status | text | registered, sent_to_department, in_progress, completed, awaiting_payment, paid, closed |
| frontdesk_user_id | FK | User who created the visit |
| notes | text | Optional |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 3.4 `visit_status_history`
Tracks status transitions.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| visit_id | FK |  |
| previous_status | text |  |
| new_status | text |  |
| changed_by_user_id | FK |  |
| reason | text | Optional |
| created_at | timestamp |  |

## 4. Services and Department Workflow

### 4.1 `services`
Service catalog maintained by admin.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| department_id | FK | One service maps to one department |
| service_code | text | Optional unique code |
| name | text | Required |
| description | text | Optional |
| price | decimal(12,2) | Current sale price |
| is_active | boolean |  |
| created_by_user_id | FK | Admin user |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.2 `visit_services`
Each requested or added service line for a visit.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| visit_id | FK |  |
| service_id | FK |  |
| source | text | frontdesk, department_added |
| unit_price | decimal(12,2) | Price captured at time of entry |
| quantity | integer | Default 1, allows repeat service billing |
| line_total | decimal(12,2) | unit_price x quantity |
| status | text | pending, in_progress, done, not_done |
| not_done_reason | text | Preset or free text |
| approved_by_patient | boolean | Required for extra services before saving |
| approved_at | timestamp | Optional |
| added_by_user_id | FK |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.3 `visit_service_events`
Optional audit trail for service-line changes.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| visit_service_id | FK |  |
| event_type | text | added, marked_done, marked_not_done, edited, approved |
| old_value | jsonb | Optional |
| new_value | jsonb | Optional |
| changed_by_user_id | FK |  |
| created_at | timestamp |  |

## 5. Result Template Model

This schema supports the table-style printable result form the clinic wants.

### 5.1 `service_result_templates`
One template per service, versioned if required.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| service_id | FK |  |
| template_name | text | Optional |
| version | integer |  |
| layout_type | text | table_based |
| layout_json | jsonb | Stores table rows/columns/print layout |
| is_active | boolean |  |
| created_by_user_id | FK |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 5.2 `service_result_template_sections`
Optional section grouping for report headers like Liver Function Tests.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| template_id | FK |  |
| title | text |  |
| sort_order | integer |  |
| created_at | timestamp |  |

### 5.3 `service_result_template_fields`
Defines rows/fields printed on the result form.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| template_id | FK |  |
| section_id | FK | Optional |
| field_key | text | Unique within template |
| label | text | e.g. Result, Unit, Evaluation, Min, Max |
| field_type | text | text, number, decimal, dropdown, checkbox, date |
| is_required | boolean |  |
| sort_order | integer |  |
| decimal_places | integer | Default 2 where applicable |
| unit_default | text | Optional |
| min_value | decimal(12,2) | Optional |
| max_value | decimal(12,2) | Optional |
| options_json | jsonb | For dropdown choices if needed |
| created_at | timestamp |  |

### 5.4 `visit_results`
Stores the actual results entered for a visit.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| visit_service_id | FK | One completed service result |
| template_id | FK | Which template was used |
| result_data_json | jsonb | Field values captured for the service |
| narrative_notes | text | Optional comments |
| entered_by_user_id | FK |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 6. Prescription Model

### 6.1 `prescriptions`
Free-text prescriptions created by labs/scans.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| visit_id | FK |  |
| created_by_user_id | FK | Department user |
| prescription_text | text | Main prescription note |
| status | text | active, dispensed, partially_dispensed, cancelled |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 6.2 `prescription_items`
Optional structured details for pharmacy processing.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| prescription_id | FK |  |
| medicine_name | text | Required item text |
| quantity | text | Optional free text or numeric |
| remarks | text | Optional |
| created_at | timestamp |  |

## 7. Clinic Billing Model

### 7.1 `clinic_invoices`
One invoice per visit.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| visit_id | FK | One invoice per visit |
| invoice_number | text | Unique human-readable number |
| subtotal | decimal(12,2) |  |
| total | decimal(12,2) |  |
| amount_paid | decimal(12,2) | Full payment expected |
| balance_due | decimal(12,2) | Should end at 0 |
| status | text | draft, issued, paid, cancelled |
| issued_by_user_id | FK | Frontdesk user |
| paid_at | timestamp |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 7.2 `clinic_invoice_items`
Line items for services.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| invoice_id | FK |  |
| visit_service_id | FK | Links to a service line |
| item_name | text | Snapshot name |
| quantity | integer |  |
| unit_price | decimal(12,2) |  |
| line_total | decimal(12,2) |  |
| created_at | timestamp |  |

### 7.3 `clinic_payments`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| invoice_id | FK |  |
| payment_method | text | cash, mobile_money |
| amount | decimal(12,2) | Full payment amount |
| reference_number | text | Optional mobile money ref |
| received_by_user_id | FK | Frontdesk user |
| paid_at | timestamp |  |
| created_at | timestamp |  |

## 8. Pharmacy Model

### 8.1 `pharmacy_products`
Master pharmacy product catalog.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| product_code | text | Optional unique code |
| name | text | Required |
| generic_name | text | Optional |
| unit_of_measure | text | e.g. tablet, bottle, vial |
| is_active | boolean |  |
| reorder_level | decimal(12,2) | Optional |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 8.2 `pharmacy_suppliers`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| name | text |  |
| phone | text | Optional |
| email | text | Optional |
| address | text | Optional |
| created_at | timestamp |  |

### 8.3 `pharmacy_product_batches`
Batch and expiry tracking.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| product_id | FK |  |
| supplier_id | FK | Optional |
| batch_number | text |  |
| expiry_date | date |  |
| purchase_price | decimal(12,2) |  |
| selling_price | decimal(12,2) |  |
| quantity_received | decimal(12,2) |  |
| quantity_remaining | decimal(12,2) |  |
| created_at | timestamp |  |

### 8.4 `pharmacy_stock_movements`
Tracks all stock increases and decreases.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| batch_id | FK | Optional if movement is not batch-specific |
| product_id | FK |  |
| movement_type | text | purchase, sale, adjustment, write_off, transfer |
| quantity | decimal(12,2) | Positive or negative depending on type |
| unit_cost | decimal(12,2) | Optional |
| reference_type | text | sale, purchase_order, adjustment, etc. |
| reference_id | uuid / bigint | Links to source record |
| created_by_user_id | FK |  |
| created_at | timestamp |  |

### 8.5 `pharmacy_purchase_orders`
Optional but recommended for robust stock control.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| supplier_id | FK |  |
| po_number | text |  |
| status | text | draft, ordered, received, cancelled |
| ordered_at | timestamp |  |
| received_at | timestamp | Optional |
| created_by_user_id | FK |  |
| created_at | timestamp |  |

### 8.6 `pharmacy_purchase_order_items`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| purchase_order_id | FK |  |
| product_id | FK |  |
| batch_number | text | Optional |
| expiry_date | date | Optional |
| quantity_ordered | decimal(12,2) |  |
| unit_cost | decimal(12,2) |  |
| line_total | decimal(12,2) |  |
| created_at | timestamp |  |

### 8.7 `pharmacy_sales`
Pharmacy transactions are separate from clinic invoices.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| sale_number | text | Unique sale reference |
| sale_source | text | walk_in, clinic_referred |
| visit_id | FK | Nullable; set for clinic-referred sales |
| prescription_id | FK | Nullable; links to clinic prescription if used |
| subtotal | decimal(12,2) |  |
| total | decimal(12,2) |  |
| payment_method | text | cash, mobile_money |
| status | text | draft, paid, cancelled |
| sold_by_user_id | FK | Pharmacist or cashier |
| paid_at | timestamp |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 8.8 `pharmacy_sale_items`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| sale_id | FK |  |
| product_id | FK |  |
| batch_id | FK | Optional |
| item_name | text | Snapshot |
| quantity | decimal(12,2) |  |
| unit_price | decimal(12,2) |  |
| line_total | decimal(12,2) |  |
| created_at | timestamp |  |

### 8.9 `pharmacy_payments`

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| sale_id | FK |  |
| payment_method | text | cash, mobile_money |
| amount | decimal(12,2) |  |
| reference_number | text | Optional |
| received_by_user_id | FK |  |
| paid_at | timestamp |  |
| created_at | timestamp |  |

## 9. Accounting and Reporting Support

### 9.1 `accounting_postings`
Optional summary ledger if you want easier reporting later.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| source_type | text | clinic_invoice, pharmacy_sale |
| source_id | uuid / bigint |  |
| posting_date | date |  |
| amount | decimal(12,2) |  |
| category | text | clinic, pharmacy |
| created_at | timestamp |  |

If you want a simpler V1, this table can be generated from invoices and sales instead of being stored directly.

## 10. Audit and Compliance

### 10.1 `audit_logs`
Tracks important system activity for six-year retention and accountability.

| Column | Type | Notes |
|---|---|---|
| id | uuid / bigint | PK |
| clinic_id | FK |  |
| actor_user_id | FK | User who performed action |
| action_type | text | create, update, delete, approve, payment, stock_move |
| entity_type | text | patient, visit, service, invoice, sale, product, etc. |
| entity_id | uuid / bigint | Target record |
| before_data | jsonb | Optional |
| after_data | jsonb | Optional |
| ip_address | text | Optional |
| created_at | timestamp |  |

## 11. Recommended Constraints
- `patients.phone` should be indexed for fast lookup.
- `patients.surname + patients.first_name + patients.phone` should be searchable for returning patients.
- `services.department_id` should be required.
- `visit_services` should allow multiple rows for the same service on the same visit.
- `clinic_invoices.visit_id` should be unique.
- `pharmacy_sales.visit_id` should be nullable.
- `pharmacy_sales.sale_source` should distinguish walk-in from clinic-referred sales.
- `result_data_json` should be validated against the stored template definition.
- `balance_due` should always end at zero for finalized clinic invoices.

## 12. Suggested Indexes
- `patients(phone)`
- `patients(surname, first_name)`
- `visits(patient_id, visit_date)`
- `visit_services(visit_id)`
- `services(department_id, is_active)`
- `clinic_invoices(invoice_number)`
- `pharmacy_sales(sale_number)`
- `pharmacy_product_batches(product_id, expiry_date)`
- `audit_logs(entity_type, entity_id)`

## 13. Minimal V1 Table Set
If you want the leanest possible first release, the minimum tables are:
- clinics
- departments
- roles
- permissions
- role_permissions
- users
- user_roles
- patients
- visits
- visit_status_history
- services
- visit_services
- service_result_templates
- service_result_template_fields
- visit_results
- prescriptions
- prescription_items
- clinic_invoices
- clinic_invoice_items
- clinic_payments
- pharmacy_products
- pharmacy_suppliers
- pharmacy_product_batches
- pharmacy_stock_movements
- pharmacy_sales
- pharmacy_sale_items
- pharmacy_payments
- audit_logs

## 14. Next Refinement Options
Possible follow-up drafts:
- SQL DDL for PostgreSQL
- ER diagram
- table-by-table migration order
- API endpoint map from the schema
