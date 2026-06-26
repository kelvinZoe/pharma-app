# Pharma Flow Project Handoff

Last updated: 2026-06-10

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

Future recommended cleanup:

- Create a proper Postgres baseline migration history.
- Mark existing production schema as baseline.
- Only then re-enable `prisma migrate deploy` in Render.

## Current Feature State

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

- **Delete/Void Visit Registration**: Frontdesk staff can delete a visit registration from the Visits Ledger.
  - The visit status is changed to `'deleted'` (soft-deleted).
  - Associated invoices and payments are updated to `'voided'`.
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

## High-Risk Areas

- Prisma migration history/provider mismatch.
- Tenant-aware username uniqueness is implemented globally using raw SQL lookup to avoid cross-tenant ambiguity during username login.
- Invitation and password-reset links depend on Render env var `FRONTEND_URL`.
- Backend deployment must happen for auth/invite/user changes to take effect; frontend deployment alone is not enough.
