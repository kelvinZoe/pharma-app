export enum Role {
  Admin = 0,
  Frontdesk = 1,
  Laboratory = 2,
  Scanning = 3,
  Pharmacy = 4,
  Accounting = 5,
}

export enum Permission {
  ProfileRead = 'profile.read',
  ProfileUpdate = 'profile.update',
  PasswordChange = 'profile.password.change',
  NotificationsRead = 'notifications.read',
  NotificationsUpdate = 'notifications.update',
  SettingsRead = 'settings.read',
  SettingsManage = 'settings.manage',
  StaffRead = 'staff.read',
  StaffManage = 'staff.manage',
  ClinicalCatalogueRead = 'clinical.catalogue.read',
  ClinicalCatalogueManage = 'clinical.catalogue.manage',
  PatientRead = 'patients.read',
  PatientManage = 'patients.manage',
  VisitRead = 'visits.read',
  VisitManage = 'visits.manage',
  ClinicalServicePerform = 'clinical.services.perform',
  ClinicalServiceApprove = 'clinical.services.approve',
  ClinicalServiceRemove = 'clinical.services.remove',
  ClinicalPriceRequest = 'clinical.prices.request',
  ClinicalPriceApprove = 'clinical.prices.approve',
  ClinicalResultWrite = 'clinical.results.write',
  ClinicalPrescriptionWrite = 'clinical.prescriptions.write',
  ClinicInvoiceRead = 'clinic.invoices.read',
  ClinicPaymentCreate = 'clinic.payments.create',
  ClinicSessionRead = 'clinic.sessions.read',
  ClinicSessionManage = 'clinic.sessions.manage',
  ClinicSessionReadAll = 'clinic.sessions.read-all',
  DashboardRead = 'dashboard.read',
  FinancialReportsRead = 'financial.reports.read',
  FinancialPaymentVoid = 'financial.payments.void',
  AuditRead = 'audit.read',
  AccountingPeriodRead = 'accounting.periods.read',
  AccountingPeriodLock = 'accounting.periods.lock',
  FinancialReversalRead = 'financial.reversals.read',
  FinancialReversalRequest = 'financial.reversals.request',
  FinancialReversalReview = 'financial.reversals.review',
  ExpenseRead = 'expenses.read',
  ExpenseCreate = 'expenses.create',
  ExpenseVoid = 'expenses.void',
  PharmacyStockRead = 'pharmacy.stock.read',
  PharmacyPosStockRead = 'pharmacy.pos-stock.read',
  PharmacyStockPolicyManage = 'pharmacy.stock-policy.manage',
  PharmacyQuarantineResolve = 'pharmacy.quarantine.resolve',
  PharmacyTransferRead = 'pharmacy.transfers.read',
  PharmacyTransferManage = 'pharmacy.transfers.manage',
  PharmacyTransferApprove = 'pharmacy.transfers.approve',
  PharmacyTransferDispatch = 'pharmacy.transfers.dispatch',
  PharmacyTransferReceive = 'pharmacy.transfers.receive',
  PharmacyCountRead = 'pharmacy.counts.read',
  PharmacyCountManage = 'pharmacy.counts.manage',
  PharmacyCountApprove = 'pharmacy.counts.approve',
  PharmacyAdjustmentRead = 'pharmacy.adjustments.read',
  PharmacyAdjustmentRequest = 'pharmacy.adjustments.request',
  PharmacyAdjustmentApprove = 'pharmacy.adjustments.approve',
  PharmacyPayablesRead = 'pharmacy.payables.read',
  PharmacyInvoiceManage = 'pharmacy.invoices.manage',
  PharmacySupplierPaymentCreate = 'pharmacy.supplier-payments.create',
  PharmacySupplierReturnCreate = 'pharmacy.supplier-returns.create',
  PharmacySupplierRead = 'pharmacy.suppliers.read',
  PharmacySupplierManage = 'pharmacy.suppliers.manage',
  PharmacyPurchaseOrderRead = 'pharmacy.purchase-orders.read',
  PharmacyPurchaseOrderManage = 'pharmacy.purchase-orders.manage',
  PharmacyPurchaseOrderApprove = 'pharmacy.purchase-orders.approve',
  PharmacyLocationsRead = 'pharmacy.locations.read',
  PharmacyLocationsReadAll = 'pharmacy.locations.read-all',
  PharmacyLocationsManage = 'pharmacy.locations.manage',
  PharmacyCatalogueRead = 'pharmacy.catalogue.read',
  PharmacyCatalogueManage = 'pharmacy.catalogue.manage',
  PharmacyGoodsReceiptRead = 'pharmacy.goods-receipts.read',
  PharmacyGoodsReceiptCreate = 'pharmacy.goods-receipts.create',
  PharmacyGoodsReceiptOverride = 'pharmacy.goods-receipts.override',
  PharmacySaleCreate = 'pharmacy.sales.create',
  PharmacySaleRead = 'pharmacy.sales.read',
  PharmacyRegisterRead = 'pharmacy.register.read',
  PharmacyRegisterManage = 'pharmacy.register.manage',
  PharmacyClosureRead = 'pharmacy.closures.read',
}

