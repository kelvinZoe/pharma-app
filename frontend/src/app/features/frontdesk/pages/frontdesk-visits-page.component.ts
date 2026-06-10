import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AppTableComponent, TableColumn } from '../../../shared/ui/app-table/app-table.component';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-frontdesk-visits-page',
  standalone: true,
  imports: [CommonModule, AppTableComponent, FormsModule],
  providers: [DatePipe],
  template: `
    <div class="visits-workspace">
      <div class="panel">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <h2>Visits Ledger</h2>
            
            <!-- Segmented Control Button Toggle Group -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.8rem; font-weight: 700; height: 32px; align-items: center;">
              <button 
                type="button"
                [style.background]="!showAll() ? '#ffffff' : 'transparent'"
                [style.color]="!showAll() ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="!showAll() ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="toggleShowAll(false)"
              >
                Active Queue
              </button>
              <button 
                type="button"
                [style.background]="showAll() ? '#ffffff' : 'transparent'"
                [style.color]="showAll() ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="showAll() ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="toggleShowAll(true)"
              >
                All / History
              </button>
            </div>
          </div>

          <button class="btn btn-secondary" (click)="loadVisits()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        <p class="section-desc">Track client visits currently routed through clinical radiography scanners, lab departments, or billing desks.</p>

        <!-- Using AppTable for robust tabular view instead of cards -->
        <app-table
          [columns]="columns"
          [data]="paginatedTableData()"
          [total]="filteredTableData().length"
          [page]="page()"
          [limit]="limit()"
          [loading]="loading()"
          exportFileName="visits_ledger"
          (searchChange)="onSearch($event)"
          (pageChange)="page.set($event)"
          (actionClick)="onAction($event)"
        ></app-table>

      </div>

      <!-- Delete Visit Confirmation Modal -->
      <div class="modal-backdrop" *ngIf="confirmDeleteVisit() !== null" (click)="confirmDeleteVisit.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()" style="max-width: 480px;">
          <div class="modal-card-header" style="border-bottom: none; padding-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <h3 style="color: #ef4444; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Confirm Visit Deletion
            </h3>
            <button class="modal-close-btn" (click)="confirmDeleteVisit.set(null)" style="background: none; border: none; cursor: pointer; color: var(--app-muted-text-color);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body" style="padding: 0.5rem 1.5rem 1.5rem;">
            <p style="margin: 0 0 1rem 0; font-size: 0.95rem; line-height: 1.5; color: var(--app-text-color);">
              Are you sure you want to delete the visit registration for <strong>{{ confirmDeleteVisit()?.patientName }}</strong> ({{ confirmDeleteVisit()?.visitCode }})?
            </p>
            <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.825rem; color: #991b1b; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Warning: Critical Action
              </div>
              <div>This will soft-delete the registration and cascade to voiding any invoices and payment receipts generated for this visit. Audit logs will record this transaction.</div>
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end; width: 100%;">
              <button class="btn btn-secondary" (click)="confirmDeleteVisit.set(null)" style="font-weight: 700;">Cancel</button>
              <button class="btn" style="background-color: #ef4444; color: #ffffff; border: 1px solid #ef4444; font-weight: 700;" (click)="deleteVisitConfirmed()">Delete Registration</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontdeskVisitsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly datePipe = inject(DatePipe);
  private readonly toast = inject(ToastService);

  readonly visits = signal<any[]>([]);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly showAll = signal(false);
  readonly confirmDeleteVisit = signal<any | null>(null);

  // Pagination signals
  readonly page = signal(1);
  readonly limit = signal(10);

  readonly columns: TableColumn[] = [
    { key: 'visitCode', label: 'Visit #', type: 'code' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'time', label: 'Check-in Time', type: 'text' },
    { key: 'services', label: 'Requested Services', type: 'text' },
    { key: 'statusLabel', label: 'Status', type: 'badge' },
    { key: 'total', label: 'Est. Bill', type: 'price' },
    { key: 'actions', label: 'Actions', type: 'actions', actionLabel: 'Manage', showDelete: true }
  ];

  ngOnInit(): void {
    this.loadVisits();
  }

  toggleShowAll(val: boolean): void {
    this.showAll.set(val);
    this.page.set(1);
    this.loadVisits();
  }

  loadVisits(): void {
    this.loading.set(true);
    this.api.getActiveVisits(undefined, this.showAll()).subscribe({
      next: (res) => {
        this.visits.set(res);
        this.loading.set(false);
      },

      error: (err) => {
        console.error('Error fetching active visits', err);
        this.loading.set(false);
      }
    });
  }

  readonly filteredTableData = computed(() => {
    const list = this.visits();
    const query = this.searchQuery().toLowerCase().trim();
    
    const mapped = list.map(v => ({
      ...v,
      visitCode: v.visitNumber || 'V-TBD',
      patientName: `${v.patient?.surname}, ${v.patient?.firstName}`,
      time: this.datePipe.transform(v.createdAt, 'MMM d, h:mm a') || '',
      services: (v.services || v.visitServices || []).map((s: any) => s.service?.name).join(', ') || 'Consultation',
      statusLabel: this.getStatusLabel(v.status),
      total: this.getServicesTotal(v)
    }));

    if (!query) return mapped;
    
    return mapped.filter(item => 
      item.patientName.toLowerCase().includes(query) ||
      item.visitCode.toLowerCase().includes(query) ||
      item.services.toLowerCase().includes(query)
    );
  });

  readonly paginatedTableData = computed(() => {
    const start = (this.page() - 1) * this.limit();
    return this.filteredTableData().slice(start, start + this.limit());
  });

  onSearch(q: string): void {
    this.searchQuery.set(q);
    this.page.set(1);
  }

  onAction(event: { action: string, row: any }): void {
    if (event.action === 'delete') {
      this.confirmDeleteVisit.set(event.row);
    } else {
      console.log('Action clicked for visit:', event.row.visitCode);
      alert(`Opening management view for ${event.row.patientName}`);
    }
  }

  deleteVisitConfirmed(): void {
    const target = this.confirmDeleteVisit();
    if (!target) return;

    this.api.deleteVisit(target.id).subscribe({
      next: () => {
        this.toast.success(`Visit ${target.visitCode} has been successfully deleted.`);
        this.confirmDeleteVisit.set(null);
        this.loadVisits();
      },
      error: (err) => {
        console.error('Error deleting visit', err);
        this.toast.error(err?.error?.message ?? 'Failed to delete visit.');
        this.confirmDeleteVisit.set(null);
      }
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'registered': return 'Checked In';
      case 'sent_to_department': return 'In Queue';
      case 'in_progress': return 'Procedure';
      case 'completed': return 'Awaiting Billing';
      case 'awaiting_payment': return 'Awaiting Payment';
      case 'paid': return 'Paid & Closed';
      default: return (status || 'unknown').replace('_', ' ').toUpperCase();
    }
  }

  getServicesTotal(visit: any): number {
    const svcs = visit.services || visit.visitServices;
    if (!svcs) return 0;
    return svcs
      .filter((s: any) => s.status !== 'not_done')
      .reduce((sum: number, s: any) => sum + (Number(s.unitPrice) * Number(s.quantity || 1)), 0);
  }
}
