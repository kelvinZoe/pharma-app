import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Observable, expand, forkJoin, of, reduce, shareReplay } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { ApiService } from '../../../core/services/api.service';
import { getInternetDate } from '../../../core/utils/clock';

type FinancialTab = 'dashboard' | 'clinic' | 'pharmacy' | 'closures' | 'clinic-closures' | 'expenses' | 'inventory' | 'audit-logs';
type VoidTarget = { id: string; type: 'clinic' | 'pharmacy' | 'expense'; label: string };

@Component({
  selector: 'app-admin-financials-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-financials-page.component.html',
  styleUrl: './admin-financials-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFinancialsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);

  readonly Number = Number;
  readonly Math = Math;
  readonly tabs: readonly { id: FinancialTab; label: string; hint: string }[] = [
    { id: 'dashboard', label: 'Overview', hint: 'Performance' },
    { id: 'clinic', label: 'Clinic', hint: 'Receipts' },
    { id: 'pharmacy', label: 'Pharmacy', hint: 'POS sales' },
    { id: 'closures', label: 'Pharmacy shifts', hint: 'Reconciliation' },
    { id: 'clinic-closures', label: 'Clinic shifts', hint: 'Reconciliation' },
    { id: 'expenses', label: 'Expenses', hint: 'Operating costs' },
    { id: 'inventory', label: 'Stock exposure', hint: 'Risk' },
    { id: 'audit-logs', label: 'Audit trail', hint: 'Controls' },
  ];

  readonly activeTab = signal<FinancialTab>('dashboard');
  readonly startDate = signal(this.firstDayOfMonth());
  readonly endDate = signal(getInternetDate().toISOString().slice(0, 10));
  readonly searchQuery = signal('');
  readonly selectedLocationId = signal('');
  readonly locations = signal<any[]>([]);
  readonly isLoading = signal(false);
  readonly isExporting = signal(false);
  readonly errorMessage = signal('');

  readonly summary = signal<any | null>(null);
  readonly clinicPayments = signal<any[]>([]);
  readonly pharmacySales = signal<any[]>([]);
  readonly pharmacyClosures = signal<any[]>([]);
  readonly clinicClosures = signal<any[]>([]);
  readonly expenses = signal<any[]>([]);
  readonly auditLogs = signal<any[]>([]);

  readonly page = signal(1);
  readonly pageSize = 12;
  readonly totalRows = signal(0);

  readonly selectedRecord = signal<any | null>(null);
  readonly detailKind = signal<'pharmacy-closure' | 'clinic-closure' | null>(null);
  readonly detailLoading = signal(false);

  readonly expenseModalOpen = signal(false);
  readonly expenseSaving = signal(false);
  readonly expenseForm = signal({
    title: '', category: 'utilities', amount: 0, expenseDate: getInternetDate().toISOString().slice(0, 10),
    payee: '', paymentMethod: 'cash', referenceNumber: '', costCenter: '', attachmentUrl: '', notes: '',
  });

  readonly voidTarget = signal<VoidTarget | null>(null);
  readonly voidReason = signal('');
  readonly voidSaving = signal(false);

  readonly pageTitle = computed(() => ({
    dashboard: 'Financial control centre', clinic: 'Clinic receipt stream', pharmacy: 'Pharmacy sales stream',
    closures: 'Pharmacy shift reconciliation', 'clinic-closures': 'Clinic shift reconciliation',
    expenses: 'Operating expense register', inventory: 'Stock financial exposure', 'audit-logs': 'Financial audit trail',
  })[this.activeTab()]);

  readonly pageDescription = computed(() => ({
    dashboard: 'Review collections, cost of goods sold, operating spend, cash movement, and reconciliation exceptions.',
    clinic: 'Trace every non-voided clinic payment back to its patient, invoice, cashier, method, and reference.',
    pharmacy: 'Review location-aware POS revenue, sold items, payment methods, and transaction reversals.',
    closures: 'Compare expected and counted till values for every pharmacy register shift.',
    'clinic-closures': 'Review frontdesk cashier shifts and investigate cash or mobile money differences.',
    expenses: 'Maintain an immutable register of posted and voided operating costs with payment evidence.',
    inventory: 'Monitor low stock and expiry exposure by pharmacy location without treating purchases as profit expense.',
    'audit-logs': 'Inspect financial creates, voids, reversals, and other sensitive changes by user.',
  })[this.activeTab()]);

  readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const source = this.currentRows();
    if (!query) return source;
    return source.filter((row: any) => String(JSON.stringify(this.rowSearchDocument(row)) ?? '').toLowerCase().includes(query));
  });

  readonly maxTrend = computed(() => Math.max(1, ...(this.summary()?.chartData ?? []).map((point: any) => Number(point.total))));

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.data['financialTab'] as FinancialTab | undefined;
    this.activeTab.set(requestedTab ?? 'dashboard');
    this.loadLocations();
    this.loadData();
  }

  selectTab(tab: FinancialTab): void {
    this.activeTab.set(tab);
    this.page.set(1);
    this.searchQuery.set('');
    this.loadData();
  }

  loadLocations(): void {
    this.api.getPharmacyLocations().subscribe({
      next: (locations) => this.locations.set(locations ?? []),
      error: () => this.locations.set([]),
    });
  }

  changeLocation(locationId: string): void {
    this.selectedLocationId.set(locationId);
    if (locationId) this.session.setActivePharmacyLocation(locationId);
    this.page.set(1);
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    const start = this.startDate() || undefined;
    const end = this.endDate() || undefined;
    const location = this.selectedLocationId() || undefined;
    const summaryRequest = this.api.getCombinedSummary(start, end, location).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    let dataRequest: any = summaryRequest;

    switch (this.activeTab()) {
      case 'clinic': dataRequest = this.api.getClinicStream(start, end, this.page(), this.pageSize); break;
      case 'pharmacy': dataRequest = this.api.getPharmacyStream(start, end, this.page(), this.pageSize, location); break;
      case 'closures': dataRequest = this.api.getPharmacyClosures(start, end); break;
      case 'clinic-closures': dataRequest = this.api.getClinicCashSessions(start, end); break;
      case 'expenses': dataRequest = this.api.getExpenses(start, end, this.page(), this.pageSize); break;
      case 'audit-logs': dataRequest = this.api.getAuditLogs(this.page(), this.pageSize); break;
    }

    forkJoin({ summary: summaryRequest, data: dataRequest }).subscribe({
      next: ({ summary, data }) => {
        this.summary.set(summary);
        this.assignRows(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message ?? 'The financial records could not be loaded.');
        this.isLoading.set(false);
      },
    });
  }

  private assignRows(result: any): void {
    this.totalRows.set(0);
    switch (this.activeTab()) {
      case 'clinic': this.clinicPayments.set(result.data ?? []); this.totalRows.set(result.total ?? 0); break;
      case 'pharmacy': this.pharmacySales.set(result.data ?? []); this.totalRows.set(result.total ?? 0); break;
      case 'closures': this.pharmacyClosures.set(result ?? []); this.totalRows.set(result?.length ?? 0); break;
      case 'clinic-closures': this.clinicClosures.set(result ?? []); this.totalRows.set(result?.length ?? 0); break;
      case 'expenses': this.expenses.set(result.data ?? []); this.totalRows.set(result.total ?? 0); break;
      case 'audit-logs': this.auditLogs.set(result.data ?? []); this.totalRows.set(result.total ?? 0); break;
    }
  }

  private currentRows(): any[] {
    switch (this.activeTab()) {
      case 'clinic': return this.clinicPayments();
      case 'pharmacy': return this.pharmacySales();
      case 'closures': return this.pharmacyClosures();
      case 'clinic-closures': return this.clinicClosures();
      case 'expenses': return this.expenses();
      case 'audit-logs': return this.auditLogs();
      default: return [];
    }
  }

  private rowSearchDocument(row: any): unknown {
    if (this.activeTab() === 'clinic') return [row.invoice?.visit?.patient, row.referenceNumber, row.receivedByUser, row.invoice?.invoiceNumber];
    if (this.activeTab() === 'pharmacy') return [row.saleNumber, row.customerName, row.visit?.patient, row.soldByUser, row.location, row.items];
    if (this.activeTab() === 'expenses') return [row.title, row.category, row.payee, row.referenceNumber, row.costCenter, row.createdByUser];
    return row;
  }

  applyFilters(): void { this.page.set(1); this.loadData(); }
  resetFilters(): void {
    this.startDate.set(this.firstDayOfMonth());
    this.endDate.set(getInternetDate().toISOString().slice(0, 10));
    this.searchQuery.set('');
    this.selectedLocationId.set('');
    this.page.set(1);
    this.loadData();
  }
  changePage(nextPage: number): void { this.page.set(nextPage); this.loadData(); }
  totalPages(): number { return Math.max(1, Math.ceil(this.totalRows() / this.pageSize)); }
  trendHeight(value: number): number { return Math.max(3, Math.round((Number(value) / this.maxTrend()) * 100)); }

  openExpenseModal(): void {
    this.expenseForm.set({ title: '', category: 'utilities', amount: 0, expenseDate: getInternetDate().toISOString().slice(0, 10), payee: '', paymentMethod: 'cash', referenceNumber: '', costCenter: '', attachmentUrl: '', notes: '' });
    this.expenseModalOpen.set(true);
  }
  updateExpenseField(field: string, value: unknown): void { this.expenseForm.update((form) => ({ ...form, [field]: value })); }
  saveExpense(): void {
    const form = this.expenseForm();
    if (!form.title.trim() || Number(form.amount) <= 0 || this.expenseSaving()) return;
    this.expenseSaving.set(true);
    this.api.createExpense(form).subscribe({
      next: () => { this.expenseSaving.set(false); this.expenseModalOpen.set(false); this.loadData(); },
      error: (error) => { this.expenseSaving.set(false); this.errorMessage.set(error?.error?.message ?? 'Expense could not be posted.'); },
    });
  }

  requestVoid(id: string, type: VoidTarget['type'], label: string): void {
    this.voidTarget.set({ id, type, label });
    this.voidReason.set('');
  }
  confirmVoid(): void {
    const target = this.voidTarget();
    const reason = this.voidReason().trim();
    if (!target || reason.length < 5 || this.voidSaving()) return;
    this.voidSaving.set(true);
    const request = target.type === 'clinic'
      ? this.api.voidClinicPayment(target.id, reason)
      : target.type === 'pharmacy'
        ? this.api.voidPharmacySale(target.id, reason, 'quarantine')
        : this.api.voidExpense(target.id, reason);
    request.subscribe({
      next: () => { this.voidSaving.set(false); this.voidTarget.set(null); this.loadData(); },
      error: (error) => { this.voidSaving.set(false); this.errorMessage.set(error?.error?.message ?? 'The record could not be voided.'); },
    });
  }

  inspectClosure(id: string, kind: 'pharmacy-closure' | 'clinic-closure'): void {
    this.detailKind.set(kind);
    this.selectedRecord.set(null);
    this.detailLoading.set(true);
    const request = kind === 'pharmacy-closure' ? this.api.getPharmacyClosure(id) : this.api.getClinicCashSession(id);
    request.subscribe({
      next: (record) => { this.selectedRecord.set(record); this.detailLoading.set(false); },
      error: (error) => { this.detailLoading.set(false); this.errorMessage.set(error?.error?.message ?? 'Closure detail could not be loaded.'); },
    });
  }
  closeDetail(): void { this.detailKind.set(null); this.selectedRecord.set(null); }

  exportCurrentView(): void {
    if (this.isExporting()) return;
    this.isExporting.set(true);
    const start = this.startDate() || undefined;
    const end = this.endDate() || undefined;
    const location = this.selectedLocationId() || undefined;
    const tab = this.activeTab();
    const request = this.buildExportRequest(tab, start, end, location);
    request.subscribe({
      next: (result) => {
        const data = result?.data ?? result;
        const csv = this.buildCsv(tab, Array.isArray(data) ? data : data);
        this.downloadCsv(csv, `pharmaflow-${tab}-${getInternetDate().toISOString().slice(0, 10)}.csv`);
        this.isExporting.set(false);
      },
      error: () => { this.errorMessage.set('The complete export could not be generated.'); this.isExporting.set(false); },
    });
  }

  printView(): void { window.print(); }

  private buildCsv(tab: FinancialTab, data: any): string {
    if (tab === 'clinic') return this.rowsToCsv(['Invoice', 'Patient', 'Date', 'Method', 'Reference', 'Cashier', 'Amount'], data.map((row: any) => [row.invoice?.invoiceNumber, this.patientName(row.invoice?.visit?.patient), row.paidAt, row.paymentMethod, row.referenceNumber, this.userName(row.receivedByUser), row.amount]));
    if (tab === 'pharmacy') return this.rowsToCsv(['Sale', 'Location', 'Customer', 'Date', 'Method', 'Cashier', 'Total'], data.map((row: any) => [row.saleNumber, row.location?.name, row.customerName || this.patientName(row.visit?.patient) || 'Walk-in', row.paidAt, row.paymentMethod, this.userName(row.soldByUser), row.total]));
    if (tab === 'expenses') return this.rowsToCsv(['Date', 'Title', 'Category', 'Payee', 'Method', 'Reference', 'Cost centre', 'Amount', 'Status'], data.map((row: any) => [row.expenseDate, row.title, row.category, row.payee, row.paymentMethod, row.referenceNumber, row.costCenter, row.amount, row.status]));
    if (tab === 'audit-logs') return this.rowsToCsv(['Date', 'Actor', 'Action', 'Entity', 'Entity ID', 'Before', 'After'], data.map((row: any) => [row.createdAt, this.userName(row.actorUser), row.actionType, row.entityType, row.entityId, row.beforeData, row.afterData]));
    if (tab === 'closures' || tab === 'clinic-closures') return this.rowsToCsv(['Opened', 'Closed', 'Cashier', 'Expected cash', 'Expected MoMo', 'Counted', 'Discrepancy', 'Status'], data.map((row: any) => [row.openedAt ?? row.createdAt, row.closedAt ?? row.closureDate, this.userName(row.openedByUser), row.expectedCash, row.expectedMomo, row.totalCounted, row.discrepancy, row.status]));
    return this.rowsToCsv(['Metric', 'Value'], [
      ['Combined collections', data.combinedTotal], ['Clinic collections', data.clinicTotal], ['Pharmacy revenue', data.pharmacyTotal],
      ['Pharmacy COGS', data.pharmacyCogs], ['Pharmacy gross profit', data.pharmacyGrossProfit], ['Operating expenses', data.operatingExpensesTotal],
      ['Estimated operating result', data.estimatedOperatingResult], ['Supplier payments', data.supplierPaymentsTotal], ['Net inventory purchases', data.netInventoryPurchases],
    ]);
  }

  private rowsToCsv(headers: string[], rows: unknown[][]): string {
    const escape = (value: unknown) => {
      const raw = String(value ?? '');
      const formulaSafe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${formulaSafe.replaceAll('"', '""')}"`;
    };
    return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
  }

  private buildExportRequest(tab: FinancialTab, start?: string, end?: string, location?: string): Observable<any> {
    if (tab === 'clinic') {
      return this.collectExportPages((page, limit) => this.api.getClinicStream(start, end, page, limit));
    }
    if (tab === 'pharmacy') {
      return this.collectExportPages((page, limit) => this.api.getPharmacyStream(start, end, page, limit, location));
    }
    if (tab === 'expenses') {
      return this.collectExportPages((page, limit) => this.api.getExpenses(start, end, page, limit), 100);
    }
    if (tab === 'audit-logs') {
      return this.collectExportPages((page, limit) => this.api.getAuditLogs(page, limit), 100);
    }
    if (tab === 'closures' || tab === 'clinic-closures') {
      return of(this.currentRows());
    }
    return this.api.getCombinedSummary(start, end, location);
  }

  private collectExportPages(fetchPage: (page: number, limit: number) => Observable<any>, pageSize = 200): Observable<any[]> {
    const maximumRows = 2_000;
    return fetchPage(1, pageSize).pipe(
      expand((response: any) => {
        const currentPage = Number(response?.page ?? 1);
        const total = Math.min(Number(response?.total ?? 0), maximumRows);
        const loaded = currentPage * pageSize;
        return loaded < total && Array.isArray(response?.data) && response.data.length > 0
          ? fetchPage(currentPage + 1, pageSize)
          : EMPTY;
      }),
      reduce((rows: any[], response: any) => {
        const nextRows = Array.isArray(response?.data) ? response.data : [];
        return rows.length >= maximumRows ? rows : [...rows, ...nextRows].slice(0, maximumRows);
      }, []),
    );
  }
  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  patientName(patient: any): string { return patient ? [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ') : ''; }
  userName(user: any): string { return user?.fullName || user?.username || 'System'; }
  money(value: unknown): string { return `GHS ${Number(value ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  methodLabel(value: string): string { return ({ mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer' } as Record<string, string>)[value] ?? String(value ?? '—').replaceAll('_', ' '); }
  statusLabel(value: string): string { return String(value ?? 'posted').replaceAll('_', ' '); }
  discrepancyClass(value: unknown): string { const amount = Number(value ?? 0); return Math.abs(amount) <= .01 ? 'balanced' : amount < 0 ? 'short' : 'over'; }
  expenseCanVoid(expense: any): boolean { return expense.status !== 'voided' && expense.category !== 'supplier_payment'; }

  private firstDayOfMonth(): string {
    const now = getInternetDate();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
}
