import { Routes } from '@angular/router';

import { authGuard, guestGuard, moduleAccessGuard } from './core/auth/auth.guards';
import { AppShellComponent } from './core/layout/app-shell.component';
import { ModuleMenuItem, ModuleShellComponent } from './core/layout/module-shell/module-shell.component';
import { LoginPageComponent } from './features/auth/pages/login-page.component';
import { DashboardPageData, RoleDashboardPageComponent } from './shared/pages/role-dashboard-page.component';
import { WorkspacePageComponent, WorkspacePageData } from './shared/pages/workspace-page.component';

// Real Standalone Components
import { AdminUsersPageComponent } from './features/admin/pages/admin-users-page.component';
import { AdminServicesPageComponent } from './features/admin/pages/admin-services-page.component';
import { AdminTemplatesPageComponent } from './features/admin/pages/admin-templates-page.component';
import { AdminFinancialsPageComponent } from './features/admin/pages/admin-financials-page.component';
import { FrontdeskClientsPageComponent } from './features/frontdesk/pages/frontdesk-clients-page.component';
import { FrontdeskVisitsPageComponent } from './features/frontdesk/pages/frontdesk-visits-page.component';
import { FrontdeskRegistrationPageComponent } from './features/frontdesk/pages/frontdesk-registration-page.component';
import { BillingDeskPageComponent } from './features/frontdesk/pages/billing-desk-page.component';
import { WorklistQueuePageComponent } from './features/department-worklist/pages/worklist-queue-page.component';
import { PharmacyInventoryPageComponent } from './features/pharmacy/pages/pharmacy-inventory-page.component';
import { PharmacyPosSalesPageComponent } from './features/pharmacy/pages/pharmacy-pos-sales-page.component';

const adminMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', exact: true },
  { label: 'Users & Roles', path: '/admin/users' },
  { label: 'Service Setup', path: '/admin/services' },
  { label: 'Template Builder', path: '/admin/templates' },
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
  { label: 'Requests', path: '/laboratory/requests' },
  { label: 'Results', path: '/laboratory/results' },
  { label: 'Prescriptions', path: '/laboratory/prescriptions' }
];

const scanningMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/scanning/dashboard', exact: true },
  { label: 'Requests', path: '/scanning/requests' },
  { label: 'Results', path: '/scanning/results' },
  { label: 'Reports', path: '/scanning/reports' }
];

const pharmacyMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/pharmacy/dashboard', exact: true },
  { label: 'Inventory', path: '/pharmacy/inventory' },
  { label: 'POS Sales', path: '/pharmacy/pos-sales' },
  { label: 'Clinic Prescriptions', path: '/pharmacy/clinic-prescriptions' }
];

const accountingMenu: readonly ModuleMenuItem[] = [
  { label: 'Dashboard', path: '/accounting/dashboard', exact: true },
  { label: 'Clinic Stream', path: '/accounting/clinic-stream' },
  { label: 'Pharmacy Stream', path: '/accounting/pharmacy-stream' },
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
    { title: 'Open request queue', description: 'See new laboratory requests and begin processing.', route: '/laboratory/requests' },
    { title: 'Complete result entries', description: 'Fill service-specific result templates and finalize done status.', route: '/laboratory/results' },
    { title: 'Review prescriptions', description: 'Capture medicine recommendations for pharmacy follow-up.', route: '/laboratory/prescriptions' }
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
    { title: 'Open scan requests', description: 'Work through queued scan requests by visit order.', route: '/scanning/requests' },
    { title: 'Enter scan outcomes', description: 'Capture result data and mark done or not done with reason.', route: '/scanning/results' },
    { title: 'Prepare reports', description: 'Organize printed or reviewed report summaries.', route: '/scanning/reports' }
  ]
};