const allRoles = Object.values(Role).filter(
  (value): value is Role => typeof value === 'number',
);
const admin = [Role.Admin];
const finance = [Role.Admin, Role.Accounting];
const clinicCash = [Role.Admin, Role.Frontdesk, Role.Accounting];
const registration = [Role.Admin, Role.Frontdesk];
const clinical = [Role.Admin, Role.Frontdesk, Role.Laboratory, Role.Scanning];
const diagnostic = [Role.Admin, Role.Laboratory, Role.Scanning];
const pharmacyRead = [Role.Admin, Role.Pharmacy, Role.Accounting];
const pharmacyWork = [Role.Admin, Role.Pharmacy];

const permissionRoles: Readonly<Record<Permission, readonly Role[]>> = {
  [Permission.ProfileRead]: allRoles,
  [Permission.ProfileUpdate]: allRoles,
  [Permission.PasswordChange]: allRoles,
  [Permission.NotificationsRead]: allRoles,
  [Permission.NotificationsUpdate]: allRoles,
  [Permission.SettingsRead]: allRoles,
  [Permission.SettingsManage]: admin,
  [Permission.StaffRead]: admin,
  [Permission.StaffManage]: admin,
  [Permission.ClinicalCatalogueRead]: allRoles,
  [Permission.ClinicalCatalogueManage]: admin,
  [Permission.PatientRead]: registration,
  [Permission.PatientManage]: registration,
  [Permission.VisitRead]: clinical,
  [Permission.VisitManage]: registration,
  [Permission.ClinicalServicePerform]: diagnostic,
  [Permission.ClinicalServiceApprove]: registration,
  [Permission.ClinicalServiceRemove]: clinical,
  [Permission.ClinicalPriceRequest]: diagnostic,
  [Permission.ClinicalPriceApprove]: clinicCash,
  [Permission.ClinicalResultWrite]: diagnostic,
  [Permission.ClinicalPrescriptionWrite]: diagnostic,
  [Permission.ClinicInvoiceRead]: clinicCash,
  [Permission.ClinicPaymentCreate]: clinicCash,
  [Permission.ClinicSessionRead]: clinicCash,
  [Permission.ClinicSessionManage]: clinicCash,
  [Permission.ClinicSessionReadAll]: finance,
  [Permission.DashboardRead]: allRoles,
  [Permission.FinancialReportsRead]: finance,
  [Permission.FinancialPaymentVoid]: finance,
  [Permission.AuditRead]: finance,
  [Permission.AccountingPeriodRead]: finance,
  [Permission.AccountingPeriodLock]: finance,
  [Permission.FinancialReversalRead]: finance,
  [Permission.FinancialReversalRequest]: finance,
  [Permission.FinancialReversalReview]: finance,
  [Permission.ExpenseRead]: finance,
  [Permission.ExpenseCreate]: finance,
  [Permission.ExpenseVoid]: finance,
  [Permission.PharmacyStockRead]: pharmacyRead,
  [Permission.PharmacyPosStockRead]: pharmacyWork,
  [Permission.PharmacyStockPolicyManage]: admin,
  [Permission.PharmacyQuarantineResolve]: admin,
  [Permission.PharmacyTransferRead]: pharmacyRead,
  [Permission.PharmacyTransferManage]: pharmacyWork,
  [Permission.PharmacyTransferApprove]: admin,
  [Permission.PharmacyTransferDispatch]: pharmacyWork,
  [Permission.PharmacyTransferReceive]: pharmacyWork,
  [Permission.PharmacyCountRead]: pharmacyRead,
  [Permission.PharmacyCountManage]: pharmacyWork,
  [Permission.PharmacyCountApprove]: admin,
  [Permission.PharmacyAdjustmentRead]: pharmacyRead,
  [Permission.PharmacyAdjustmentRequest]: pharmacyWork,
  [Permission.PharmacyAdjustmentApprove]: admin,
  [Permission.PharmacyPayablesRead]: pharmacyRead,
  [Permission.PharmacyInvoiceManage]: finance,
  [Permission.PharmacySupplierPaymentCreate]: finance,
  [Permission.PharmacySupplierReturnCreate]: finance,
  [Permission.PharmacySupplierRead]: pharmacyRead,
  [Permission.PharmacySupplierManage]: admin,
  [Permission.PharmacyPurchaseOrderRead]: pharmacyRead,
  [Permission.PharmacyPurchaseOrderManage]: pharmacyWork,
  [Permission.PharmacyPurchaseOrderApprove]: admin,
  [Permission.PharmacyLocationsRead]: pharmacyRead,
  [Permission.PharmacyLocationsReadAll]: finance,
  [Permission.PharmacyLocationsManage]: admin,
  [Permission.PharmacyCatalogueRead]: pharmacyRead,
  [Permission.PharmacyCatalogueManage]: admin,
  [Permission.PharmacyGoodsReceiptRead]: pharmacyRead,
  [Permission.PharmacyGoodsReceiptCreate]: pharmacyWork,
  [Permission.PharmacyGoodsReceiptOverride]: admin,
  [Permission.PharmacySaleCreate]: pharmacyWork,
  [Permission.PharmacySaleRead]: pharmacyWork,
  [Permission.PharmacyRegisterRead]: pharmacyWork,
  [Permission.PharmacyRegisterManage]: pharmacyWork,
  [Permission.PharmacyClosureRead]: pharmacyRead,
};

