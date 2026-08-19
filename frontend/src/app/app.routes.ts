import { Routes } from '@angular/router';

import { authGuard, guestGuard, moduleAccessGuard } from './core/auth/auth.guards';
import { AppShellComponent } from './core/layout/app-shell.component';
import { ModuleMenuItem, ModuleShellComponent } from './core/layout/module-shell/module-shell.component';
import { LoginPageComponent } from './features/auth/pages/login-page.component';
import { VerifyInviteComponent } from './features/auth/pages/verify-invite.component';
import { ForgotPasswordComponent } from './features/auth/pages/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/pages/reset-password.component';
import { DashboardPageData, RoleDashboardPageComponent } from './shared/pages/role-dashboard-page.component';
import { WorkspacePageComponent, WorkspacePageData } from './shared/pages/workspace-page.component';

// Real Standalone Components
import { AdminUsersPageComponent } from './features/admin/pages/admin-users-page.component';
import { AdminServicesPageComponent } from './features/admin/pages/admin-services-page.component';
import { AdminTemplatesPageComponent } from './features/admin/pages/admin-templates-page.component';
import { AdminGeneralTemplatesPageComponent } from './features/admin/pages/admin-general-templates-page.component';
import { AdminFinancialsPageComponent } from './features/admin/pages/admin-financials-page.component';
import { AdminSettingsPageComponent } from './features/admin/pages/admin-settings-page.component';
import { FrontdeskClientsPageComponent } from './features/frontdesk/pages/frontdesk-clients-page.component';
import { FrontdeskVisitsPageComponent } from './features/frontdesk/pages/frontdesk-visits-page.component';
import { FrontdeskRegistrationPageComponent } from './features/frontdesk/pages/frontdesk-registration-page.component';
import { BillingDeskPageComponent } from './features/frontdesk/pages/billing-desk-page.component';
import { WorklistQueuePageComponent } from './features/department-worklist/pages/worklist-queue-page.component';
import { WorklistResultsPageComponent } from './features/department-worklist/pages/worklist-results-page.component';
import { PharmacyInventoryPageComponent } from './features/pharmacy/pages/pharmacy-inventory-page.component';
import { PharmacyPosSalesPageComponent } from './features/pharmacy/pages/pharmacy-pos-sales-page.component';
import { PharmacyLocationsPageComponent } from './features/pharmacy/pages/pharmacy-locations-page.component';
import { PharmacyCataloguePageComponent } from './features/pharmacy/pages/pharmacy-catalogue-page.component';
import { PharmacyMedicinesPageComponent } from './features/pharmacy/pages/pharmacy-medicines-page.component';
import { PharmacyStockReceivingPageComponent } from './features/pharmacy/pages/pharmacy-stock-receiving-page.component';
import { PharmacySuppliersPageComponent } from './features/pharmacy/pages/pharmacy-suppliers-page.component';
import { PharmacyPurchaseOrdersPageComponent } from './features/pharmacy/pages/pharmacy-purchase-orders-page.component';
import { PharmacyPayablesPageComponent } from './features/pharmacy/pages/pharmacy-payables-page.component';
import { PharmacyStockControlPageComponent } from './features/pharmacy/pages/pharmacy-stock-control-page.component';
import { PharmacyTransfersPageComponent } from './features/pharmacy/pages/pharmacy-transfers-page.component';
import { PharmacyNetworkStockPageComponent } from './features/pharmacy/pages/pharmacy-network-stock-page.component';
import { ProfilePageComponent } from './features/profile/pages/profile-page.component';

const adminMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', exact: true },
  { label: 'Users & Roles', path: '/admin/users' },
  { label: 'Service Setup', path: '/admin/services' },
  { label: 'Template Builder', path: '/admin/templates' },
  { label: 'General Templates', path: '/admin/general-templates' },
  { label: 'Financial Summary', path: '/admin/financials' }
];

const frontdeskMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/frontdesk/dashboard', exact: true },
  { label: 'Clients', path: '/frontdesk/clients' },
  { label: 'Visits', path: '/frontdesk/visits' },
  { label: 'New Registration', path: '/frontdesk/new-registration' },
  { label: 'Billing Desk', path: '/frontdesk/billing-desk' }
];

const laboratoryMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/laboratory/dashboard', exact: true },
  { label: 'Active Queue', path: '/laboratory/queue' },
  { label: 'Visits & History', path: '/laboratory/history' }
];

const scanningMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/scanning/dashboard', exact: true },
  { label: 'Active Queue', path: '/scanning/queue' },
  { label: 'Visits & History', path: '/scanning/history' }
];

const pharmacyMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/pharmacy/dashboard', exact: true },
  { label: 'Locations', path: '/pharmacy/locations' },
  { label: 'Stock Overview', path: '/pharmacy/inventory' },
  { label: 'Network Stock', path: '/pharmacy/network-stock' },
  { label: 'Stock Control', path: '/pharmacy/stock-control' },
  { label: 'Stock Transfers', path: '/pharmacy/transfers' },
  { label: 'Medicine Library', path: '/pharmacy/medicines' },
  { label: 'Product Catalogue', path: '/pharmacy/catalogue' },
  { label: 'Suppliers', path: '/pharmacy/suppliers' },
  { label: 'Purchase Orders', path: '/pharmacy/purchase-orders' },
  { label: 'Supplier Payables', path: '/pharmacy/payables' },
  { label: 'Receive Stock', path: '/pharmacy/receiving' },
  { label: 'POS Sales', path: '/pharmacy/pos-sales' }
];

const accountingMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/accounting/dashboard', exact: true },
  { label: 'Clinic Stream', path: '/accounting/clinic-stream' },
  { label: 'Pharmacy Stream', path: '/accounting/pharmacy-stream' },
  { label: 'Supplier Payables', path: '/accounting/supplier-payables' },
  { label: 'Reports', path: '/accounting/reports' }
];

const adminDashboard: DashboardPageData = {
  eyebrow: 'Admin Module',
  title: 'Clinic command center for setup, oversight, and financial control.',
  description:
    'Admin starts here. This dashboard is the control layer for users, services, department setup, and clinic-wide reporting before switching into other modules when needed.',
  stats: [
    { label: 'Active Staff', value: '24', hint: 'Across all assigned modules' },
    { label: 'Configured Services', value: '48', hint: 'Prices and templates managed here' },
    { label: 'Today Revenue (GHS)', value: '0.00', hint: 'Clinic + pharmacy streams' },
    { label: 'Pending Reviews', value: '6', hint: 'Operational items requiring attention' }
  ],
  actions: [
    { title: 'Manage users and roles', description: 'Create staff accounts, assign departments, and control who can access what.', route: '/admin/users' },
    { title: 'Configure services', description: 'Set prices, assign departments, and control result template requirements.', route: '/admin/services' },
    { title: 'Review financial summary', description: 'Track clinic and pharmacy revenue from one admin overview.', route: '/admin/financials' }
  ]
};

const frontdeskDashboard: DashboardPageData = {
  eyebrow: 'Frontdesk Module',
  title: 'Patient intake, visit control, and payment-ready handoff.',
  description:
    'Frontdesk users land directly in their own workspace with only the pages they need: patient search, registration, visit handling, and the billing desk flow.',
  stats: [
    { label: 'Today Check-ins', value: '0', hint: 'New and returning patients' },
    { label: 'Open Visits', value: '0', hint: 'Still in clinic workflow' },
    { label: 'Awaiting Payment', value: '0', hint: 'Ready for frontdesk billing' },
    { label: 'Receipts Issued', value: '0', hint: 'Printed after full payment' }
  ],
  actions: [
    { title: 'Find returning patients', description: 'Search by full name and phone number before opening a new visit.', route: '/frontdesk/clients' },
    { title: 'Register a new patient', description: 'Capture demographics, referral source, emergency contact, and reason for visit.', route: '/frontdesk/new-registration' },
    { title: 'Open visits dashboard', description: 'Track visit status from registration through payment.', route: '/frontdesk/visits' }
  ]
};

const laboratoryDashboard: DashboardPageData = {
  eyebrow: 'Laboratory Module',
  title: 'Handle laboratory requests, results, and prescriptions from one focused workspace.',
  description:
    'Laboratory users work only inside their assigned flow. They receive requests, add extra services, complete results, and issue prescription notes when needed.',
  stats: [
    { label: 'Queued Requests', value: '0', hint: 'Sent from frontdesk' },
    { label: 'Results Pending', value: '0', hint: 'Template fields still incomplete' },
    { label: 'Extra Services Added', value: '0', hint: 'Patient-approved additions today' },
    { label: 'Not Done Items', value: '0', hint: 'Recorded with reason' }
  ],
  actions: [
    { title: 'Open Active Queue', description: 'Access the clinical queue to process active requests, enter results, and issue prescriptions.', route: '/laboratory/queue' },
    { title: 'View History & Logs', description: 'Check completed visits today, print results, and view patients historical archives.', route: '/laboratory/history' }
  ]
};

