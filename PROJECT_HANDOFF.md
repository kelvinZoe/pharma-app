# Pharma Flow Project Handoff

Last updated: 2026-08-19

## Overview

Pharma Flow is a multi-tenant clinic/pharmacy management app with:

- Angular frontend hosted on Vercel.
- NestJS backend hosted on Render.
- PostgreSQL database hosted on Supabase.
- Resend used for staff invitation emails.

Repository: `https://github.com/kelvinZoe/pharma-app`

## Project Structure

- `frontend/` — Angular app.
- `backend/` — NestJS API.
- `backend/prisma/schema.prisma` — Prisma schema.
- `backend/prisma/migrations/` — old migration history exists, but see DB warning below.

## Important Production URLs

- Frontend: `https://pharma-uci.com`
- Backend: hosted on Render.
- API from frontend uses `/api` in production, so Vercel rewrites/proxy configuration should point to the Render backend.

## Render Backend Environment

Render backend needs backend env vars. Current known required vars:

- `DATABASE_URL` — Supabase/Postgres connection string.
- `JWT_SECRET` — JWT signing secret.
- `RESEND_API_KEY` — Resend API key.
- `EMAIL_FROM` — verified sender for Resend.
- `ALLOWED_ORIGINS=https://pharma-uci.com` — allowed frontend origins for CORS.
- `FRONTEND_URL=https://pharma-uci.com` — required for invitation/reset links.
- `PORT` — Render usually provides this automatically; if set manually, prefer uppercase `PORT`, not lowercase `port`.
- `ALLOW_PUBLIC_CLINIC_REGISTRATION` — optional; public tenant registration is disabled in production unless this is exactly `true`.

If invitation emails ever show `localhost`, check `FRONTEND_URL` on Render first.

## Build & Deploy

### Frontend

Vercel is connected to GitHub and auto-deploys on push to `main`.

Useful command:

```bash
cd frontend
npm run build
```

### Backend

Render should be connected to the same GitHub repo and branch.

Recommended Render settings:

- Root Directory: `backend`
- Build Command: `npm install --production=false && npx prisma generate && npm run build`
- Start Command: `npm run start:prod`
- Auto-Deploy: On Commit

Useful commands:

```bash
cd backend
npx prisma generate
npm run build
```

## Critical Prisma / Database State

Do not casually run Prisma migrations right now.

The project started with a SQLite migration history, but production now uses PostgreSQL. Because of that:

```bash
npx prisma migrate deploy
```

fails with a provider mismatch because `backend/prisma/migrations/migration_lock.toml` says `sqlite` while `schema.prisma` says `postgresql`.

Current safe rule:

- Use `npx prisma generate` after Prisma schema changes.
- Do not run `prisma migrate dev` or `prisma migrate deploy` until the migration history is properly baselined for Postgres.

Production DB patch already applied manually:

- `User.roles` column was added/backfilled in Supabase/Postgres using SQL.
- Migration file exists at `backend/prisma/migrations/20260609181500_add_user_roles/migration.sql`, but normal Prisma migration deployment is blocked by the provider mismatch.

Patient fields did not require a DB patch because the optional fields are already nullable in Prisma.

Pharmacy development now uses ordered manual Postgres patches. Apply any missing files with `npx prisma db execute --file ...` rather than Prisma migrate commands. The current pharmacy patch order is:

1. `backend/prisma/migrations/20260803120000_add_pharmacy_locations/migration.sql`
2. `backend/prisma/migrations/20260803150000_add_pharmacy_catalogue_and_receiving/migration.sql`
3. `backend/prisma/migrations/20260804150000_expand_pharmacy_catalogue/migration.sql`
4. `backend/prisma/migrations/20260804190000_add_pharmacy_suppliers/migration.sql`
5. `backend/prisma/migrations/20260804210000_add_pharmacy_purchase_orders/migration.sql`
6. `backend/prisma/migrations/20260805100000_add_pharmacy_payables_and_returns/migration.sql`
7. `backend/prisma/migrations/20260805150000_add_pharmacy_inventory_control/migration.sql`
8. `backend/prisma/migrations/20260805190000_add_pharmacy_stock_transfers/migration.sql`
9. `backend/prisma/migrations/20260806100000_add_pharmacy_network_replenishment/migration.sql`
10. `backend/prisma/migrations/20260814100000_separate_pharmacy_medicines_and_products/migration.sql`
11. `backend/prisma/migrations/20260817120000_strengthen_financial_controls/migration.sql`
12. `backend/prisma/migrations/20260819120000_security_financial_integrity/migration.sql`

