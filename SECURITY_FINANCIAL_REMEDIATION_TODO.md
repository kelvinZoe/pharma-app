# PharmaFlow Security and Financial Remediation TODO

Last reviewed: 2026-08-19

This checklist tracks the financial, tenant-isolation, pharmacy, and availability risks found during the security review. A task is complete only when the API enforces the rule; hiding a frontend action is not sufficient.

## Status Summary

- All identified P0 and P1 application controls are implemented and locally verified.
- The production Postgres patch is prepared but must still be applied and smoke-tested in staging before deployment.
- Unchecked P2 items are larger architecture upgrades and remain explicit follow-up work; they are not being represented as complete.

## P0 — Authorization and Financial Integrity

- [x] Restrict patient, visit, result, prescription, service, and price-adjustment endpoints by role.
  - Acceptance: direct API calls from an unrelated authenticated role return `403`.
- [x] Prevent deletion of visits with posted payments or completed clinical work.
  - Acceptance: registration deletion never silently voids revenue or clinical records.
- [x] Separate price-adjustment requester and approver.
  - Acceptance: adjustments only increase the original charge, cannot change a paid invoice, and cannot be self-approved.
- [x] Make clinic payment voids atomic and closed-period safe.
  - Acceptance: concurrent void requests affect the invoice once; closed cashier sessions cannot be rewritten.
- [x] Make pharmacy sale voids atomic and closed-period safe.
  - Acceptance: concurrent void requests restock once; returned stock always enters quarantine.
- [x] Remove the expense hard-delete compatibility route and enforce maker-checker voiding.
  - Acceptance: expenses remain in the ledger and the creator cannot approve their own void.

## P0 — Tenant and Authentication Boundary

- [x] Build tenant context only from a verified JWT.
  - Acceptance: a forged token payload cannot select another tenant before the auth guard runs.
- [x] Fail closed when tenant context is missing for tenant-scoped Prisma operations.
  - Acceptance: protected tenant data cannot be queried without a verified tenant identifier.
- [x] Remove the predictable production JWT fallback secret.
  - Acceptance: production startup fails clearly when `JWT_SECRET` is missing.
- [x] Restrict public clinic registration in production.
  - Acceptance: registration requires `ALLOW_PUBLIC_CLINIC_REGISTRATION=true` outside development.
- [x] Add request-size limits and rate limits to authentication and reporting endpoints.
  - Acceptance: oversized requests return `413`; repeated sensitive requests return `429`.

## P0 — Session and Payment Concurrency

- [x] Atomically open and close clinic cashier sessions.
  - Acceptance: one user cannot have two open clinic sessions and payment cannot race a close.
- [x] Atomically open and close pharmacy register sessions.
  - Acceptance: one user/location cannot have two open registers and a sale cannot race a close.
- [x] Normalize and uniquely protect mobile-money and supplier-payment references.
  - Acceptance: whitespace/case variants and concurrent duplicates are rejected.
- [x] Add database constraints for one open session and unique live payment references.
  - Acceptance: Postgres enforces invariants even if application checks are bypassed.

## P1 — Pharmacy Pricing and Procurement

- [x] Restrict catalogue, price, supplier, and direct procurement mutations to administrators.
  - Acceptance: pharmacy cashiers cannot alter prices or supplier master data.
- [x] Require finite selling prices greater than zero and a reason for price changes.
  - Acceptance: zero, `NaN`, negative, and unaudited price changes are rejected.
- [x] Disable the legacy direct-batch endpoint.
  - Acceptance: all stock receipts use the goods-receipt ledger.
- [x] Require an approved purchase order for non-admin goods receipts.
  - Acceptance: direct receipt is admin-only and requires a documented override reason.
- [x] Stop goods receipt lines from silently repricing existing shop stock.
  - Acceptance: receiving records acquisition cost while retail price changes through the catalogue workflow.
- [x] Protect supplier invoice numbers against duplicates per supplier.
  - Acceptance: normalized duplicate invoice numbers cannot create duplicate liabilities.
- [x] Restrict supplier returns to an independent approver.
  - Acceptance: pharmacy cashiers cannot unilaterally reduce stock and supplier liability.
- [x] Audit purchase orders, goods receipts, supplier payments, returns, and price changes.
  - Acceptance: every material mutation records actor, before/after state, and reference.

## P1 — Privacy and Scope

- [x] Scope clinic closure lists and details by role and cashier.
  - Acceptance: frontdesk sees only their sessions; accounting/admin can see tenant-wide sessions.
- [x] Scope supplier details and statements to the active pharmacy location for pharmacy users.
  - Acceptance: location-bound users cannot inspect another branch through direct API calls.
- [x] Clamp every page size and bound closure/list endpoints.
  - Acceptance: callers cannot request unbounded tenant datasets.

## P1 — Reporting and Export Safety

- [x] Bound financial report date ranges and default them to a safe window.
  - Acceptance: interactive requests cannot scan more than one year.
- [x] Replace full-row financial summary loads with aggregate/minimal-field queries.
  - Acceptance: summary memory use grows linearly and avoids product-by-batch nested scans.
- [x] Remove the duplicate dashboard summary request.
  - Acceptance: selecting the dashboard issues one summary request.
- [x] Move large exports to bounded, paged retrieval.
  - Acceptance: export cannot request 10,000 records in one browser call.
- [x] Neutralize spreadsheet formulas in CSV exports.
  - Acceptance: values beginning with `=`, `+`, `-`, or `@` open as text.

## P1 — Audit and Database Support

- [x] Index audit logs by tenant and creation time.
- [x] Add a Postgres manual SQL patch for the new constraints and indexes.
- [x] Document that production uses `prisma db execute`, not the SQLite migration chain.
- [x] Make stock counts, stock adjustments, transfers, and quarantine resolutions atomic and maker-checker protected.
- [x] Soft-deactivate users instead of deleting identities referenced by financial and audit records.
- [x] Clamp the staff directory, protect the last active administrator, and prevent administrator self-demotion through the management route.
- [x] Keep invitation tokens out of normal user-management API responses.
- [x] Audit clinic service setup and validate tenant-owned departments, services, and templates.
- [x] Soft-deactivate general service templates and audit result-template changes.

## P2 — Follow-up Hardening

- [ ] Replace floating-point monetary calculations with decimal/minor-unit helpers end to end.
- [ ] Add configurable accounting period locks and an approved reversal workflow.
- [ ] Add explicit idempotency keys for all payment and stock-posting commands.
- [ ] Replace numeric role checks with named permissions and centrally enforced decorators.
- [ ] Add database row-level security as a second tenant-isolation layer.
- [x] Require tenant slug or another unambiguous tenant selector for username login.

## Verification

- [x] Run targeted backend authorization, race, void, and reporting tests.
- [x] Run `npm run build` in `backend`.
- [x] Run `npm run build` in `frontend`.
- [ ] Apply the manual SQL patch to a staging Postgres database and verify constraints.
- [ ] Exercise clinic payment, pharmacy sale, closing, voiding, receiving, and export flows in staging.
