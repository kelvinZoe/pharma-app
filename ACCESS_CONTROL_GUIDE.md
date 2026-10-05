# Pharma UCI Access Control Guide

Last updated: 5 October 2026

## What Changed

Protected backend endpoints now declare named permissions with `@RequirePermissions(...)`. `PermissionsGuard` checks them after `JwtAuthGuard` verifies the token and reloads the staff member's current database roles. A permission is not granted by a request body, query parameter, location header, frontend button, or token permission claim.

The six existing staff roles and stored role codes remain unchanged. No database patch or staff reassignment is needed. The permission policy is currently fixed in code; this release does not introduce custom roles or a permission-editing screen.

## Staff Access Summary

| Role | Normal access | Important restrictions |
| --- | --- | --- |
| Administrator (`0`) | All defined permissions within their tenant | Cannot bypass tenant isolation, period locks, independent approval, or stock safety rules |
| Frontdesk (`1`) | Patient registration/history, visits, clinic payments, own cashier sessions, extra-service approvals | Cannot view tenant-wide financial reports, manage staff/catalogue, post pharmacy sales, or perform diagnostics |
| Laboratory (`2`) | Clinical queue, lab results, service work, price-adjustment requests, printed prescription notes | Limited to laboratory work; cannot collect payments or approve charge adjustments |
| Scanning (`3`) | Clinical queue, scan results, service work, price-adjustment requests, printed prescription notes | Limited to scanning work; cannot collect payments or approve charge adjustments |
| Pharmacy (`4`) | Assigned-shop inventory, sales/register, stock receiving against approved orders, transfer/count/adjustment preparation, procurement reads | Cannot reprice products, approve stock changes/transfers, record supplier settlements/returns, or view unrestricted financial reports |
| Accounting (`5`) | Financial reports, expenses, reversals, period locks, clinic payments/sessions, supplier settlements/returns, pharmacy stock/procurement reads | Cannot manage staff, change catalogue prices, approve pharmacy stock changes, or operate pharmacy POS |

All valid roles retain their own profile/password controls, notifications, clinic settings reads, clinical catalogue reads, and assigned dashboard access. These shared reads do not grant administration or unrestricted patient access.

Multiple assigned roles combine their permissions. Selecting a workspace affects the working view and clinical department context; it does not grant an unassigned role. An administrator retains administrator permissions while using a valid diagnostic or pharmacy workspace.

## Data Boundaries Still Apply

- Every protected request must have a verified, active tenant-associated identity.
- A pharmacy cashier still needs an active pharmacy-location assignment. Setting another branch's header does not grant access. Administrators and accounting staff can review tenant-wide pharmacy locations.
- Frontdesk closure reads remain restricted to their own sessions. Administrators/accounting can review tenant-wide clinic closures.
- Clinical work remains scoped by the active laboratory or scanning department.
- Maker-checker rules remain enforced in the services. A permission to review does not let the requester, original cashier, or invoice recorder approve their own restricted action.
- Accounting-period locks, balance checks, FEFO allocation, quarantine, and payment-retry safeguards remain independent of permission grants.
- An existing token does not retain a revoked role: the next protected request reloads current staff assignments. Deactivated accounts are rejected.

Malformed role data is rejected instead of being coerced into administrator code `0`. Blank strings, booleans, unknown codes, and invalid mixed role lists are not valid assignments. Existing records with a null roles list may still use their valid primary role.

## Developer Rules

1. Add a named `Permission` and its approved role assignment in `backend/src/auth/authorization/permissions.ts` when a new capability is required.
2. Use `@UseGuards(JwtAuthGuard, PermissionsGuard)` on the protected controller, in that order. Both guards also apply to `/auth/profile` at method level.
3. Declare `@RequirePermissions(Permission.YourCapability)` on each protected handler. Missing, empty, or unknown permission metadata is denied, including for administrators.
4. Multiple declared permissions are all required. Controller and method requirements combine; a method cannot weaken a controller requirement.
5. Use `hasPermission(...)` for contextual read-all/override decisions and the shared `Role`/role-parsing helpers for stored-role and department handling. Do not reintroduce local numeric authorization arrays.
6. Keep resource ownership, tenant/location checks, independent approval, and transactional invariants in the service layer.
7. Update the reviewed route-access snapshot in `backend/test/fixtures/route-permissions.json` when adding a protected route or intentionally changing its approved access. Tests compare all 137 current protected handlers against the six-role baseline and verify guard ordering.

Public login, clinic-registration, invitation-verification, password-reset, and health endpoints retain their separate authentication/token/rate-limit controls. Do not add a public route to bypass an existing permission.

## Verification

```sh
cd backend
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand permissions-http
```

The HTTP permission suite boots the actual route/guard configuration with genuine signed JWTs and mocked data. It does not connect to the operational database. It checks direct-request denials, current-role revocation, administrator workspace switching, multiple assigned roles, profile/notification/settings access, and branch rejection. PostgreSQL payment/accounting regression suites additionally require a disposable localhost `TEST_DATABASE_URL` ending in `_test`.

Database row-level security remains a separate follow-up item. Application permission guards are not being represented as database RLS.