const scanningDashboard: DashboardPageData = {
  eyebrow: 'Scanning Module',
  title: 'Coordinate scan requests, completions, and reporting decisions.',
  description:
    'Scanning users get their own dashboard with requests, result workflows, and scan reporting pages without exposure to other modules.',
  stats: [
    { label: 'Active Scan Queue', value: '0', hint: 'Visits waiting to be handled' },
    { label: 'Completed Today', value: '0', hint: 'Scan lines marked done' },
    { label: 'Additional Scans Added', value: '0', hint: 'Approved during procedure' },
    { label: 'Reports Drafted', value: '0', hint: 'Ready for review or print' }
  ],
  actions: [
    { title: 'Open Active Queue', description: 'Work through queued scan requests, capture outcomes, and draft reports.', route: '/scanning/queue' },
    { title: 'View History & Logs', description: 'Review finished scan outcomes, check narratives, and print report history.', route: '/scanning/history' }
  ]
};

const pharmacyDashboard: DashboardPageData = {
  eyebrow: 'Pharmacy Module',
  title: 'Run pharmacy stock, procurement, and point-of-sale from a dedicated workspace.',
  description:
    'Pharmacy users should only see pharmacy operations. This dashboard keeps inventory, purchasing, transfers, and counter sales clear and traceable.',
  stats: [
    { label: 'Low Stock Items', value: '0', hint: 'Needs attention or reorder' },
    { label: 'Active Locations', value: '0', hint: 'Pharmacy shops in the network' },
    { label: 'Walk-in Sales', value: '0', hint: 'Today total transactions' },
    { label: 'Expiry Alerts', value: '0', hint: 'Batch monitoring' }
  ],
  actions: [
    { title: 'Review stock', description: 'Track location quantities, batches, expiry, and reorder exposure.', route: '/pharmacy/inventory' },
    { title: 'Receive supplier stock', description: 'Post a multi-line goods receipt with pack conversion and batch traceability.', route: '/pharmacy/receiving' },
    { title: 'Process POS sales', description: 'Search medicines, add quantities, and complete counter sales.', route: '/pharmacy/pos-sales' },
    { title: 'Review network stock', description: 'Compare availability across pharmacy locations before requesting a transfer.', route: '/pharmacy/network-stock' }
  ]
};

const adminUsersPage: WorkspacePageData = {
  eyebrow: 'Admin / Users & Roles',
  title: 'Users and roles workspace',
  description: 'Create staff accounts, assign numeric role codes, and control which module each user can enter after login.',
  highlights: [
    'Create users for frontdesk, laboratory, scanning, pharmacy, and accounting.',
    'Assign role codes where 0 is admin and 1+ are operational roles.',
    'Limit non-admin users to their own module and sidebar pages only.'
  ]
};

const adminServicesPage: WorkspacePageData = {
  eyebrow: 'Admin / Service Setup',
  title: 'Service configuration workspace',
  description: 'Define services, prices, department ownership, and required result template fields from one admin page.',
  highlights: [
    'Set fixed service pricing visible to frontdesk and departments.',
    'Assign each service to exactly one department.',
    'Define required and optional result template fields for completion.'
  ]
};

const adminFinancialsPage: WorkspacePageData = {
  eyebrow: 'Admin / Financial Summary',
  title: 'Financial oversight workspace',
  description: 'Track clinic and pharmacy revenue streams from a single admin reporting view.',
  highlights: [
    'View separate clinic and pharmacy streams.',
    'Review revenue by department, service, and date.',
    'Export management summaries for audit and operations.'
  ]
};

const frontdeskClientsPage: WorkspacePageData = {
  eyebrow: 'Frontdesk / Clients',
  title: 'Client search workspace',
  description: 'Search existing patients first, then open their record and create a new visit when they return.',
  highlights: [
    'Search by full name and phone number.',
    'Prevent duplicate registration where possible.',
    'Open existing profile and create a new visit for returning patients.'
  ]
};

const frontdeskVisitsPage: WorkspacePageData = {
  eyebrow: 'Frontdesk / Visits',
  title: 'Visit management workspace',
  description: 'Monitor active visits as they move from registration to department completion and payment.',
  highlights: [
    'See current visit status at a glance.',
    'Track whether a visit is awaiting payment.',
    'Review added services before billing is generated.'
  ]
};

const frontdeskRegistrationPage: WorkspacePageData = {
  eyebrow: 'Frontdesk / New Registration',
  title: 'New registration workspace',
  description: 'Capture patient details, reason for visit, insurance status, and initial services before routing to a department.',
  highlights: [
    'Collect names, sex, age, phone, referral source, emergency contact, and insurance status.',
    'Select initial services and show costs immediately.',
    'Create a new visit and send it to the correct department queue.'
  ]
};