export interface RoleSubject {
  role?: unknown;
  roles?: unknown;
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    allRoles.includes(value)
  );
}

export function parseRole(value: unknown): Role | undefined {
  const role =
    typeof value === 'string' && /^[0-5]$/.test(value.trim())
      ? Number(value.trim())
      : value;
  return isRole(role) ? role : undefined;
}

export function getUserRoles(user: RoleSubject | null | undefined): Role[] {
  if (!user) return [];
  const raw = user.roles ?? user.role;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [raw];
  const roles = values.map(parseRole);
  if (!roles.length || !roles.every(isRole)) return [];
  return [...new Set(roles)];
}

export function hasRole(
  user: RoleSubject | null | undefined,
  role: Role,
): boolean {
  return getUserRoles(user).includes(role);
}

export function hasPermission(
  user: RoleSubject | null | undefined,
  permission: Permission,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(permissionRoles, permission))
    return false;
  const roles = getUserRoles(user);
  return permissionRoles[permission].some((role) => roles.includes(role));
}

export const MODULE_ROLES: Readonly<Record<string, Role>> = {
  admin: Role.Admin,
  frontdesk: Role.Frontdesk,
  laboratory: Role.Laboratory,
  scanning: Role.Scanning,
  pharmacy: Role.Pharmacy,
  accounting: Role.Accounting,
};

export function canAccessModule(user: RoleSubject, module: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(MODULE_ROLES, module) &&
    (hasRole(user, Role.Admin) || hasRole(user, MODULE_ROLES[module]))
  );
}
