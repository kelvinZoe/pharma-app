import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-admin-financials-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-workspace financial-dashboard-workspace">
      
      <!-- Premium Filter Bar -->
      <div class="stream-filter-bar">
        <div class="filter-inputs-group">
          <div class="form-group-item">
            <label class="filter-label">Start Date</label>
            <input type="date" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" class="filter-input-control" />
          </div>
          <div class="form-group-item">
            <label class="filter-label">End Date</label>
            <input type="date" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" class="filter-input-control" />
          </div>
          <div class="form-group-item search-item" style="min-width: 240px;">
            <label class="filter-label">Search Patient / Sale</label>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              class="filter-input-control"
              placeholder="Type name, code, or sale #..."
              style="padding-left: 0.75rem;"
            />
          </div>
        </div>

        <div class="filter-actions-group">
          <button class="action-btn btn-primary" (click)="loadData()">
            <svg class="action-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Apply Filters
          </button>
          <button class="action-btn btn-secondary" (click)="clearFilters()">
            <svg class="action-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            Reset
          </button>
        </div>

        <div class="filter-exports-group">
          <button class="action-btn btn-success" (click)="exportCSV()">
            <svg class="action-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
          </button>
          <button class="action-btn btn-print" (click)="printSummary()">
            <svg class="action-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print
          </button>
        </div>
      </div>

      <!-- Register Shift Session Banner -->
      <div class="session-bar" [class.locked]="!activeSession()">
        <div class="session-info">
          <span class="status-dot"></span>
          <span *ngIf="activeSession()">
            Active Shift Register: Open with float ₵{{ Number(activeSession().openingFloat).toFixed(2) }} (Started: {{ activeSession().createdAt | date:'shortTime' }})
          </span>
          <span *ngIf="!activeSession()">
            No active shift session. Register is locked from checkouts.
          </span>
        </div>
        <div>
          <button *ngIf="!activeSession()" class="action-btn btn-primary btn-sm" (click)="isOpeningSession.set(true)">
            Open Register
          </button>
          <button *ngIf="activeSession()" class="action-btn btn-danger btn-sm" (click)="triggerCloseSession()">
            Close Register Shift
          </button>
        </div>
      </div>

      <!-- Financial Metrics Cards -->
      <div class="financial-metrics-strip">
        <!-- Combined Revenue Card -->
        <div class="premium-stat-card revenue-card">
          <div class="stat-card-header">
            <div class="stat-icon-wrapper revenue-icon">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
                <path d="M3 20h18"></path>
              </svg>
            </div>
            <span class="stat-label">Total Combined Revenue</span>
          </div>
          <div class="stat-value text-success">₵{{ (summary()?.combinedTotal || 0).toFixed(2) }}</div>
          <div class="stat-hint">Clinic + Pharmacy streams reconciled</div>
        </div>

        <!-- Clinic Stream Card -->
        <div class="premium-stat-card clinic-card">
          <div class="stat-card-header">
            <div class="stat-icon-wrapper clinic-icon">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <span class="stat-label">Clinic Stream</span>
          </div>
          <div class="stat-value text-clinic">₵{{ (summary()?.clinicTotal || 0).toFixed(2) }}</div>
          <div class="stat-hint">{{ summary()?.clinicPaymentsCount || 0 }} frontdesk clearings</div>
        </div>

        <!-- Pharmacy Stream Card -->
        <div class="premium-stat-card pharmacy-card">
          <div class="stat-card-header">
            <div class="stat-icon-wrapper pharmacy-icon">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <span class="stat-label">Pharmacy Stream</span>
          </div>
          <div class="stat-value text-pharmacy">₵{{ (summary()?.pharmacyTotal || 0).toFixed(2) }}</div>
          <div class="stat-hint">{{ summary()?.pharmacySalesCount || 0 }} POS register receipts</div>
        </div>

        <!-- Momo / Cash Ratio Card -->
        <div class="premium-stat-card ratio-card">
          <div class="stat-card-header">
            <div class="stat-icon-wrapper ratio-icon">
              <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <span class="stat-label">Payment Method Mix</span>
          </div>
          <div class="ratio-values-grid">
            <div class="ratio-value-item">
              <span class="ratio-label-sub">CASH</span>
              <strong class="ratio-val text-muted">₵{{ (summary()?.paymentMethodsBreakdown?.cash || 0).toFixed(0) }}</strong>
            </div>
            <div class="ratio-value-item">
              <span class="ratio-label-sub">MOMO</span>
              <strong class="ratio-val text-primary">₵{{ (summary()?.paymentMethodsBreakdown?.mobileMoney || 0).toFixed(0) }}</strong>
            </div>
          </div>
          <div class="stat-hint">Active collection breakdown</div>
        </div>
      </div>

      <!-- Capsule Segmented Tab Control -->
      <div class="financial-tabs-segment">
        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'dashboard'"
          (click)="selectTab('dashboard')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
          Daily Summary
        </button>

        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'clinic'"
          (click)="selectTab('clinic')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          Clinic Receipts
        </button>

        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'pharmacy'"
          (click)="selectTab('pharmacy')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 5h20c0-2-1-3.75-2.5-5M12 2v10M8 6h8"></path>
            <rect x="5" y="12" width="14" height="6" rx="1"></rect>
          </svg>
          Pharmacy POS Sales
        </button>

        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'closures'"
          (click)="selectTab('closures')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Daily Closures
        </button>

        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'expenses'"
          (click)="selectTab('expenses')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          Expense Log
        </button>

        <button
          class="tab-segment-btn alert-tab-btn"
          [class.active]="activeTab() === 'inventory'"
          [class.has-alerts]="(summary()?.lowStockAlertsCount || 0) + (summary()?.expiryAlertsCount || 0) > 0"
          (click)="selectTab('inventory')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Inventory Alerts
          <span *ngIf="(summary()?.lowStockAlertsCount || 0) + (summary()?.expiryAlertsCount || 0) > 0" class="badge-danger-pulsing">
            {{ (summary()?.lowStockAlertsCount || 0) + (summary()?.expiryAlertsCount || 0) }}
          </span>
        </button>

        <button
          class="tab-segment-btn"
          [class.active]="activeTab() === 'audit-logs'"
          (click)="selectTab('audit-logs')"
        >
          <svg class="tab-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Audit Logs
        </button>
      </div>

      <!-- Shimmer Loading / Spinner Indicator -->
      <div *ngIf="isLoading()" class="loading-state-card">
        <div class="spinner-circle-wrapper">
          <svg class="spinner-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
            <circle cx="12" cy="12" r="10" stroke="rgba(226, 232, 240, 0.8)"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--app-primary-color)"></path>
          </svg>
        </div>
        <p class="loading-text">Querying ledger records...</p>
      </div>

      <!-- Tab Content: Dashboard Summary -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'dashboard'">
        <!-- Visual SVG Analytics Charts Strip -->
        <div class="financial-dashboard-charts">
          <!-- 7-Day combined revenue bar chart -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Weekly Revenue Trend</h3>
              <div class="chart-legend">
                <span class="legend-dot"></span>
                <span>Combined GHS (Clinic + POS)</span>
              </div>
            </div>
            
            <div class="chart-container">
              <div class="y-axis">
                <span>₵{{ getMaxRevenue().toFixed(0) }}</span>
                <span>₵{{ (getMaxRevenue() / 2).toFixed(0) }}</span>
                <span>₵0</span>
              </div>
              <div class="chart-bars">
                <div class="chart-column" *ngFor="let item of summary()?.chartData">
                  <div class="bar-wrapper">
                    <div class="bar-value-tooltip">₵{{ item.total.toFixed(2) }}</div>
                    <div class="bar-fill" [style.height.%]="getBarHeight(item.total)"></div>
                  </div>
                  <span class="bar-label">{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Momo vs Cash Circular Progress ring -->
          <div class="chart-card text-center">
            <div class="chart-header" style="justify-content: center;">
              <h3>Momo Ratio</h3>
            </div>
            
            <div class="circular-gauge" style="margin-top: 1rem;">
              <svg class="gauge-svg" viewBox="0 0 120 120">
                <circle class="gauge-bg" cx="60" cy="60" r="54" />
                <circle
                  class="gauge-progress"
                  cx="60"
                  cy="60"
                  r="54"
                  [style.stroke-dashoffset]="getStrokeDashoffset()"
                />
              </svg>
              <div class="gauge-content">
                <span class="percentage">{{ getMomoPercent() }}%</span>
                <span class="label">Momo Split</span>
              </div>
            </div>
            <p class="stat-hint" style="margin-top: 1rem;">Digital collections portion share</p>
          </div>
        </div>

        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Daily Operations & Audit Logs</h2>
            <p class="section-desc">Date-specific reconciliation snapshot of the entire facility including stock alert triggers.</p>
          </div>
        </div>
        
        <div class="report-section-grid">
          <!-- Stock Warnings Card -->
          <div class="reconciliation-report-card">
            <div class="card-title-bar text-danger-bar">
              <svg class="card-title-icon text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3>Product Low Stock Warnings</h3>
            </div>
            
            <div class="card-body-content">
              <div *ngIf="summary()?.lowStockAlerts?.length > 0; else noLowStock" class="premium-table-container">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Current Stock</th>
                      <th>Reorder Lvl</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of summary()?.lowStockAlerts">
                      <td><code class="clinical-code">{{ p.productCode }}</code></td>
                      <td><strong class="item-name-bold">{{ p.name }}</strong></td>
                      <td class="numeric-highlight text-danger">{{ p.stockOnHand }} {{ p.unitOfMeasure }}</td>
                      <td class="text-secondary-label">{{ p.reorderLevel }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ng-template #noLowStock>
                <div class="all-good-card success">
                  <svg class="all-good-icon text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>All pharmacy product stock counts are above reorder thresholds.</p>
                </div>
              </ng-template>
            </div>
          </div>

          <!-- Impending Expirations Card -->
          <div class="reconciliation-report-card">
            <div class="card-title-bar text-warning-bar">
              <svg class="card-title-icon text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3>Impending Expiry Batches</h3>
            </div>
            
            <div class="card-body-content">
              <div *ngIf="summary()?.expiryAlerts?.length > 0; else noExpiry" class="premium-table-container">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch</th>
                      <th>Expiry Date</th>
                      <th>Countdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let e of summary()?.expiryAlerts">
                      <td><strong class="item-name-bold">{{ e.productName }}</strong></td>
                      <td><code class="clinical-code">{{ e.batchNumber }}</code></td>
                      <td class="text-secondary-label">{{ e.expiryDate | date:'mediumDate' }}</td>
                      <td>
                        <span class="status-badge-pill warning">
                          {{ e.daysRemaining }} days remaining
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ng-template #noExpiry>
                <div class="all-good-card success">
                  <svg class="all-good-icon text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>No active stock batches are expiring within the next 3 months.</p>
                </div>
              </ng-template>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content: Clinic Stream Receipts -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'clinic'">
        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Clinic Ledger (₵ Collections)</h2>
            <p class="section-desc">Shows individual clinic invoice clearances. Includes procedure invoices generated after diagnostic checks.</p>
          </div>
        </div>

        <div class="premium-table-container" *ngIf="filteredClinicPayments().length > 0; else emptyClinic">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Receipt ID</th>
                <th>Patient Details</th>
                <th>Payment Date</th>
                <th>Method</th>
                <th>Audit Ref</th>
                <th>Received By</th>
                <th class="number-col">Paid Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of filteredClinicPayments()">
                <td><code class="clinical-code">{{ p.id.substring(0, 8) }}</code></td>
                <td>
                  <span class="patient-name-span">{{ p.invoice?.visit?.patient?.surname }}, {{ p.invoice?.visit?.patient?.firstName }}</span>
                  <div class="small-text-meta">{{ p.invoice?.visit?.patient?.code }} • {{ p.invoice?.visit?.patient?.phone }}</div>
                </td>
                <td class="text-secondary-label">{{ p.paidAt | date:'medium' }}</td>
                <td>
                  <span class="status-badge-pill" [class.cash]="p.paymentMethod === 'cash'" [class.momo]="p.paymentMethod === 'mobile_money'">
                    {{ p.paymentMethod === 'cash' ? 'CASH' : 'MOMO' }}
                  </span>
                </td>
                <td><code class="clinical-code font-muted">{{ p.referenceNumber || 'N/A' }}</code></td>
                <td class="text-secondary-label">{{ p.receivedByUser?.fullName || p.receivedByUser?.username }}</td>
                <td class="number-col bold-monospaced">₵{{ Number(p.amount).toFixed(2) }}</td>
                <td>
                  <span class="status-badge-pill" [class.danger]="p.status === 'voided'" [class.success]="p.status === 'paid' || !p.status">
                    {{ p.status === 'voided' ? 'VOIDED' : 'PAID' }}
                  </span>
                  <div *ngIf="p.status === 'voided'" class="small-text-meta text-danger">Reason: {{ p.voidReason }}</div>
                </td>
                <td>
                  <button *ngIf="p.status !== 'voided'" class="action-btn btn-danger btn-sm" (click)="openVoidModal(p.id, 'clinic')">
                    Void
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination control bar -->
          <div class="pagination-footer">
            <div>
              Showing {{ (clinicPage() - 1) * 10 + 1 }} to {{ Math.min(clinicPage() * 10, clinicTotal()) }} of {{ clinicTotal() }} entries
            </div>
            <div class="pagination-actions">
              <button class="pg-btn" [disabled]="clinicPage() === 1" (click)="changeClinicPage(clinicPage() - 1)">Previous</button>
              <button class="pg-btn" [disabled]="clinicPage() * 10 >= clinicTotal()" (click)="changeClinicPage(clinicPage() + 1)">Next</button>
            </div>
          </div>
        </div>
        <ng-template #emptyClinic>
          <div class="empty-state-illustrate">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p>No clinic collections recorded in the selected period.</p>
          </div>
        </ng-template>
      </div>

      <!-- Tab Content: Pharmacy POS Stream -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'pharmacy'">
        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Pharmacy Sales Journal</h2>
            <p class="section-desc">Details direct pharmacy transactions. Includes clinic-referred checkouts and direct walk-in pharmacy sales.</p>
          </div>
        </div>

        <div class="premium-table-container" *ngIf="filteredPharmacySales().length > 0; else emptyPharmacy">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Sale #</th>
                <th>Client Source</th>
                <th>Patient Details</th>
                <th>Sale Date</th>
                <th>Method</th>
                <th>Dispensed By</th>
                <th class="number-col">Sale Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of filteredPharmacySales()">
                <td><strong class="item-name-bold">{{ s.saleNumber }}</strong></td>
                <td>
                  <span class="status-badge-pill" [class.walk-in]="s.saleSource === 'walk_in'" [class.referred]="s.saleSource === 'clinic_referred'">
                    {{ s.saleSource === 'walk_in' ? 'WALK-IN' : 'CLINIC REF' }}
                  </span>
                </td>
                <td>
                  <span *ngIf="s.visit?.patient; else walkInInfo">
                    <span class="patient-name-span">{{ s.visit.patient.surname }}, {{ s.visit.patient.firstName }}</span>
                    <div class="small-text-meta">{{ s.visit.patient.code }}</div>
                  </span>
                  <ng-template #walkInInfo>
                    <span class="walk-in-text-label">Walk-in Pharmacy Buyer</span>
                  </ng-template>
                </td>
                <td class="text-secondary-label">{{ s.paidAt | date:'medium' }}</td>
                <td>
                  <span class="status-badge-pill" [class.cash]="s.paymentMethod === 'cash'" [class.momo]="s.paymentMethod === 'mobile_money'">
                    {{ s.paymentMethod === 'cash' ? 'CASH' : 'MOMO' }}
                  </span>
                </td>
                <td><code class="clinical-code font-muted">{{ s.soldByUser?.fullName || s.soldByUser?.username }}</code></td>
                <td class="number-col bold-monospaced">₵{{ Number(s.total).toFixed(2) }}</td>
                <td>
                  <span class="status-badge-pill" [class.danger]="s.status === 'voided'" [class.success]="s.status === 'paid' || !s.status">
                    {{ s.status === 'voided' ? 'VOIDED' : 'PAID' }}
                  </span>
                  <div *ngIf="s.status === 'voided'" class="small-text-meta text-danger">Reason: {{ s.voidReason }}</div>
                </td>
                <td>
                  <button *ngIf="s.status !== 'voided'" class="action-btn btn-danger btn-sm" (click)="openVoidModal(s.id, 'pharmacy')">
                    Void
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination control bar -->
          <div class="pagination-footer">
            <div>
              Showing {{ (pharmacyPage() - 1) * 10 + 1 }} to {{ Math.min(pharmacyPage() * 10, pharmacyTotal()) }} of {{ pharmacyTotal() }} entries
            </div>
            <div class="pagination-actions">
              <button class="pg-btn" [disabled]="pharmacyPage() === 1" (click)="changePharmacyPage(pharmacyPage() - 1)">Previous</button>
              <button class="pg-btn" [disabled]="pharmacyPage() * 10 >= pharmacyTotal()" (click)="changePharmacyPage(pharmacyPage() + 1)">Next</button>
            </div>
          </div>
        </div>
        <ng-template #emptyPharmacy>
          <div class="empty-state-illustrate">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p>No pharmacy sales recorded in the selected period.</p>
          </div>
        </ng-template>
      </div>

      <!-- Tab Content: Pharmacy Daily Closures -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'closures'">
        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Pharmacy Daily Closures Ledger</h2>
            <p class="section-desc">Shift register reconciliations & drawer status history. Audits physical counted drawers against system records.</p>
          </div>
        </div>

        <div class="premium-table-container" *ngIf="closures().length > 0; else emptyClosures">
          <table class="premium-table table-clickable-rows">
            <thead>
              <tr>
                <th>Closed Date</th>
                <th>Pharmacist</th>
                <th class="number-col">Opening Float</th>
                <th class="number-col">Sales Count</th>
                <th class="number-col">Expected Sales</th>
                <th class="number-col">Drawer Sum (Expected)</th>
                <th class="number-col">Counted (Physical)</th>
                <th>Discrepancy Variance</th>
                <th style="width: 120px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of closures()" (click)="inspectClosure(c.id)" class="hover-clickable-row">
                <td><strong class="item-name-bold">{{ c.closureDate | date:'yyyy-MM-dd HH:mm' }}</strong></td>
                <td>
                  <span class="patient-name-span">{{ c.closedByUser?.fullName || c.closedByUser?.username }}</span>
                  <div class="small-text-meta">&#64;{{ c.closedByUser?.username }}</div>
                </td>
                <td class="number-col bold-monospaced">₵{{ Number(c.openingFloat).toFixed(2) }}</td>
                <td class="number-col bold-monospaced">{{ c.totalSalesCount }} sales</td>
                <td class="number-col bold-monospaced">₵{{ Number(c.totalSalesAmount).toFixed(2) }}</td>
                <td class="number-col bold-monospaced text-highlight">₵{{ (Number(c.totalSalesAmount) + Number(c.openingFloat)).toFixed(2) }}</td>
                <td class="number-col counted-breakdown-cell">
                  <div>Cash: ₵{{ Number(c.cashCounted).toFixed(2) }}</div>
                  <div>Momo: ₵{{ Number(c.momoCounted).toFixed(2) }}</div>
                </td>
                <td>
                  <span class="status-badge-pill" [class.success]="Number(c.discrepancy) === 0" [class.danger]="Number(c.discrepancy) < 0" [class.warning]="Number(c.discrepancy) > 0">
                    ₵{{ Number(c.discrepancy) >= 0 ? '+' : '' }}{{ Number(c.discrepancy).toFixed(2) }}
                  </span>
                </td>
                <td (click)="$event.stopPropagation()">
                  <button class="action-btn btn-secondary btn-table-action" (click)="inspectClosure(c.id)">
                    Inspect
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #emptyClosures>
          <div class="empty-state-illustrate">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <p>No shift closures recorded in the selected period.</p>
          </div>
        </ng-template>
      </div>

      <!-- Tab Content: Expense Log -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'expenses'">
        <!-- Expense Financial Metrics Strip -->
        <div class="financial-metrics-strip">
          <div class="premium-stat-card">
            <span class="stat-label">Manual Expenses</span>
            <div class="stat-value text-muted">₵{{ (summary()?.manualExpensesTotal || 0).toFixed(2) }}</div>
            <div class="stat-hint">Utilities, Salaries, Rent, etc.</div>
          </div>
          <div class="premium-stat-card">
            <span class="stat-label">Inventory Expenses</span>
            <div class="stat-value text-muted">₵{{ (summary()?.inventoryExpensesTotal || 0).toFixed(2) }}</div>
            <div class="stat-hint">Automated medicine batch purchasing costs</div>
          </div>
          <div class="premium-stat-card">
            <span class="stat-label">Total Outflow</span>
            <div class="stat-value text-danger">₵{{ (summary()?.totalExpenses || 0).toFixed(2) }}</div>
            <div class="stat-hint">Reconciled overhead costs</div>
          </div>
          <div class="premium-stat-card">
            <span class="stat-label">Reconciled Net Profit</span>
            <div class="stat-value" [class.text-success]="(summary()?.netProfit || 0) >= 0" [class.text-danger]="(summary()?.netProfit || 0) < 0">
              ₵{{ (summary()?.netProfit || 0).toFixed(2) }}
            </div>
            <div class="stat-hint">Revenue - Total Outflow</div>
          </div>
        </div>

        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Outflow Expense Log</h2>
            <p class="section-desc">Tracks manual operational expenses alongside inventory intake costs.</p>
          </div>
          <div>
            <button class="action-btn btn-primary" (click)="isAddingExpense.set(true)">
              Add Operational Expense
            </button>
          </div>
        </div>

        <div class="premium-table-container" *ngIf="expenses().length > 0; else emptyExpenses">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Expense Date</th>
                <th>Expense Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Recorded By</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of expenses()">
                <td><strong class="item-name-bold">{{ e.expenseDate | date:'yyyy-MM-dd HH:mm' }}</strong></td>
                <td>{{ e.title }}</td>
                <td>
                  <span class="status-badge-pill" [class.walk-in]="e.category === 'inventory'" [class.referred]="e.category === 'salaries'" [class.cash]="e.category === 'utilities'" [class.momo]="e.category === 'rent'">
                    {{ e.category | uppercase }}
                  </span>
                </td>
                <td class="bold-monospaced">₵{{ Number(e.amount).toFixed(2) }}</td>
                <td class="text-secondary-label">{{ e.createdByUser?.fullName || e.createdByUser?.username || 'Auto (Batch Intake)' }}</td>
                <td><span class="font-muted">{{ e.notes || 'N/A' }}</span></td>
                <td>
                  <button *ngIf="e.category !== 'inventory'" class="action-btn btn-danger btn-sm" (click)="deleteExpense(e.id)">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination control bar -->
          <div class="pagination-footer">
            <div>
              Showing {{ (expensePage() - 1) * 10 + 1 }} to {{ Math.min(expensePage() * 10, expenseTotal()) }} of {{ expenseTotal() }} entries
            </div>
            <div class="pagination-actions">
              <button class="pg-btn" [disabled]="expensePage() === 1" (click)="changeExpensePage(expensePage() - 1)">Previous</button>
              <button class="pg-btn" [disabled]="expensePage() * 10 >= expenseTotal()" (click)="changeExpensePage(expensePage() + 1)">Next</button>
            </div>
          </div>
        </div>
        <ng-template #emptyExpenses>
          <div class="empty-state-illustrate">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p>No operational expenses recorded in the selected period.</p>
          </div>
        </ng-template>
      </div>

      <!-- Tab Content: Inventory Alerts -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'inventory'">
        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>Stock Levels & Product Warnings</h2>
            <p class="section-desc">Audit report of low-stock count medicines and upcoming batch expirations to avoid dead stock.</p>
          </div>
        </div>

        <div class="report-section-grid">
          <!-- Low Stock Card -->
          <div class="reconciliation-report-card full-width-card">
            <div class="card-title-bar text-danger-bar">
              <svg class="card-title-icon text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3>Out-of-Stock and Low-Stock Products</h3>
            </div>
            
            <div class="card-body-content">
              <div *ngIf="summary()?.lowStockAlerts?.length > 0; else allGoodStock" class="premium-table-container">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Remaining Stock</th>
                      <th>Reorder Limit</th>
                      <th>UOM</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of summary()?.lowStockAlerts">
                      <td><code class="clinical-code">{{ p.productCode }}</code></td>
                      <td><strong class="item-name-bold">{{ p.name }}</strong></td>
                      <td class="numeric-highlight text-danger">{{ p.stockOnHand }}</td>
                      <td class="text-secondary-label">{{ p.reorderLevel }}</td>
                      <td class="text-secondary-label">{{ p.unitOfMeasure }}</td>
                      <td>
                        <span class="status-badge-pill danger">
                          {{ p.stockOnHand === 0 ? 'OUT OF STOCK' : 'LOW STOCK' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ng-template #allGoodStock>
                <div class="all-good-card success">
                  <svg class="all-good-icon text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>All pharmacy products are currently above reorder levels.</p>
                </div>
              </ng-template>
            </div>
          </div>

          <!-- Expirations Card -->
          <div class="reconciliation-report-card full-width-card">
            <div class="card-title-bar text-warning-bar">
              <svg class="card-title-icon text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3>Expiry Date Monitoring (Next 90 Days)</h3>
            </div>
            
            <div class="card-body-content">
              <div *ngIf="summary()?.expiryAlerts?.length > 0; else allGoodExpiry" class="premium-table-container">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Batch Number</th>
                      <th>Active Stock</th>
                      <th>Expiry Date</th>
                      <th>Audit Alert Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let e of summary()?.expiryAlerts">
                      <td><strong class="item-name-bold">{{ e.productName }}</strong></td>
                      <td><code class="clinical-code">{{ e.batchNumber }}</code></td>
                      <td class="text-secondary-label">{{ e.quantityRemaining }} units</td>
                      <td class="text-secondary-label">{{ e.expiryDate | date:'mediumDate' }}</td>
                      <td>
                        <span class="status-badge-pill warning pulse-alert">
                          {{ e.daysRemaining }} days remaining
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ng-template #allGoodExpiry>
                <div class="all-good-card success">
                  <svg class="all-good-icon text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>No active batches are expiring in the next 3 months.</p>
                </div>
              </ng-template>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content: Audit Logs -->
      <div class="panel full-width premium-panel-layout" *ngIf="!isLoading() && activeTab() === 'audit-logs'">
        <div class="panel-header-reconciled">
          <div class="panel-title-block">
            <h2>System Audit Logs</h2>
            <p class="section-desc">Inspect all key administrative operations, deleted patient registrations, payment voids, and security updates.</p>
          </div>
        </div>

        <div class="premium-table-container" *ngIf="auditLogs().length > 0; else emptyAudit">
          <table class="premium-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Staff</th>
                <th>Action Type</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Change Details</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of auditLogs()">
                <td class="text-secondary-label" style="white-space: nowrap;">{{ log.createdAt | date:'medium' }}</td>
                <td>
                  <strong class="patient-name-span">{{ log.actorUser?.fullName || 'System' }}</strong>
                  <div class="small-text-meta">&#64;{{ log.actorUser?.username || 'system' }}</div>
                </td>
                <td>
                  <span class="status-badge-pill" [class.danger]="log.actionType.includes('delete') || log.actionType.includes('void')" [class.warning]="log.actionType === 'update'" [class.success]="log.actionType === 'create'">
                    {{ log.actionType | uppercase }}
                  </span>
                </td>
                <td>
                  <span class="status-badge-pill referred">{{ log.entityType | uppercase }}</span>
                </td>
                <td><code class="clinical-code font-muted">{{ log.entityId }}</code></td>
                <td>
                  <div style="font-size: 0.8rem; line-height: 1.4; max-width: 450px; overflow-wrap: break-word;">
                    <div *ngIf="log.beforeData">
                      <span style="font-weight: 700; color: var(--app-danger-color); font-size: 0.725rem;">Before:</span>
                      <code style="font-size: 0.75rem; background-color: var(--slate-100); padding: 0.1rem 0.25rem; border-radius: 0.25rem; display: block; margin-top: 0.15rem; word-break: break-all; font-family: monospace;">{{ log.beforeData }}</code>
                    </div>
                    <div *ngIf="log.afterData" style="margin-top: 0.35rem;">
                      <span style="font-weight: 700; color: var(--app-success-color); font-size: 0.725rem;">After:</span>
                      <code style="font-size: 0.75rem; background-color: var(--slate-100); padding: 0.1rem 0.25rem; border-radius: 0.25rem; display: block; margin-top: 0.15rem; word-break: break-all; font-family: monospace;">{{ log.afterData }}</code>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination control bar -->
          <div class="pagination-footer">
            <div>
              Showing {{ (auditLogPage() - 1) * 10 + 1 }} to {{ Math.min(auditLogPage() * 10, auditLogTotal()) }} of {{ auditLogTotal() }} entries
            </div>
            <div class="pagination-actions">
              <button class="pg-btn" [disabled]="auditLogPage() === 1" (click)="changeAuditPage(auditLogPage() - 1)">Previous</button>
              <button class="pg-btn" [disabled]="auditLogPage() * 10 >= auditLogTotal()" (click)="changeAuditPage(auditLogPage() + 1)">Next</button>
            </div>
          </div>
        </div>
        <ng-template #emptyAudit>
          <div class="empty-state-illustrate">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="17"></line>
            </svg>
            <p>No audit log entries recorded in the system.</p>
          </div>
        </ng-template>
      </div>

      <!-- Audit Drilldown Drawer Panel -->
      <div class="audit-drawer-backdrop" *ngIf="showAuditDrawer() && selectedClosure()" (click)="showAuditDrawer.set(false)">
        <div class="audit-drawer-content" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h3>Reconciliation Shift Audit</h3>
            <button class="close-btn" (click)="showAuditDrawer.set(false)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="drawer-body">
            <div class="closure-summary-card">
              <div class="meta-row">
                <span>Session ID:</span>
                <strong class="bold-monospaced">CLS-{{ selectedClosure().id.slice(-6).toUpperCase() }}</strong>
              </div>
              <div class="meta-row">
                <span>Opened By:</span>
                <strong>{{ selectedClosure().openedByUser?.fullName || selectedClosure().openedByUser?.username || 'N/A' }}</strong>
              </div>
              <div class="meta-row">
                <span>Opening Float:</span>
                <strong class="bold-monospaced">₵{{ Number(selectedClosure().openingFloat).toFixed(2) }}</strong>
              </div>
              <div class="meta-row">
                <span>Closed Date:</span>
                <strong>{{ selectedClosure().closureDate | date:'medium' }}</strong>
              </div>
              <div class="meta-row">
                <span>Closed By:</span>
                <strong>{{ selectedClosure().closedByUser?.fullName || selectedClosure().closedByUser?.username }}</strong>
              </div>
              <div class="meta-row">
                <span>Discrepancy:</span>
                <span class="status-badge-pill" [class.success]="selectedClosure().discrepancy == 0" [class.danger]="selectedClosure().discrepancy < 0" [class.warning]="selectedClosure().discrepancy > 0">
                  ₵{{ selectedClosure().discrepancy >= 0 ? '+' : '' }}{{ Number(selectedClosure().discrepancy).toFixed(2) }}
                </span>
              </div>
              
              <div class="drawer-notes" *ngIf="selectedClosure().notes">
                <strong>Pharmacist Notes:</strong>
                <p class="notes-quote">"{{ selectedClosure().notes }}"</p>
              </div>
            </div>

            <!-- Reconciliation summary table -->
            <div class="drawer-section">
              <h4 class="drawer-section-title">Drawer Reconciliation Summary</h4>
              <div class="premium-table-container">
                <table class="premium-table font-sm">
                  <thead>
                    <tr>
                      <th>Ledger Type</th>
                      <th class="number-col">Expected (System)</th>
                      <th class="number-col">Counted (Physical)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Opening Float Cash</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().openingFloat).toFixed(2) }}</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().openingFloat).toFixed(2) }}</td>
                    </tr>
                    <tr>
                      <td>Sales Total (System expected)</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().totalSalesAmount).toFixed(2) }}</td>
                      <td class="number-col bold-monospaced">₵{{ (Number(selectedClosure().cashCounted) + Number(selectedClosure().momoCounted) - Number(selectedClosure().openingFloat)).toFixed(2) }}</td>
                    </tr>
                    <tr class="table-total-row-highlight">
                      <td>Total Drawer expected</td>
                      <td class="number-col bold-monospaced">₵{{ (Number(selectedClosure().totalSalesAmount) + Number(selectedClosure().openingFloat)).toFixed(2) }}</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().totalCounted).toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Associated POS Invoices List -->
            <div class="drawer-section">
              <h4 class="drawer-section-title split-title-row">
                <span>Reconciled Receipts ({{ selectedClosure().sales?.length || 0 }})</span>
                <span class="title-helper-sub">Click row to drilldown items</span>
              </h4>
              
              <div class="receipts-list-stack">
                <div *ngFor="let s of selectedClosure().sales" class="receipt-compact-card" [class.expanded]="selectedSaleId() === s.id" (click)="toggleSaleDetails(s.id)">
                  <div class="receipt-card-header-row">
                    <div class="receipt-number-block">
                      <strong class="receipt-num">{{ s.saleNumber }}</strong>
                      <span class="receipt-time">{{ s.paidAt | date:'shortTime' }}</span>
                    </div>
                    <div class="receipt-amount-block">
                      <span class="status-badge-pill" [class.cash]="s.paymentMethod === 'cash'" [class.momo]="s.paymentMethod === 'mobile_money'">
                        {{ s.paymentMethod === 'cash' ? 'CASH' : 'MOMO' }}
                      </span>
                      <strong class="receipt-total bold-monospaced">₵{{ Number(s.total).toFixed(2) }}</strong>
                    </div>
                  </div>
                  
                  <div class="receipt-card-sub-row">
                    <span>Cust: {{ s.customerName || 'Walk-In Buyer' }}</span>
                    <span>Ref ID: VIS-{{ s.visitId ? s.visitId.slice(-6).toUpperCase() : 'N/A' }}</span>
                  </div>

                  <!-- Thermal Drilldown Receipt Details -->
                  <div class="thermal-drilldown-receipt" *ngIf="selectedSaleId() === s.id" (click)="$event.stopPropagation()">
                    <div class="header">
                      <h4>ANTIGRAVITY PHARMACY</h4>
                      <p>INVOICE DETAIL / SHIFT LOCK AUDIT</p>
                    </div>
                    <div class="meta">
                      <div>TXN ID: {{ s.saleNumber }}</div>
                      <div>DATE: {{ s.paidAt | date:'yyyy-MM-dd HH:mm' }}</div>
                      <div>CLIENT: {{ s.customerName || 'Walk-In Buyer' }}</div>
                      <div>PAY METHOD: {{ s.paymentMethod | uppercase }}</div>
                    </div>
                    <table class="item-table">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th class="num">Qty</th>
                          <th class="num">Unit</th>
                          <th class="num">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let item of s.items">
                          <td>
                            <div class="item-name-thermal">{{ item.itemName || 'Dispensed Medicine' }}</div>
                            <div class="batch-sub-label">[Batch: {{ item.batchNumber || 'N/A' }}]</div>
                          </td>
                          <td class="num font-monospaced">{{ item.quantity }}</td>
                          <td class="num font-monospaced">₵{{ Number(item.unitPrice).toFixed(2) }}</td>
                          <td class="num font-monospaced">₵{{ Number(item.lineTotal).toFixed(2) }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="totals">
                      <div class="grand">
                        <span>TOTAL GHS:</span>
                        <span>₵{{ Number(s.total).toFixed(2) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialogue: Open Session -->
      <div class="modal-backdrop" *ngIf="isOpeningSession()">
        <div class="modal-card">
          <div class="modal-card-header">
            <h3>Open Shift Register Session</h3>
            <button class="modal-close-btn" (click)="isOpeningSession.set(false)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Opening Float Cash (₵)</label>
              <input type="number" class="form-control" [ngModel]="openingFloatInput()" (ngModelChange)="openingFloatInput.set($event)" />
              <p class="stat-hint" style="margin-top: 0.25rem;">Enter the physical cash amount kept in the register for change.</p>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
              <button class="btn btn-secondary" (click)="isOpeningSession.set(false)">Cancel</button>
              <button class="btn btn-primary" (click)="openRegisterSession()">Open Register</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialogue: Close Session -->
      <div class="modal-backdrop" *ngIf="isClosingSession()">
        <div class="modal-card">
          <div class="modal-card-header">
            <h3>Close Register Shift Session</h3>
            <button class="modal-close-btn" (click)="isClosingSession.set(false)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Counted Cash (₵)</label>
              <input type="number" class="form-control" [ngModel]="closeCashCounted()" (ngModelChange)="closeCashCounted.set($event)" />
            </div>
            <div class="form-group">
              <label>Counted Mobile Money (₵)</label>
              <input type="number" class="form-control" [ngModel]="closeMomoCounted()" (ngModelChange)="closeMomoCounted.set($event)" />
            </div>
            <div class="form-group">
              <label>Shift Notes</label>
              <textarea class="form-control" [ngModel]="closeNotes()" (ngModelChange)="closeNotes.set($event)" placeholder="Enter shift notes or discrepancy reasons..."></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
              <button class="btn btn-secondary" (click)="isClosingSession.set(false)">Cancel</button>
              <button class="btn btn-danger" (click)="closeRegisterSession()">Close Shift</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialogue: Void Transaction -->
      <div class="modal-backdrop" *ngIf="isVoiding() && voidTarget()">
        <div class="modal-card">
          <div class="modal-card-header">
            <h3>Void Transaction</h3>
            <button class="modal-close-btn" (click)="cancelVoid()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Reason for Cancellation</label>
              <textarea class="form-control" [ngModel]="voidReason()" (ngModelChange)="voidReason.set($event)" placeholder="Why are you voiding this transaction? (Required)"></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
              <button class="btn btn-secondary" (click)="cancelVoid()">Cancel</button>
              <button class="btn btn-danger" [disabled]="!voidReason().trim()" (click)="confirmVoid()">Void Transaction</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialogue: Add Manual Expense -->
      <div class="modal-backdrop" *ngIf="isAddingExpense()">
        <div class="modal-card">
          <div class="modal-card-header">
            <h3>Record Operational Expense</h3>
            <button class="modal-close-btn" (click)="isAddingExpense.set(false)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Expense Date</label>
              <input type="date" class="form-control" [ngModel]="expenseDate()" (ngModelChange)="expenseDate.set($event)" />
            </div>
            <div class="form-group">
              <label>Expense Title / Description</label>
              <input type="text" class="form-control" [ngModel]="expenseTitle()" (ngModelChange)="expenseTitle.set($event)" placeholder="Electricity bill, cleaner wage..." />
            </div>
            <div class="form-group">
              <label>Overhead Category</label>
              <select class="form-control" [ngModel]="expenseCategory()" (ngModelChange)="expenseCategory.set($event)">
                <option value="utilities">Utilities</option>
                <option value="salaries">Salaries</option>
                <option value="rent">Rent</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Amount Paid (₵)</label>
              <input type="number" class="form-control" [ngModel]="expenseAmount()" (ngModelChange)="expenseAmount.set($event)" />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea class="form-control" [ngModel]="expenseNotes()" (ngModelChange)="expenseNotes.set($event)"></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
              <button class="btn btn-secondary" (click)="isAddingExpense.set(false)">Cancel</button>
              <button class="btn btn-primary" [disabled]="!expenseTitle().trim() || expenseAmount() <= 0" (click)="saveExpense()">Save Expense</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .financial-dashboard-charts {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 900px) {
      .financial-dashboard-charts {
        grid-template-columns: 1fr;
      }
    }
    .chart-card {
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: none;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .chart-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--slate-800);
    }
    .chart-legend {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.76rem;
      color: var(--slate-600);
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      background: var(--teal-500);
      border-radius: 50%;
    }
    .chart-container {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1rem;
      height: 180px;
    }
    .y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--slate-600);
      border-right: 1px solid var(--slate-200);
      padding-right: 0.5rem;
      text-align: right;
    }
    .chart-bars {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-left: 0.5rem;
      height: 100%;
    }
    .chart-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-grow: 1;
      max-width: 3.5rem;
      height: 100%;
    }
    .bar-wrapper {
      position: relative;
      width: 1rem;
      height: calc(100% - 1.5rem);
      background: #f1f5f9;
      border-radius: 99px;
      display: flex;
      align-items: flex-end;
      cursor: pointer;
    }
    .bar-fill {
      width: 100%;
      background: var(--teal-500);
      border-radius: 99px;
      transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bar-wrapper:hover {
      background: #e2e8f0;
    }
    .bar-wrapper:hover .bar-fill {
      background: var(--teal-600);
    }
    .bar-value-tooltip {
      position: absolute;
      top: -1.8rem;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      white-space: nowrap;
      z-index: 10;
    }
    .bar-wrapper:hover .bar-value-tooltip {
      opacity: 1;
    }
    .bar-label {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--slate-600);
    }
    .circular-gauge {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto;
    }
    .gauge-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .gauge-bg {
      fill: none;
      stroke: #f1f5f9;
      stroke-width: 10;
    }
    .gauge-progress {
      fill: none;
      stroke: var(--teal-500);
      stroke-width: 10;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.8s ease;
      stroke-dasharray: 339.29;
    }
    .gauge-content {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .gauge-content .percentage {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--slate-800);
    }
    .gauge-content .label {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: var(--slate-600);
      font-weight: 700;
    }
    .session-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0fdfa;
      border: 1px solid var(--teal-100);
      padding: 0.75rem 1.25rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .session-bar.locked {
      background: #fff5f5;
      border-color: #ffe3e3;
      color: #c53030;
      .status-dot {
        background: #ef4444;
      }
    }
    .session-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pagination-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 0;
      border-top: 1px solid #f1f5f9;
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #64748b;
    }
    .pagination-actions {
      display: flex;
      gap: 0.5rem;
    }
    .pg-btn {
      padding: 0.35rem 0.75rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      cursor: pointer;
      font-weight: 600;
      color: var(--slate-800);
      transition: all 0.15s ease;
      &:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    .text-center {
      text-align: center;
    }
  `],
  styleUrl: './admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFinancialsPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly Number = Number;
  readonly Math = Math;

  // Search & Navigation signals
  readonly activeTab = signal<'dashboard' | 'clinic' | 'pharmacy' | 'closures' | 'inventory' | 'expenses' | 'audit-logs'>('dashboard');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  // Collections signals
  readonly summary = signal<any | null>(null);
  readonly clinicPayments = signal<any[]>([]);
  readonly pharmacySales = signal<any[]>([]);
  readonly closures = signal<any[]>([]);
  readonly expenses = signal<any[]>([]);
  readonly auditLogs = signal<any[]>([]);

  // Pagination signals
  readonly clinicPage = signal<number>(1);
  readonly clinicTotal = signal<number>(0);
  readonly pharmacyPage = signal<number>(1);
  readonly pharmacyTotal = signal<number>(0);
  readonly expensePage = signal<number>(1);
  readonly expenseTotal = signal<number>(0);
  readonly auditLogPage = signal<number>(1);
  readonly auditLogTotal = signal<number>(0);

  // Drawer / Drilldown signals
  readonly showAuditDrawer = signal<boolean>(false);
  readonly selectedClosure = signal<any | null>(null);
  readonly selectedSaleId = signal<string | null>(null);

  // Active Session signals
  readonly activeSession = signal<any | null>(null);
  readonly isOpeningSession = signal<boolean>(false);
  readonly openingFloatInput = signal<number>(100);
  readonly isClosingSession = signal<boolean>(false);
  readonly closeNotes = signal<string>('');
  readonly closeCashCounted = signal<number>(0);
  readonly closeMomoCounted = signal<number>(0);

  // Voids signals
  readonly isVoiding = signal<boolean>(false);
  readonly voidTarget = signal<{ id: string; type: 'clinic' | 'pharmacy' } | null>(null);
  readonly voidReason = signal<string>('');

  // Add Expense signals
  readonly isAddingExpense = signal<boolean>(false);
  readonly expenseTitle = signal<string>('');
  readonly expenseCategory = signal<string>('utilities');
  readonly expenseAmount = signal<number>(0);
  readonly expenseNotes = signal<string>('');
  readonly expenseDate = signal<string>(new Date().toISOString().split('T')[0]);

  readonly filteredClinicPayments = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const payments = this.clinicPayments();
    if (!query) return payments;
    return payments.filter(p => {
      const surname = p.invoice?.visit?.patient?.surname || '';
      const firstName = p.invoice?.visit?.patient?.firstName || '';
      const middleName = p.invoice?.visit?.patient?.middleName || '';
      const fullName = `${surname} ${firstName} ${middleName}`.toLowerCase();
      const patientCode = p.invoice?.visit?.patient?.patientCode || p.invoice?.visit?.patient?.code || '';
      return fullName.includes(query) || patientCode.toLowerCase().includes(query);
    });
  });

  readonly filteredPharmacySales = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sales = this.pharmacySales();
    if (!query) return sales;
    return sales.filter(s => {
      const patientName = s.visit?.patient ? `${s.visit.patient.surname} ${s.visit.patient.firstName}` : 'walk-in buyer';
      const customerName = s.customerName || '';
      const patientCode = s.visit?.patient?.patientCode || s.visit?.patient?.code || '';
      const saleNumber = s.saleNumber || '';
      return patientName.toLowerCase().includes(query) || 
             customerName.toLowerCase().includes(query) || 
             patientCode.toLowerCase().includes(query) || 
             saleNumber.toLowerCase().includes(query);
    });
  });

  ngOnInit(): void {
    this.checkActiveSession();
    this.loadData();
  }

  selectTab(tab: 'dashboard' | 'clinic' | 'pharmacy' | 'closures' | 'inventory' | 'expenses' | 'audit-logs'): void {
    this.activeTab.set(tab);
    // Reset pages on tab switch
    this.clinicPage.set(1);
    this.pharmacyPage.set(1);
    this.expensePage.set(1);
    this.auditLogPage.set(1);
    this.loadData();
  }

  changeAuditPage(page: number): void {
    this.auditLogPage.set(page);
    this.loadData();
  }

  checkActiveSession(): void {
    this.api.getActiveSession().subscribe({
      next: (session) => {
        this.activeSession.set(session);
      },
      error: (err) => {
        console.error('Failed to look up active register shift session', err);
      }
    });
  }

  openRegisterSession(): void {
    const float = this.openingFloatInput();
    this.api.openSession(float).subscribe({
      next: (session) => {
        this.activeSession.set(session);
        this.isOpeningSession.set(false);
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to open shift session', err);
        alert(err?.error?.message || 'Failed to open register shift session.');
      }
    });
  }

  triggerCloseSession(): void {
    this.closeCashCounted.set(0);
    this.closeMomoCounted.set(0);
    this.closeNotes.set('');
    this.isClosingSession.set(true);
  }

  closeRegisterSession(): void {
    const payload = {
      cashCounted: this.closeCashCounted(),
      momoCounted: this.closeMomoCounted(),
      notes: this.closeNotes(),
    };
    this.api.closePharmacySales(payload).subscribe({
      next: () => {
        this.activeSession.set(null);
        this.isClosingSession.set(false);
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to close shift session', err);
        alert(err?.error?.message || 'Failed to close register shift session.');
      }
    });
  }

  loadData(): void {
    this.isLoading.set(true);
    const start = this.startDate() || undefined;
    const end = this.endDate() || undefined;
    const tab = this.activeTab();

    if (tab === 'dashboard' || tab === 'inventory') {
      this.api.getCombinedSummary(start, end).subscribe({
        next: (sumRes) => {
          this.summary.set(sumRes);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching combined report summary', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'clinic') {
      this.api.getClinicStream(start, end, this.clinicPage(), 10).subscribe({
        next: (clinicRes) => {
          this.clinicPayments.set(clinicRes.data);
          this.clinicTotal.set(clinicRes.total);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching clinic ledger', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'pharmacy') {
      this.api.getPharmacyStream(start, end, this.pharmacyPage(), 10).subscribe({
        next: (pharmacyRes) => {
          this.pharmacySales.set(pharmacyRes.data);
          this.pharmacyTotal.set(pharmacyRes.total);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching pharmacy POS journal', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'closures') {
      this.api.getPharmacyClosures(start, end).subscribe({
        next: (closuresRes) => {
          this.closures.set(closuresRes);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching pharmacy daily closures', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'expenses') {
      this.api.getExpenses(start, end, this.expensePage(), 10).subscribe({
        next: (res) => {
          this.expenses.set(res.data);
          this.expenseTotal.set(res.total);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching expenses', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'audit-logs') {
      this.api.getAuditLogs(this.auditLogPage(), 10).subscribe({
        next: (res) => {
          this.auditLogs.set(res.data);
          this.auditLogTotal.set(res.total);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching audit logs', err);
          this.isLoading.set(false);
        }
      });
    }
  }

  // Visual Chart helper calculations
  getMaxRevenue(): number {
    const data = this.summary()?.chartData || [];
    if (data.length === 0) return 100;
    const max = Math.max(...data.map((d: any) => d.total));
    return max > 0 ? max * 1.15 : 100; // pad 15% for visual headspace
  }

  getBarHeight(value: number): number {
    const max = this.getMaxRevenue();
    return Math.round((value / max) * 100);
  }

  getMomoPercent(): number {
    const s = this.summary();
    if (!s || !s.combinedTotal) return 0;
    const momo = s.paymentMethodsBreakdown?.mobileMoney || 0;
    return Math.round((momo / s.combinedTotal) * 100);
  }

  getStrokeDashoffset(): number {
    const percent = this.getMomoPercent();
    return 339.29 - (339.29 * percent) / 100;
  }

  // Voids Management
  openVoidModal(id: string, type: 'clinic' | 'pharmacy'): void {
    this.voidTarget.set({ id, type });
    this.voidReason.set('');
    this.isVoiding.set(true);
  }

  cancelVoid(): void {
    this.isVoiding.set(false);
    this.voidTarget.set(null);
    this.voidReason.set('');
  }

  confirmVoid(): void {
    const target = this.voidTarget();
    const reason = this.voidReason();
    if (!target || !reason.trim()) return;

    this.isLoading.set(true);
    const apiCall = target.type === 'clinic' 
      ? this.api.voidClinicPayment(target.id, reason)
      : this.api.voidPharmacySale(target.id, reason);

    apiCall.subscribe({
      next: () => {
        this.isVoiding.set(false);
        this.voidTarget.set(null);
        this.voidReason.set('');
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to void transaction', err);
        alert(err?.error?.message || 'Failed to void transaction.');
        this.isLoading.set(false);
      }
    });
  }

  // Expenses Management
  saveExpense(): void {
    const payload = {
      title: this.expenseTitle(),
      category: this.expenseCategory(),
      amount: this.expenseAmount(),
      notes: this.expenseNotes(),
      expenseDate: this.expenseDate(),
    };

    this.isLoading.set(true);
    this.api.createExpense(payload).subscribe({
      next: () => {
        this.isAddingExpense.set(false);
        this.expenseTitle.set('');
        this.expenseAmount.set(0);
        this.expenseNotes.set('');
        this.expensePage.set(1);
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to log expense', err);
        alert(err?.error?.message || 'Failed to save expense.');
        this.isLoading.set(false);
      }
    });
  }

  deleteExpense(id: string): void {
    if (!confirm('Are you sure you want to delete this operational expense? This action is permanent.')) return;
    this.isLoading.set(true);
    this.api.deleteExpense(id).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to delete expense', err);
        alert(err?.error?.message || 'Failed to delete expense.');
        this.isLoading.set(false);
      }
    });
  }

  // Pagination controls triggers
  changeClinicPage(page: number): void {
    this.clinicPage.set(page);
    this.loadData();
  }

  changePharmacyPage(page: number): void {
    this.pharmacyPage.set(page);
    this.loadData();
  }

  changeExpensePage(page: number): void {
    this.expensePage.set(page);
    this.loadData();
  }

  inspectClosure(id: string): void {
    this.isLoading.set(true);
    this.api.getPharmacyClosure(id).subscribe({
      next: (closure) => {
        this.selectedClosure.set(closure);
        this.selectedSaleId.set(null);
        this.showAuditDrawer.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching closure details', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleSaleDetails(id: string): void {
    if (this.selectedSaleId() === id) {
      this.selectedSaleId.set(null);
    } else {
      this.selectedSaleId.set(id);
    }
  }

  getExpectedCashForClosure(c: any): number {
    if (!c || !c.sales) return 0;
    return c.sales
      .filter((s: any) => s.paymentMethod === 'cash')
      .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
  }

  getExpectedMomoForClosure(c: any): number {
    if (!c || !c.sales) return 0;
    return c.sales
      .filter((s: any) => s.paymentMethod === 'mobile_money')
      .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
  }

  clearFilters(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.searchQuery.set('');
    this.clinicPage.set(1);
    this.pharmacyPage.set(1);
    this.expensePage.set(1);
    this.loadData();
  }

  printSummary(): void {
    window.print();
  }

  exportCSV(): void {
    let csvContent = 'data:text/csv;charset=utf-8,';
    const tab = this.activeTab();

    if (tab === 'clinic') {
      csvContent += 'Receipt ID,Patient Name,Patient Code,Phone,Payment Date,Method,Reference Number,Received By,Amount (GHS),Status,Void Reason\n';
      this.filteredClinicPayments().forEach(p => {
        const patientName = `${p.invoice?.visit?.patient?.surname} ${p.invoice?.visit?.patient?.firstName}`.replace(/,/g, '');
        const patientCode = p.invoice?.visit?.patient?.code || '';
        const phone = p.invoice?.visit?.patient?.phone || '';
        const date = new Date(p.paidAt).toISOString();
        const method = p.paymentMethod;
        const ref = p.referenceNumber || 'N/A';
        const cashier = (p.receivedByUser?.fullName || p.receivedByUser?.username || '').replace(/,/g, '');
        const amt = Number(p.amount).toFixed(2);
        const status = p.status || 'paid';
        const reason = (p.voidReason || '').replace(/,/g, '');
        csvContent += `${p.id},${patientName},${patientCode},${phone},${date},${method},${ref},${cashier},${amt},${status},${reason}\n`;
      });
      this.downloadFile(csvContent, 'clinic_stream_report.csv');
    } else if (tab === 'pharmacy') {
      csvContent += 'Sale Number,Source,Patient Name,Patient Code,Sale Date,Method,Sold By,Total (GHS),Status,Void Reason\n';
      this.filteredPharmacySales().forEach(s => {
        const source = s.saleSource;
        const patientName = s.visit?.patient ? `${s.visit.patient.surname} ${s.visit.patient.firstName}`.replace(/,/g, '') : 'Walk-in Buyer';
        const patientCode = s.visit?.patient?.code || 'N/A';
        const date = new Date(s.paidAt).toISOString();
        const method = s.paymentMethod;
        const seller = (s.soldByUser?.fullName || s.soldByUser?.username || '').replace(/,/g, '');
        const tot = Number(s.total).toFixed(2);
        const status = s.status || 'paid';
        const reason = (s.voidReason || '').replace(/,/g, '');
        csvContent += `${s.saleNumber},${source},${patientName},${patientCode},${date},${method},${seller},${tot},${status},${reason}\n`;
      });
      this.downloadFile(csvContent, 'pharmacy_sales_report.csv');
    } else if (tab === 'expenses') {
      csvContent += 'Date,Title,Category,Amount (GHS),Recorded By,Notes\n';
      this.expenses().forEach(e => {
        const date = new Date(e.expenseDate).toISOString();
        const title = e.title.replace(/,/g, '');
        const cat = e.category;
        const amt = Number(e.amount).toFixed(2);
        const recorder = (e.createdByUser?.fullName || e.createdByUser?.username || 'Auto-generated').replace(/,/g, '');
        const notes = (e.notes || '').replace(/,/g, '');
        csvContent += `${date},${title},${cat},${amt},${recorder},${notes}\n`;
      });
      this.downloadFile(csvContent, 'expenses_report.csv');
    } else {
      // Combined summary
      csvContent += 'Metric,Value (GHS / Count)\n';
      const s = this.summary();
      if (s) {
        csvContent += `Combined Revenue Total,${(s.combinedTotal || 0).toFixed(2)}\n`;
        csvContent += `Clinic Stream Total,${(s.clinicTotal || 0).toFixed(2)}\n`;
        csvContent += `Pharmacy Stream Total,${(s.pharmacyTotal || 0).toFixed(2)}\n`;
        csvContent += `Cash Total,${(s.paymentMethodsBreakdown?.cash || 0).toFixed(2)}\n`;
        csvContent += `Mobile Money Total,${(s.paymentMethodsBreakdown?.mobileMoney || 0).toFixed(2)}\n`;
        csvContent += `Clinic Receipts Volume,${s.clinicPaymentsCount || 0}\n`;
        csvContent += `Pharmacy Sales Volume,${s.pharmacySalesCount || 0}\n`;
        csvContent += `Manual Expenses Total,${(s.manualExpensesTotal || 0).toFixed(2)}\n`;
        csvContent += `Inventory Expenses Total,${(s.inventoryExpensesTotal || 0).toFixed(2)}\n`;
        csvContent += `Total Expenses Outflow,${(s.totalExpenses || 0).toFixed(2)}\n`;
        csvContent += `Reconciled Net Profit,${(s.netProfit || 0).toFixed(2)}\n`;
        csvContent += `Low Stock Alerts count,${s.lowStockAlertsCount || 0}\n`;
        csvContent += `Expiring Batches count,${s.expiryAlertsCount || 0}\n`;
      }
      this.downloadFile(csvContent, 'combined_financial_summary.csv');
    }
  }

  private downloadFile(csvContent: string, filename: string): void {
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