const pharmacyDashboard: DashboardPageData = {
  eyebrow: 'Pharmacy Module',
  title: 'Run pharmacy stock, prescriptions, and point-of-sale from a dedicated workspace.',
  description:
    'Pharmacy users should only see pharmacy operations. This dashboard separates inventory and sales while still supporting clinic-referred prescription handling.',
  stats: [
    { label: 'Low Stock Items', value: '0', hint: 'Needs attention or reorder' },
    { label: 'Clinic Prescriptions', value: '0', hint: 'Waiting to be dispensed' },
    { label: 'Walk-in Sales', value: '0', hint: 'Today total transactions' },
    { label: 'Expiry Alerts', value: '0', hint: 'Batch monitoring' }
  ],
  actions: [
    { title: 'Manage inventory', description: 'Track batches, expiry, and reorder thresholds.', route: '/pharmacy/inventory' },
    { title: 'Process POS sales', description: 'Run walk-in and clinic-referred sales independently.', route: '/pharmacy/pos-sales' },
    { title: 'Check clinic prescriptions', description: 'See referred prescription notes from clinical modules.', route: '/pharmacy/clinic-prescriptions' }
  ]
};

const accountingDashboard: DashboardPageData = {
  eyebrow: 'Accounting Module',
  title: 'Watch clinic and pharmacy streams with reporting-focused navigation.',
  description:
    'Accounting gets a clean financial workspace with separate views for clinic receipts, pharmacy sales, and consolidated reports.',
  stats: [
    { label: 'Clinic Stream (GHS)', value: '0.00', hint: 'Frontdesk payments only' },
    { label: 'Pharmacy Stream (GHS)', value: '0.00', hint: 'Independent pharmacy receipts' },
    { label: 'Exports Ready', value: '0', hint: 'PDF and Excel reports' },
    { label: 'Daily Closures', value: '0', hint: 'Reconciled today' }
  ],
  actions: [
    { title: 'Review clinic stream', description: 'Inspect clinic payment activity by day, cashier, and service.', route: '/accounting/clinic-stream' },
    { title: 'Review pharmacy stream', description: 'Inspect pharmacy sales separately from clinic billing.', route: '/accounting/pharmacy-stream' },
    { title: 'Generate reports', description: 'Prepare summary exports for management review.', route: '/accounting/reports' }
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
  description: 'Issue free-text prescription notes that pharmacy can later see and act upon.',
  highlights: [
    'Enter medicine name as required text.',
    'Add optional quantity and remarks.',
    'Link prescriptions back to the clinic visit.'
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
  description: 'Run walk-in and clinic-referred pharmacy sales as a separate receipt stream from clinic billing.',
  highlights: [
    'Differentiate walk-in versus clinic-referred transactions.',
    'Deduct stock from the correct batch during sale.',
    'Issue independent pharmacy receipts.'
  ]
};

const pharmacyPrescriptionsPage: WorkspacePageData = {
  eyebrow: 'Pharmacy / Clinic Prescriptions',
  title: 'Clinic prescription workspace',
  description: 'Receive and review prescription notes written from clinical modules before dispensing.',
  highlights: [
    'See prescriptions linked to clinic visits.',
    'Use pharmacist discretion when dispensing alternates.',
    'Keep clinic referrals distinct from normal walk-in sales.'
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
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
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
          { path: 'services/:id/template', redirectTo: 'templates' },
          { path: 'financials', component: AdminFinancialsPageComponent }
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
          { path: 'requests', component: WorklistQueuePageComponent },
          { path: 'results', component: WorklistQueuePageComponent },
          { path: 'prescriptions', component: WorklistQueuePageComponent }
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
          { path: 'requests', component: WorklistQueuePageComponent },
          { path: 'results', component: WorklistQueuePageComponent },
          { path: 'reports', component: WorklistQueuePageComponent }
        ]
      },
      {
        path: 'pharmacy',
        component: ModuleShellComponent,
        canActivate: [moduleAccessGuard('pharmacy')],
        data: {
          title: 'Pharmacy',
          subtitle: 'Inventory, prescriptions, and point-of-sale operations.',
          menu: pharmacyMenu
        },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: pharmacyDashboard } },
          { path: 'inventory', component: PharmacyInventoryPageComponent },
          { path: 'pos-sales', component: PharmacyPosSalesPageComponent },
          { path: 'clinic-prescriptions', component: PharmacyPosSalesPageComponent }
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
          { path: 'dashboard', component: RoleDashboardPageComponent, data: { page: accountingDashboard } },
          { path: 'clinic-stream', component: AdminFinancialsPageComponent },
          { path: 'pharmacy-stream', component: AdminFinancialsPageComponent },
          { path: 'reports', component: AdminFinancialsPageComponent }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
