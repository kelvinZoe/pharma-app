import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, OnInit, Output, ViewChild, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TuiButton } from '@taiga-ui/core';
import { TuiAutoColorPipe, TuiAvatar, TuiBadge, TuiInitialsPipe, TuiPagination } from '@taiga-ui/kit';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'code' | 'badge' | 'status' | 'price' | 'employee' | 'actions';
  actionLabel?: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [
    CommonModule,
    TuiPagination,
    TuiAvatar,
    TuiBadge,
    TuiButton,
    TuiInitialsPipe,
    TuiAutoColorPipe
  ],
  template: `
    <div class="table-container">
      
      <!-- Top Actions Bar -->
      <div class="table-header-bar">
        <!-- Search Input -->
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            #searchInput
            type="text"
            class="table-search-control"
            placeholder="Type search query..."
            (input)="onSearchInput(searchInput.value)"
          />
        </div>

        <!-- Export CSV Button -->
        <button
          tuiButton
          type="button"
          appearance="secondary"
          size="m"
          class="btn-export"
          (click)="exportToCsv()"
          [disabled]="loading() || data().length === 0">
          <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; margin-right: 6px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export CSV
        </button>
      </div>

      <!-- Main Table Card -->
      <div class="table-card">
        <div class="table-responsive">
          <table class="premium-table">
            <thead>
              <tr>
                <th *ngFor="let col of columns()" [class.number-col]="col.type === 'price'" [class.actions-col]="col.type === 'actions'">
                  {{ col.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading Skeleton Rows -->
              <ng-container *ngIf="loading()">
                <tr *ngFor="let dummy of [1, 2, 3, 4, 5]">
                  <td *ngFor="let col of columns()">
                    <div class="skeleton-shimmer"></div>
                  </td>
                </tr>
              </ng-container>

              <!-- Empty State -->
              <ng-container *ngIf="!loading() && data().length === 0">
                <tr>
                  <td [attr.colspan]="columns().length" class="empty-state-cell">
                    <div class="empty-state-container">
                      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                      <p class="empty-text">No matching records found in this catalog.</p>
                    </div>
                  </td>
                </tr>
              </ng-container>

              <!-- Standard Data Rows -->
              <ng-container *ngIf="!loading()">
                <tr *ngFor="let row of data()" 
                    [class.table-primary]="selectedRowId() === row[rowIdKey()]" 
                    [style.cursor]="hasRowClick ? 'pointer' : 'default'" 
                    (click)="onRowClick(row)">
                  
                  <td *ngFor="let col of columns()" [class.number-col]="col.type === 'price'">
                    
                    <!-- TEXT -->
                    <span *ngIf="!col.type || col.type === 'text'">
                      {{ getNestedValue(row, col.key) }}
                    </span>

                    <!-- CODE -->
                    <code *ngIf="col.type === 'code'">
                      {{ getNestedValue(row, col.key) }}
                    </code>

                    <!-- BADGE -->
                    <span *ngIf="col.type === 'badge'" tuiBadge appearance="neutral" size="m">
                      {{ getNestedValue(row, col.key) }}
                    </span>

                    <!-- STATUS -->
                    <span *ngIf="col.type === 'status'">
                      <span *ngIf="getNestedValue(row, col.key)" tuiBadge appearance="positive" size="m">ACTIVE</span>
                      <span *ngIf="!getNestedValue(row, col.key)" tuiBadge appearance="negative" size="m">LOCKED</span>
                    </span>

                    <!-- PRICE -->
                    <span *ngIf="col.type === 'price'" class="price-text">
                      ₵{{ toNumber(getNestedValue(row, col.key)).toFixed(2) }}
                    </span>

                    <!-- EMPLOYEE MONOGRAM AVATAR -->
                    <div *ngIf="col.type === 'employee'" class="user-identity-cell">
                      <span 
                        [tuiAvatar]="getNestedValue(row, col.key) | tuiInitials"
                        [style.background]="getNestedValue(row, col.key) | tuiAutoColor"
                        [style.color]="'#ffffff'"
                        size="s"
                        class="avatar-circle">
                      </span>
                      <div class="user-meta-info">
                        <span class="user-fullname">{{ getNestedValue(row, col.key) }}</span>
                      </div>
                    </div>

                    <!-- ACTIONS BUTTON -->
                    <div *ngIf="col.type === 'actions'" class="actions-cell">
                      <button 
                        tuiButton
                        type="button"
                        appearance="secondary" 
                        size="s" 
                        (click)="$event.stopPropagation(); onAction('click', row)">
                        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 4px;">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        {{ col.actionLabel || 'Action' }}
                      </button>
                    </div>

                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer -->
        <div class="table-footer" *ngIf="!loading() && data().length > 0">
          <div class="pagination-info">
            Showing <strong class="font-mono">{{ getRangeStart() }}-{{ getRangeEnd() }}</strong> of <strong class="font-mono">{{ total() }}</strong> entries
          </div>
          
          <div class="pagination-controls">
            <tui-pagination
                [length]="getTotalPages()"
                [index]="page() - 1"
                (indexChange)="onPageChange($event + 1)">
            </tui-pagination>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .table-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
    }

    .table-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-input-wrapper {
      position: relative;
      flex: 1;
      max-width: 360px;
      min-width: 240px;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1rem;
      height: 1rem;
      color: var(--slate-400);
      pointer-events: none;
    }

    .table-search-control {
      width: 100%;
      padding: 0.5rem 0.75rem 0.5rem 2.25rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: var(--slate-800);
      background-color: var(--white);
      border: 1px solid var(--slate-200);
      border-radius: 0.5rem;
      outline: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .table-search-control:focus {
      border-color: var(--teal-500);
      box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.1);
    }

    .btn-export {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .export-icon, .action-icon {
      width: 1rem;
      height: 1rem;
    }

    .table-card {
      background-color: var(--white);
      border: 1px solid var(--slate-200);
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: none; /* Borders only, no shadows as requested */
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
    }

    /* Core Native Table Styles */
    .premium-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background-color: var(--white);
    }

    .premium-table th,
    .premium-table td {
      padding: 0.95rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--slate-100);
      font-size: 0.85rem;
      vertical-align: middle;
      color: var(--slate-700);
      background-color: var(--white);
    }

    .premium-table th {
      font-weight: 700;
      color: var(--slate-600);
      background-color: var(--slate-50);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--slate-200);
    }

    .premium-table tbody tr {
      transition: background-color 0.15s ease;
    }

    .premium-table tbody tr:hover td {
      background-color: var(--slate-50);
      cursor: pointer;
    }

    .premium-table tbody tr.table-primary td {
      background-color: var(--teal-50);
      border-bottom-color: var(--teal-100);
    }

    .number-col {
      text-align: right;
    }

    .actions-col {
      width: 120px;
      text-align: right;
    }

    .actions-cell {
      display: flex;
      justify-content: flex-end;
    }

    .price-text {
      font-weight: 700;
      color: var(--teal-600);
      font-family: monospace;
    }

    .skeleton-shimmer {
      height: 1.25rem;
      background: linear-gradient(90deg, var(--slate-100) 25%, var(--slate-200) 50%, var(--slate-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 0.25rem;
      width: 80%;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .empty-state-cell {
      padding: 4rem 2rem !important;
    }

    .empty-state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: var(--slate-400);
    }

    .empty-icon {
      width: 3rem;
      height: 3rem;
    }

    .empty-text {
      font-size: 0.95rem;
      font-weight: 500;
      margin: 0;
    }

    /* Footer styles */
    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--slate-200);
      background-color: var(--slate-50);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .pagination-info {
      font-size: 0.875rem;
      color: var(--slate-600);
    }

    .user-identity-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .avatar-circle {
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      box-shadow: none; /* No shadow as requested */
    }

    .user-meta-info {
      display: flex;
      flex-direction: column;
    }
    
    .user-meta-info .user-fullname {
      font-weight: 700;
      color: var(--slate-800);
      font-size: 0.875rem;
    }

    /* High contrast premium clinical badges */
    [tuiBadge] {
      font-weight: 600 !important;
      font-size: 0.75rem !important;
      padding: 0.25rem 0.6rem !important;
      border-radius: 9999px !important;
      display: inline-flex !important;
      align-items: center !important;
      text-transform: none !important;
      letter-spacing: normal !important;
    }

    [tuiBadge][appearance="neutral"] {
      background-color: var(--slate-100) !important;
      color: var(--slate-700) !important;
      border: 1px solid var(--slate-200) !important;
    }

    [tuiBadge][appearance="positive"] {
      background-color: var(--teal-50) !important;
      color: var(--app-primary-color) !important;
      border: 1px solid var(--teal-100) !important;
    }

    [tuiBadge][appearance="negative"] {
      background-color: #fee2e2 !important;
      color: #b91c1c !important;
      border: 1px solid #fecaca !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppTableComponent implements OnInit {
  // Inputs
  readonly columns = input<TableColumn[]>([]);
  readonly columnKeys = computed(() => this.columns().map(c => c.key));
  readonly data = input<any[]>([]);
  readonly total = input<number>(0);
  readonly page = input<number>(1);
  readonly limit = input<number>(20);
  readonly loading = input<boolean>(false);
  readonly exportFileName = input<string>('export');
  readonly selectedRowId = input<string | null>(null);
  readonly rowIdKey = input<string>('id');

  // Outputs
  readonly pageChange = output<number>();
  readonly searchChange = output<string>();
  readonly actionClick = output<{ action: string, row: any }>();
  @Output() readonly rowClick = new EventEmitter<any>();

  // Check if there are active listeners on rowClick
  get hasRowClick(): boolean {
    return this.rowClick.observed;
  }

  private readonly searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchChange.emit(value);
    });
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onPageChange(p: number): void {
    this.pageChange.emit(p);
  }

  toNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return '';
    return path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : '', obj);
  }

  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarBg(role: number): string {
    switch (role) {
      case 0: return '#0d9488'; // Teal
      case 1: return '#3b82f6'; // Blue
      case 2: return '#8b5cf6'; // Purple
      case 3: return '#ec4899'; // Pink
      case 4: return '#f59e0b'; // Amber
      case 5: return '#10b981'; // Emerald
      default: return '#6b7280'; // Slate Gray
    }
  }

  onAction(action: string, row: any): void {
    this.actionClick.emit({ action, row });
  }

  onRowClick(row: any): void {
    if (this.hasRowClick) {
      this.rowClick.emit(row);
    }
  }

  // Range text helpers
  getRangeStart(): number {
    if (this.data().length === 0) return 0;
    return (this.page() - 1) * this.limit() + 1;
  }

  getRangeEnd(): number {
    return Math.min(this.page() * this.limit(), this.total());
  }

  getTotalPages(): number {
    return Math.ceil(this.total() / this.limit());
  }

  getPages(): number[] {
    const total = this.getTotalPages();
    const current = this.page();
    const pages: number[] = [];
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + 4);
    
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    
    for (let i = start; i <= end; i++) {
      if (i >= 1 && i <= total) {
        pages.push(i);
      }
    }
    return pages;
  }

  exportToCsv(): void {
    const dataToExport = this.data();
    if (!dataToExport || dataToExport.length === 0) return;

    const cols = this.columns().filter(c => c.type !== 'actions');
    
    // Header row
    const headers = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    
    // Data rows
    const rows = dataToExport.map(row => {
      return cols.map(c => {
        let val = this.getNestedValue(row, c.key);
        if (c.type === 'price' && typeof val === 'number') {
          val = `₵${val.toFixed(2)}`;
        } else if (c.type === 'status') {
          val = val ? 'ACTIVE' : 'LOCKED';
        }
        const stringVal = val === null || val === undefined ? '' : String(val);
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.exportFileName()}_page_${this.page()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
