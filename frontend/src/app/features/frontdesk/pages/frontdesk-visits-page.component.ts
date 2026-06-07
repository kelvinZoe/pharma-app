import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AppTableComponent, TableColumn } from '../../../shared/ui/app-table/app-table.component';
import { FormsModule } from '@angular/forms';

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
    </div>
  `,
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontdeskVisitsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly datePipe = inject(DatePipe);

  readonly visits = signal<any[]>([]);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly showAll = signal(false);

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
    { key: 'actions', label: 'Actions', type: 'actions', actionLabel: 'Manage' }
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
    // Handling table action clicks. For now, it could route to the billing desk or visit details.
    console.log('Action clicked for visit:', event.row.visitCode);
    alert(`Opening management view for ${event.row.patientName}`);
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