Apply the latest catalogue patch from the backend directory, then regenerate Prisma Client:

```bash
cd backend
npx prisma db execute --file prisma/migrations/20260814100000_separate_pharmacy_medicines_and_products/migration.sql
npx prisma db execute --file prisma/migrations/20260817120000_strengthen_financial_controls/migration.sql
npx prisma db execute --file prisma/migrations/20260819120000_security_financial_integrity/migration.sql
npx prisma generate
```

The latest patch separates clinical medicine definitions from commercial products while preserving existing product IDs, batches, stock movements, and sales. It adds structured medicine strength, package definitions, branch sale controls, and automatic compatibility backfill for existing products.

Future recommended cleanup:

- Create a proper Postgres baseline migration history.
- Mark existing production schema as baseline.
- Only then re-enable `prisma migrate deploy` in Render.

## Security and Financial Integrity State

The 19 August 2026 hardening pass closes the identified P0/P1 application risks:

- Verified JWT tenant context and fail-closed tenant scoping.
- Role and department restrictions for patient, visit, result, pricing, billing, pharmacy, and financial routes.
- Atomic cashier/register opening, closing, payment, sale, void, count, adjustment, transfer, and quarantine transitions.
- Maker-checker controls for price adjustments, voids, purchase orders, supplier payments/returns, counts, adjustments, and transfer decisions.
- Normalized unique payment and supplier references, bounded reports/exports, CSV formula neutralization, and expanded audit coverage.
- Soft deactivation for staff and templates instead of destructive history removal.

The source-of-truth checklist is `SECURITY_FINANCIAL_REMEDIATION_TODO.md`. Apply `20260819120000_security_financial_integrity` to staging before deployment, then run the listed workflow smoke tests. The unchecked P2 items require dedicated architecture work and must not be treated as already delivered.

## Current Feature State

### Pharmacy Catalogue Architecture

- **Medicine Library** stores tenant-wide clinical identity: generic name, structured strength, dosage form, route, therapeutic class, and supply category.
- **Product Catalogue** stores commercial SKUs: linked medicine, brand, manufacturer, barcode, package conversion, selling unit, loose-sale rule, and minimum sale quantity.
- **PharmacyLocationProduct** stores branch controls: sale availability, current selling price, reorder level, and shelf or bin.
- **PharmacyBatch** stores receipt-specific stock: supplier batch, expiry, acquisition cost, received quantity, and remaining quantity.
- Existing product rows are backfilled into one medicine definition per product so historical batch, movement, sale, and reporting links remain intact.

### Pharmacy POS Hardening and Redesign

- The POS now uses a focused Sale, Transactions, and Close Shift workspace.
- Product search includes medicine name, generic, brand, product code, and barcode.
- Selecting a medicine adds it directly to the cart; cashiers adjust only the quantity.
- Checkout allocates stock automatically across safe batches using FEFO.
- `PharmacyLocationProduct.defaultSellingPrice` is the authoritative current price for a medicine at a shop. Catalogue edits, direct batch intake, and goods receipts synchronize all old and new batches at that location while preserving historical sale prices.
- Cash checkout captures tendered amount and calculates change; Mobile Money requires a non-duplicate location reference.
- Pharmacy prescription queues and digital prescription-to-sale linking have been removed. Laboratory and scan prescription notes remain attached to the visit and print on the diagnostic report for manual pharmacy entry.
- Recent location sales can be reopened and reprinted from server data in 58 mm or 80 mm format.
- Pharmacy and clinic void endpoints now require admin or accounting access.
- Voided pharmacy stock defaults to quarantine for inspection, with an explicit sellable-stock option for controlled-custody mistakes.
- Pharmacy register totals are recalculated after a void, including already closed sessions.
- This POS update does not require another SQL patch.

### Multi-Role Staff Accounts

Staff users now support multiple roles.

- Prisma field: `User.roles String @default("1")`
- Stored as comma-separated role codes, e.g. `"1,2,4"`.
- Backend returns `roles: number[]` to frontend.
- Primary `role` remains for backward compatibility and active module routing.

Role codes:

- `0` — Admin
- `1` — Frontdesk
- `2` — Laboratory
- `3` — Scanning/Radiology
- `4` — Pharmacy
- `5` — Accounting

Admin role behavior:

- If `Role 0` is selected, roles `1–5` are automatically unchecked.
- If any non-admin role is selected, admin is automatically unchecked.
- Admin sees all modules.

Main files:

