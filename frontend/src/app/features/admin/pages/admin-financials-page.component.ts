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
                    <svg *ngIf="p.paymentMethod === 'cash'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                    <svg *ngIf="p.paymentMethod === 'mobile_money'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    {{ p.paymentMethod === 'cash' ? 'CASH' : 'MOMO' }}
                  </span>
                </td>
                <td><code class="clinical-code font-muted">{{ p.referenceNumber || 'N/A' }}</code></td>
                <td class="text-secondary-label">{{ p.receivedByUser?.fullName || p.receivedByUser?.username }}</td>
                <td class="number-col bold-monospaced">₵{{ Number(p.amount).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
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
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of filteredPharmacySales()">
                <td><strong class="item-name-bold">{{ s.saleNumber }}</strong></td>
                <td>
                  <span class="status-badge-pill" [class.walk-in]="s.saleSource === 'walk_in'" [class.referred]="s.saleSource === 'clinic_referred'">
                    <svg *ngIf="s.saleSource === 'walk_in'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <svg *ngIf="s.saleSource === 'clinic_referred'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="18" y1="8" x2="23" y2="13"></line>
                      <line x1="23" y1="8" x2="18" y2="13"></line>
                    </svg>
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
                    <svg *ngIf="s.paymentMethod === 'cash'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                    <svg *ngIf="s.paymentMethod === 'mobile_money'" class="badge-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                    {{ s.paymentMethod === 'cash' ? 'CASH' : 'MOMO' }}
                  </span>
                </td>
                <td class="text-secondary-label">{{ s.soldByUser?.fullName || s.soldByUser?.username }}</td>
                <td class="number-col bold-monospaced">₵{{ Number(s.total).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
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
                <th class="number-col">Sales Count</th>
                <th class="number-col">Expected (System)</th>
                <th class="number-col">Counted Cash/Momo</th>
                <th class="number-col">Drawer Sum</th>
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
                <td class="number-col bold-monospaced">{{ c.totalSalesCount }} sales</td>
                <td class="number-col bold-monospaced">₵{{ Number(c.totalSalesAmount).toFixed(2) }}</td>
                <td class="number-col counted-breakdown-cell">
                  <div>Cash: ₵{{ Number(c.cashCounted).toFixed(2) }}</div>
                  <div>Momo: ₵{{ Number(c.momoCounted).toFixed(2) }}</div>
                </td>
                <td class="number-col bold-monospaced text-highlight">₵{{ Number(c.totalCounted).toFixed(2) }}</td>
                <td>
                  <span class="status-badge-pill" [class.success]="Number(c.discrepancy) === 0" [class.danger]="Number(c.discrepancy) < 0" [class.warning]="Number(c.discrepancy) > 0">
                    ₵{{ Number(c.discrepancy) >= 0 ? '+' : '' }}{{ Number(c.discrepancy).toFixed(2) }}
                  </span>
                </td>
                <td (click)="$event.stopPropagation()">
                  <button class="action-btn btn-secondary btn-table-action" (click)="inspectClosure(c.id)">
                    <svg class="action-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
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
            <!-- Closure Stats Summary Card -->
            <div class="closure-summary-card">
              <div class="meta-row">
                <span>Session ID:</span>
                <strong class="bold-monospaced">CLS-{{ selectedClosure().id.slice(-6).toUpperCase() }}</strong>
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
                      <td>Cash Drawer</td>
                      <td class="number-col bold-monospaced">₵{{ getExpectedCashForClosure(selectedClosure()).toFixed(2) }}</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().cashCounted).toFixed(2) }}</td>
                    </tr>
                    <tr>
                      <td>Mobile Money</td>
                      <td class="number-col bold-monospaced">₵{{ getExpectedMomoForClosure(selectedClosure()).toFixed(2) }}</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().momoCounted).toFixed(2) }}</td>
                    </tr>
                    <tr class="table-total-row-highlight">
                      <td>Total Shift Sum</td>
                      <td class="number-col bold-monospaced">₵{{ Number(selectedClosure().totalSalesAmount).toFixed(2) }}</td>
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
                            <div class="item-name-thermal">{{ item.productName || 'Dispensed Medicine' }}</div>
                            <div class="batch-sub-label">[Batch: {{ item.batchNumber || 'N/A' }}]</div>
                          </td>
                          <td class="num font-monospaced">{{ item.quantity }}</td>
                          <td class="num font-monospaced">₵{{ Number(item.sellingPrice).toFixed(2) }}</td>
                          <td class="num font-monospaced">₵{{ (Number(item.sellingPrice) * item.quantity).toFixed(2) }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="totals">
                      <div class="grand">
                        <span>TOTAL GHS:</span>
                        <span>₵{{ Number(s.total).toFixed(2) }}</span>
                      </div>
                      <div>
                        <span>PAID AMOUNT:</span>
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

    </div>
  `,
  styleUrl: './admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFinancialsPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly Number = Number;

  // Search & Navigation signals
  readonly activeTab = signal<'dashboard' | 'clinic' | 'pharmacy' | 'closures' | 'inventory'>('dashboard');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  // Collections signals
  readonly summary = signal<any | null>(null);
  readonly clinicPayments = signal<any[]>([]);
  readonly pharmacySales = signal<any[]>([]);
  readonly closures = signal<any[]>([]);

  // Drawer / Drilldown signals
  readonly showAuditDrawer = signal<boolean>(false);
  readonly selectedClosure = signal<any | null>(null);
  readonly selectedSaleId = signal<string | null>(null);

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
    // Default: load stats for today
    this.loadData();
  }

  selectTab(tab: 'dashboard' | 'clinic' | 'pharmacy' | 'closures' | 'inventory'): void {
    this.activeTab.set(tab);
    this.loadData();
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
      this.api.getClinicStream(start, end).subscribe({
        next: (clinicRes) => {
          this.clinicPayments.set(clinicRes);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching clinic ledger', err);
          this.isLoading.set(false);
        }
      });
    } else if (tab === 'pharmacy') {
      this.api.getPharmacyStream(start, end).subscribe({
        next: (pharmacyRes) => {
          this.pharmacySales.set(pharmacyRes);
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
    }
  }

  loadClosures(): void {
    const start = this.startDate() || undefined;
    const end = this.endDate() || undefined;
    this.isLoading.set(true);
    this.api.getPharmacyClosures(start, end).subscribe({
      next: (closuresRes) => {
        this.closures.set(closuresRes);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching closures ledger', err);
        this.isLoading.set(false);
      }
    });
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
    this.loadData();
  }

  printSummary(): void {
    window.print();
  }

  exportCSV(): void {
    let csvContent = 'data:text/csv;charset=utf-8,';
    const tab = this.activeTab();

    if (tab === 'clinic') {
      csvContent += 'Receipt ID,Patient Name,Patient Code,Phone,Payment Date,Method,Reference Number,Received By,Amount (GHS)\n';
      this.filteredClinicPayments().forEach(p => {
        const patientName = `${p.invoice?.visit?.patient?.surname} ${p.invoice?.visit?.patient?.firstName}`.replace(/,/g, '');
        const patientCode = p.invoice?.visit?.patient?.code || '';
        const phone = p.invoice?.visit?.patient?.phone || '';
        const date = new Date(p.paidAt).toISOString();
        const method = p.paymentMethod;
        const ref = p.referenceNumber || 'N/A';
        const cashier = (p.receivedByUser?.fullName || p.receivedByUser?.username || '').replace(/,/g, '');
        const amt = Number(p.amount).toFixed(2);
        csvContent += `${p.id},${patientName},${patientCode},${phone},${date},${method},${ref},${cashier},${amt}\n`;
      });
      this.downloadFile(csvContent, 'clinic_stream_report.csv');
    } else if (tab === 'pharmacy') {
      csvContent += 'Sale Number,Source,Patient Name,Patient Code,Sale Date,Method,Sold By,Total (GHS)\n';
      this.filteredPharmacySales().forEach(s => {
        const source = s.saleSource;
        const patientName = s.visit?.patient ? `${s.visit.patient.surname} ${s.visit.patient.firstName}`.replace(/,/g, '') : 'Walk-in Buyer';
        const patientCode = s.visit?.patient?.code || 'N/A';
        const date = new Date(s.paidAt).toISOString();
        const method = s.paymentMethod;
        const seller = (s.soldByUser?.fullName || s.soldByUser?.username || '').replace(/,/g, '');
        const tot = Number(s.total).toFixed(2);
        csvContent += `${s.saleNumber},${source},${patientName},${patientCode},${date},${method},${seller},${tot}\n`;
      });
      this.downloadFile(csvContent, 'pharmacy_sales_report.csv');
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