const frontdeskBillingDeskPage: WorkspacePageData = {
  eyebrow: 'Frontdesk / Billing Desk',
  title: 'Billing desk workspace',
  description: 'Generate visit invoices from completed services and collect full payment before printing receipts.',
  highlights: [
    'Include extra services added by departments in the final invoice.',
    'Accept full payment only by cash or mobile money.',
    'Print A4 clinic receipt summary after successful payment.'
  ]
};

const laboratoryRequestsPage: WorkspacePageData = {
  eyebrow: 'Laboratory / Requests',
  title: 'Laboratory request queue',
  description: 'Receive lab requests from frontdesk and prepare for result capture and extra service decisions.',
  highlights: [
    'Open queued visits sent to laboratory.',
    'Review requested services and patient details.',
    'Add extra services with patient approval when clinically needed.'
  ]
};

const laboratoryResultsPage: WorkspacePageData = {
  eyebrow: 'Laboratory / Results',
  title: 'Laboratory results workspace',
  description: 'Enter results into service templates and mark lines done or not done with documented reasons.',
  highlights: [
    'Complete required template fields before closing a service line.',
    'Record not-done reasons from presets or free text.',
    'Keep result entry and service completion tightly linked.'
  ]
};

const laboratoryPrescriptionsPage: WorkspacePageData = {
  eyebrow: 'Laboratory / Prescriptions',
  title: 'Laboratory prescription workspace',
  description: 'Issue free-text prescription notes that appear on the patient diagnostic report.',
  highlights: [
    'Enter medicine name as required text.',
    'Add optional quantity and remarks.',
    'Print the prescription with the visit results for patient handoff.'
  ]
};

const scanningRequestsPage: WorkspacePageData = {
  eyebrow: 'Scanning / Requests',
  title: 'Scanning request queue',
  description: 'Organize scan requests and move patients through scan-specific execution steps.',
  highlights: [
    'Review incoming scan requests from frontdesk.',
    'See visit context before beginning the scan.',
    'Add extra scans with explicit patient approval.'
  ]
};

const scanningResultsPage: WorkspacePageData = {
  eyebrow: 'Scanning / Results',
  title: 'Scanning results workspace',
  description: 'Record scan outcomes, mark completed work, and document services that were not done.',
  highlights: [
    'Capture result details against configured service templates.',
    'Track completed and not-done items.',
    'Preserve billing visibility for added scan lines.'
  ]
};

const scanningReportsPage: WorkspacePageData = {
  eyebrow: 'Scanning / Reports',
  title: 'Scanning reports workspace',
  description: 'Prepare the reporting side of scan services and keep results organized for print workflows.',
  highlights: [
    'Structure result narratives for print output.',
    'Support reviewed reporting before patient billing closes.',
    'Keep scanning outcomes visible in clinic summary printouts.'
  ]
};

const pharmacyInventoryPage: WorkspacePageData = {
  eyebrow: 'Pharmacy / Inventory',
  title: 'Inventory control workspace',
  description: 'Track medicine stock, suppliers, batch numbers, expiry dates, and reorder levels.',
  highlights: [
    'Record stock intake and adjustments.',
    'Track quantity by batch and expiry date.',
    'Monitor low-stock and expiry alerts.'
  ]
};

const pharmacySalesPage: WorkspacePageData = {
  eyebrow: 'Pharmacy / POS Sales',
  title: 'Pharmacy sales workspace',
  description: 'Run pharmacy counter sales as a separate receipt stream from clinic billing.',
  highlights: [
    'Search or scan the medicine printed on the patient report.',
    'Allocate stock automatically from the earliest-expiring batches.',
    'Issue independent pharmacy receipts.'
  ]
};

const accountingClinicPage: WorkspacePageData = {
  eyebrow: 'Accounting / Clinic Stream',
  title: 'Clinic revenue stream',
  description: 'Review clinic-only invoices, payments, and summaries generated from frontdesk operations.',
  highlights: [
    'Separate clinic stream from pharmacy stream.',
    'View receipts by day, user, and service.',
    'Support daily reconciliation and reporting.'
  ]
};

const accountingPharmacyPage: WorkspacePageData = {
  eyebrow: 'Accounting / Pharmacy Stream',
  title: 'Pharmacy revenue stream',
  description: 'Review pharmacy-only transactions independently from clinic invoices.',
  highlights: [
    'See POS totals and sales trends.',
    'Track revenue by product and date range.',
    'Keep pharmacy reporting operationally separate from clinic billing.'
  ]
};