- `backend/src/users/users.service.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `frontend/src/app/core/auth/session.service.ts`
- `frontend/src/app/features/admin/pages/admin-users-page.component.ts`

### Staff Invitation Flow

When an admin creates a staff user:

- Backend creates a dummy password hash.
- Backend creates a 48-hour invite token.
- User is created with `isVerified: false`.
- Resend sends an activation email.
- User completes invite at `/auth/verify-invite?token=...`.

Invitation links are generated from:

- `FRONTEND_URL` env var, falling back to `https://pharma-uci.com`.

Main file:

- `backend/src/common/email/email.service.ts`

### Resend Invitation

Admins can resend invitations for unverified users.

- Backend endpoint: `POST /api/users/:id/resend-invitation`
- Generates a fresh token.
- Extends expiry by 48 hours.
- Does not allow resend if the user is already verified.
- Frontend shows `Resend Invite` only for pending/unverified users.

Main files:

- `backend/src/users/users.controller.ts`
- `backend/src/users/users.service.ts`
- `frontend/src/app/core/services/api.service.ts`
- `frontend/src/app/features/admin/pages/admin-users-page.component.ts`
- `frontend/src/app/shared/ui/app-table/app-table.component.ts`

### Generated Usernames

Admins no longer type usernames manually for staff accounts.

Backend generates tenant-aware usernames:

```text
{tenantInitials}-{firstInitial}{surname}
```

Examples:

- `sfc-karthur`
- `dcdp-amensah`

If a username already exists, backend appends a number:

- `sfc-karthur2`
- `sfc-karthur3`

Main file:

- `backend/src/users/users.service.ts`

### Email or Username Login

Users can sign in with either:

- Email address
- Generated username

The backend detects email by checking for `@`; otherwise it searches by `username`.

Main files:

- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `frontend/src/app/features/auth/pages/login-page.component.ts`
- `frontend/src/app/features/auth/pages/login-page.component.html`
- `frontend/src/app/core/auth/session.service.ts`

### Patient Registration Changes

Frontdesk patient registration currently requires:

- Surname
- First name
- Phone
- Referral center/doctor

Optional:

- Reason for visit
- Emergency contact name
- Emergency contact phone
- Emergency contact relationship

Main files:

- `backend/src/visits/visits.service.ts`
- `frontend/src/app/features/frontdesk/pages/frontdesk-registration-page.component.ts`

### Patient Demographics and Results Corrections

- **Edit Patient Demographics**: Frontdesk staff can correct patient demographic details (surname, first name, middle name, phone, sex, age, referral center, insurance details, and emergency contacts) inside the Client Directory detail modal.
  - Main files:
    - `backend/src/visits/visits.service.ts`
    - `frontend/src/app/features/frontdesk/pages/frontdesk-clients-page.component.ts`

- **Edit Diagnostic Results**: Laboratory and Scanning technicians can correct finalized clinical results/notes directly from their department's History & Archives views.
  - Main files:
    - `backend/src/visits/visits.service.ts`
    - `frontend/src/app/features/department-worklist/pages/worklist-results-page.component.ts`

### Visit Deletion and Auditing

- **Delete Untouched Visit Registration**: Frontdesk staff can delete only a registration that has no payment or clinical work.
  - The visit status is changed to `'deleted'` (soft-deleted).
  - Any associated unpaid draft invoice is marked `'voided'`; payment records are never silently voided.
  - Registrations with results, prescriptions, service progress, or payment history must remain in the clinical and financial record.
  - Detailed patient before/after snapshot is recorded in the `AuditLog` table.
  - Main files:
    - `backend/src/visits/visits.service.ts`
    - `backend/src/visits/visits.controller.ts`
    - `frontend/src/app/features/frontdesk/pages/frontdesk-visits-page.component.ts`

- **Admin Audit Logs View**: Administrators can review all system operations (including deleted registrations, voided payments, etc.) under the dedicated "Audit Logs" tab in the Admin Financial summary area.
  - Main files:
    - `backend/src/reports/reports.service.ts`
    - `backend/src/reports/reports.controller.ts`
    - `frontend/src/app/features/admin/pages/admin-financials-page.component.ts`

## Recent Commits

- `8274acc feat: implement patient edits, diagnostic outcomes adjustments, registration soft-delete, and admin audit log tabs`
- `b4cda7f fix: use production frontend URL for invites`
- `96afb06 feat: improve staff invitations and username login`
- `b2c96f6 chore: remove login test credentials`
- `31ba0e8 feat: add multi-role support for users, update user model and authentication logic, and enhance UI forms for role selection`

## Known Operational Notes

- GitHub Actions is not currently used for deployment.
- Vercel deploys frontend directly from GitHub.
- Render deploys backend directly from GitHub if auto-deploy is enabled.
- If Render does not deploy after push, check Render service settings:
  - Repository
  - Branch
  - Root Directory
  - Auto-Deploy
  - Build Filters

## Recommended Smoke Tests After Deploy

1. Login as admin using email.
2. Login as admin using generated username if applicable.
3. Create a new staff user with non-admin multi-role access.
4. Confirm generated username appears in staff table.
5. Confirm invite email link points to Vercel, not localhost.
6. Complete invite and set password.
7. Login with generated username.
8. Create an admin user and confirm only role `0` is stored/selected.
9. Use `Resend Invite` for an unverified user.
10. Register a patient with referral filled and reason/emergency fields empty.
11. Navigate to **Frontdesk -> Clients**, select a patient, click **Edit Demographics**, make a correction, and check if it updates the directory.
12. Navigate to **Laboratory -> History & Archives**, select a finalized visit, click **Edit Results**, modify values, and check if the printable report reflects changes.
13. Navigate to **Frontdesk -> Visits Ledger**, click the delete icon on a visit, and check if it is soft-deleted and disappears from lists.
14. Navigate to **Admin -> Financial Summary**, select the **Audit Logs** tab, and verify that the deletion event is logged with detailed metadata.
15. Post a pharmacy goods receipt and confirm a supplier invoice is created for its full receipt value.
16. Record a partial supplier payment and confirm the payable balance changes and a linked `supplier_payment` expense appears in Financial Summary.
17. Return part of the original received batch and confirm stock, invoice credit, and supplier statement update together.
18. Print a supplier statement and confirm invoices, payments, returns, opening balance, and running balance reconcile.
19. Start a cycle count, enter physical quantities, submit it, and confirm only an administrator can approve and post the variance.
20. Request damaged, expired, loss, correction-in, and correction-out adjustments and confirm stock changes only after approval.
21. Open **Stock Control → Stock ledger** and confirm each posted movement shows before, change, after, source, reason, and user.
22. Create and submit a transfer from one pharmacy location to another, approve it, and confirm the approved quantity is no longer sellable at the source.
23. Dispatch the transfer and confirm a `transfer_out` movement is recorded without revenue or expense.
24. Switch to the destination, receive the exact quantity, and confirm destination stock and the `transfer_in` movement.
25. Receive a second transfer with a shortage, confirm it enters discrepancy review, and resolve it by return-to-source or write-off.
26. Configure reorder, safety stock, lead time, and cover policies for one medicine at two locations.
27. Open **Network Stock** and confirm On Hand, Available, Reserved, In Transit, Quarantined, and Expired quantities are distinct.
28. Create a transfer from a replenishment recommendation and confirm it still requires normal approval.
29. Try selecting a later-expiry batch before an available earlier-expiry batch and confirm FEFO blocks the request unless an administrator supplies an override reason.
30. Receive part of a transfer into quarantine and confirm those units remain physically on hand but cannot be sold or transferred.
31. Release part of quarantined stock, write off another part, and confirm both actions appear in the stock ledger.
32. Print the transfer request, dispatch note, and receipt and confirm route, batch, expiry, quantity, storage, and signature fields are present.
33. Open a pharmacy register, complete one cash sale, and confirm tendered amount and change are shown correctly.
34. Complete one Mobile Money sale and confirm a duplicate reference is rejected at the same pharmacy location.
35. Reprint both sales from **POS Sales → Transactions** and confirm the original receipt number, sale time, cashier, location, and payment reference are preserved.
36. Sell a quantity larger than the earliest-expiring batch and confirm checkout allocates the balance from the next safe batch automatically.
37. Change a medicine's current shop price and confirm old and new batches use that price while earlier completed receipts retain their historical price.
38. Void a sale as admin/accounting, choose quarantine, and confirm stock is on hand but unavailable until quarantine resolution.
39. Confirm a pharmacy user without admin/accounting access cannot call the void endpoint.
40. Close a shift and confirm expected cash includes opening float; print the closure and confirm cashier and channel totals are present.

## High-Risk Areas

- Prisma migration history/provider mismatch.
- Tenant-aware username uniqueness is implemented globally using raw SQL lookup to avoid cross-tenant ambiguity during username login.
- Invitation and password-reset links depend on Render env var `FRONTEND_URL`.
- Backend deployment must happen for auth/invite/user changes to take effect; frontend deployment alone is not enough.