const accountingReportsPage: WorkspacePageData = {
  eyebrow: 'Accounting / Reports',
  title: 'Accounting reports workspace',
  description: 'Prepare exports and daily financial summaries across the system for management use.',
  highlights: [
    'Generate PDF and Excel reports.',
    'Prepare daily, weekly, and date-range summaries.',
    'Review clinic and pharmacy totals side by side.'
  ]
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'auth/verify-invite',
    component: VerifyInviteComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'auth/forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'auth/reset-password',
    component: ResetPasswordComponent,
    canActivate: [guestGuard]
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'profile',
        component: ProfilePageComponent
      },
      {
        path: 'admin',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('admin')],
        data: {
          title: 'Admin',
          subtitle: 'Clinic-wide control for setup, governance, and overview.',
          menu: adminMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: adminDashboard } },
          { path: 'users', component: AdminUsersPageComponent },
          { path: 'services', component: AdminServicesPageComponent },
          { path: 'templates', component: AdminTemplatesPageComponent },
          { path: 'general-templates', component: AdminGeneralTemplatesPageComponent },
          { path: 'services/:id/template', redirectTo: 'templates' },
          { path: 'financials', component: AdminFinancialsPageComponent, data: { financialTab: 'dashboard' } },
          { path: 'settings', component: AdminSettingsPageComponent }
        ]
      },
      {
        path: 'frontdesk',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('frontdesk')],
        data: {
          title: 'Frontdesk',
          subtitle: 'Patient intake, visit creation, and payment-ready coordination.',
          menu: frontdeskMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: frontdeskDashboard } },
          { path: 'clients', component: FrontdeskClientsPageComponent },
          { path: 'visits', component: FrontdeskVisitsPageComponent },
          { path: 'new-registration', component: FrontdeskRegistrationPageComponent },
          { path: 'billing-desk', component: BillingDeskPageComponent }
        ]
      },
      {
        path: 'laboratory',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('laboratory')],
        data: {
          title: 'Laboratory',
          subtitle: 'Department queue, result entry, and prescription handoff.',
          menu: laboratoryMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: laboratoryDashboard } },
          { path: 'queue', component: WorklistQueuePageComponent },
          { path: 'history', component: WorklistResultsPageComponent }
        ]
      },
      {
        path: 'scanning',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('scanning')],
        data: {
          title: 'Scanning',
          subtitle: 'Scan requests, result workflows, and reporting spaces.',
          menu: scanningMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: scanningDashboard } },
          { path: 'queue', component: WorklistQueuePageComponent },
          { path: 'history', component: WorklistResultsPageComponent }
        ]
      },
      {
        path: 'pharmacy',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('pharmacy')],
        data: {
          title: 'Pharmacy',
          subtitle: 'Inventory, procurement, transfers, and point-of-sale operations.',
          menu: pharmacyMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: pharmacyDashboard } },
          { path: 'locations', component: PharmacyLocationsPageComponent },
          { path: 'inventory', component: PharmacyInventoryPageComponent },
          { path: 'network-stock', component: PharmacyNetworkStockPageComponent },
          { path: 'stock-control', component: PharmacyStockControlPageComponent },
          { path: 'transfers', component: PharmacyTransfersPageComponent },
          { path: 'medicines', component: PharmacyMedicinesPageComponent },
          { path: 'catalogue', component: PharmacyCataloguePageComponent },
          { path: 'suppliers', component: PharmacySuppliersPageComponent },
          { path: 'purchase-orders', component: PharmacyPurchaseOrdersPageComponent },
          { path: 'payables', component: PharmacyPayablesPageComponent },
          { path: 'receiving', component: PharmacyStockReceivingPageComponent },
          { path: 'pos-sales', component: PharmacyPosSalesPageComponent }
        ]
      },
      {
        path: 'accounting',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('accounting')],
        data: {
          title: 'Accounting',
          subtitle: 'Financial stream review and export-focused reporting.',
          menu: accountingMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: AdminFinancialsPageComponent, data: { financialTab: 'dashboard' } },
          { path: 'clinic-stream', component: AdminFinancialsPageComponent, data: { financialTab: 'clinic' } },
          { path: 'pharmacy-stream', component: AdminFinancialsPageComponent, data: { financialTab: 'pharmacy' } },
          { path: 'supplier-payables', component: PharmacyPayablesPageComponent },
          { path: 'reports', component: AdminFinancialsPageComponent, data: { financialTab: 'dashboard' } }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
