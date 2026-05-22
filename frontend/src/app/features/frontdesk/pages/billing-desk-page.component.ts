import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { AppDropdownComponent } from '../../../shared/ui/app-dropdown/app-dropdown.component';

@Component({
  selector: 'app-billing-desk-page',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent, AppDropdownComponent],
  template: `
    <div class="billing-workspace">
      <!-- Visits Queue Panel -->
      <div class="panel list-panel" *ngIf="!showReceipt()">
        <div class="panel-header">
          <h2>Billing Counter</h2>
          <button class="btn btn-secondary btn-sm" (click)="loadVisits()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Refresh Queue</span>
          </button>
        </div>

        <p class="section-desc">Select a patient visit below to view charges, reconcile extra services, and collect payment.</p>

        <div class="results-list" *ngIf="visits().length > 0; else noVisits">
          <div
            *ngFor="let v of visits()"
            class="patient-card"
            [class.active]="selectedVisit()?.id === v.id"
            (click)="selectVisit(v)"
          >
            <div class="avatar" style="background-color: var(--slate-700);">
              {{ v.patient.surname[0] }}{{ v.patient.firstName[0] }}
            </div>
            <div class="patient-info">
              <div class="patient-name">{{ v.patient.surname }}, {{ v.patient.firstName }}</div>
              <div class="patient-meta">
                <span class="tag code">{{ v.patient.code }}</span>
                <span class="status-pill" [class]="v.status">{{ getStatusLabel(v.status) }}</span>
              </div>
              <div class="patient-phone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; margin-right: 4px; vertical-align: middle;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Checked in: {{ v.createdAt | date:'shortTime' }}
              </div>
            </div>
            <div class="arrow-indicator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <ng-template #noVisits>
          <div class="empty-state">
            <div class="empty-icon-wrap" style="color: var(--slate-300); margin-bottom: 1rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px;">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <p>No active visits awaiting billing desk checkout.</p>
          </div>
        </ng-template>
      </div>

      <!-- Invoice Compile Desk / Payment Panel -->
      <div class="panel detail-panel" [class.visible]="selectedVisit() !== null" *ngIf="!showReceipt()">
        <div *ngIf="selectedVisit() as v; else selectPlaceholder" class="billing-checkout-section">
          
          <div class="billing-card">
            <div class="patient-summary">
              <div>
                <span class="code">{{ v.patient.code }}</span>
                <div class="name">{{ v.patient.surname }}, {{ v.patient.firstName }} {{ v.patient.middleName || '' }}</div>
              </div>
              <div class="text-right">
                <div class="small text-muted">Phone: {{ v.patient.phone }}</div>
                <div class="small" *ngIf="v.patient.insuranceStatus === 'insured'" style="color: var(--app-primary-color); font-weight: 600; display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  NHIS/Corporate Insured
                </div>
              </div>
            </div>

            <!-- List of Services compiling dynamically -->
            <div class="billing-services-list" *ngIf="invoice()">
              <h4>Visit Procedures Checklist</h4>
              <div *ngFor="let s of invoice().services" class="billing-service-row">
                <div class="svc-info">
                  <div class="name">{{ s.serviceName }}</div>
                  <div class="dept">{{ s.departmentName }} • Qty: {{ s.quantity }}</div>
                </div>
                
                <div class="svc-status-val" [class.done]="s.status === 'done'" [class.not-done]="s.status === 'not_done'">
                  {{ s.status === 'not_done' ? 'NOT DONE' : 'DONE' }}
                </div>
                
                <div class="svc-price">
                  ₵{{ (s.status === 'not_done' ? 0 : s.lineTotal).toFixed(2) }}
                </div>
              </div>

              <!-- Not Done Banner -->
              <div class="billing-not-done-alert" *ngIf="hasNotDoneServices()">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <strong>Notice: Excluded Procedures</strong>
                </div>
                Some service lines were documented as "not done" by departments and have been excluded from the final invoice billing total.
              </div>
            </div>

            <!-- Dynamic Invoice Summary Using Stat Cards -->
            <div class="invoice-summary-grid" *ngIf="invoice()">
              <app-stat-card label="Subtotal" [value]="'₵' + invoice().subtotal.toFixed(2)" hint="Base charges"></app-stat-card>
              <app-stat-card label="Discounts" [value]="'₵0.00'" hint="Not allowed in V1"></app-stat-card>
              <app-stat-card label="Balance Due" [value]="'₵' + invoice().balanceDue.toFixed(2)" hint="To be collected"></app-stat-card>
            </div>

            <!-- Payment Process Form -->
            <div class="payment-form" *ngIf="invoice() && invoice().balanceDue > 0">
              <h4>Collect Payment</h4>
              
              <div class="form-group">
                <label>Payment Method</label>
                <app-dropdown
                  [value]="paymentMethod()"
                  (valueChange)="paymentMethod.set($event)"
                  [items]="paymentMethods"
                  labelKey="label"
                  valueKey="value"
                  placeholder="Select payment method"
                ></app-dropdown>
              </div>

              <div class="form-group">
                <label for="amount">Payment Amount (GHS) <span class="text-danger">* Full payment only</span></label>
                <input
                  id="amount"
                  type="number"
                  class="form-control"
                  [ngModel]="invoice().balanceDue"
                  readonly
                  style="font-weight: 700; font-size: 1.2rem; color: var(--app-primary-color); background-color: var(--slate-50);"
                />
              </div>

              <div class="form-group">
                <label for="reference">Transaction Reference / Receipt Note</label>
                <input
                  id="reference"
                  type="text"
                  class="form-control"
                  [(ngModel)]="paymentReference"
                  placeholder="e.g. Momo Txn ID or Cash receipt number"
                  [required]="paymentMethod() === 'mobile_money'"
                />
                <div *ngIf="paymentMethod() === 'mobile_money' && !paymentReference().trim()" class="text-danger small mt-1">
                  Reference code is required for mobile money transactions.
                </div>
              </div>

              <button
                class="btn btn-success btn-block btn-lg"
                [disabled]="isSubmitting() || (paymentMethod() === 'mobile_money' && !paymentReference().trim())"
                (click)="recordPayment()"
              >
                <span *ngIf="!isSubmitting()" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Record Full Payment (₵{{ invoice().balanceDue.toFixed(2) }})
                </span>
                <span *ngIf="isSubmitting()">Reconciling Accounts...</span>
              </button>
            </div>

            <!-- Already Paid State -->
            <div class="already-paid-container" *ngIf="invoice() && invoice().balanceDue === 0">
              <div class="text-center py-4">
                <div style="color: var(--app-success-color); margin-bottom: 1rem; display: flex; justify-content: center;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 64px; height: 64px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h3 style="color: var(--app-success-color); font-weight: 700; margin-bottom: 1.5rem;">Paid In Full</h3>
                <button class="btn btn-primary btn-lg" (click)="viewReceipt()" style="display: inline-flex; align-items: center; gap: 0.5rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  View & Print A4 Receipt
                </button>
              </div>
            </div>

          </div>

        </div>

        <ng-template #selectPlaceholder>
          <div class="select-placeholder">
            <div class="pulse-icon-wrap" style="color: var(--slate-300); margin-bottom: 1rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px;">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <h3>Cashier Terminal</h3>
            <p>Select a patient visit from the queue to compile their final radiography/lab invoices and record cash or mobile money payments.</p>
          </div>
        </ng-template>
      </div>

      <!-- Receipt Print Summary Template -->
      <div class="invoice-print-container" *ngIf="showReceipt()">
        <div class="receipt-header">
          <h1>ANTIGRAVITY MEDICAL CLINIC & RADIOGRAPHY</h1>
          <p>Separate Pharmacy Inventory & Diagnostics Care • Accra, Ghana</p>
          <p>Phone: +233 24 123 4567 • Email: billing&#64;antigravityclinic.com</p>
        </div>

        <div class="receipt-meta-grid">
          <div>
            <strong>PATIENT DEMOGRAPHICS</strong>
            <div>Name: {{ selectedVisit()?.patient?.surname }}, {{ selectedVisit()?.patient?.firstName }}</div>
            <div>Patient Code: {{ selectedVisit()?.patient?.code }}</div>
            <div>Sex/Age: {{ selectedVisit()?.patient?.sex === 'male' ? 'Male' : (selectedVisit()?.patient?.sex === 'female' ? 'Female' : 'Other') }}, {{ selectedVisit()?.patient?.age }} yrs</div>
            <div>Phone: {{ selectedVisit()?.patient?.phone }}</div>
          </div>
          <div style="text-align: right;">
            <strong>INVOICE RECEIPT</strong>
            <div>Receipt No: REC-{{ selectedVisit()?.id?.slice(-6)?.toUpperCase() }}</div>
            <div>Date: {{ currentDateTime | date:'medium' }}</div>
            <div>Status: <span style="color: var(--app-success-color); font-weight: 700;">PAID IN FULL</span></div>
            <div>Payment: {{ paymentMethod() | uppercase }} (Ref: {{ paymentReference() || 'Cash' }})</div>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Procedure/Scan Code</th>
              <th>Clinical Service Details</th>
              <th>Department</th>
              <th class="num-col">Unit Cost</th>
              <th class="num-col">Qty</th>
              <th class="num-col">Line Total (GHS)</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of invoice()?.services">
              <td>{{ s.serviceId.slice(-6).toUpperCase() }}</td>
              <td>
                <strong>{{ s.serviceName }}</strong>
                <div *ngIf="s.status === 'not_done'" style="color: var(--app-danger-color); font-size: 0.75rem;">
                  * Canceled / Canceled Procedure
                </div>
              </td>
              <td>{{ s.departmentName }}</td>
              <td class="num-col">₵{{ Number(s.unitPrice).toFixed(2) }}</td>
              <td class="num-col">{{ s.quantity }}</td>
              <td class="num-col">₵{{ (s.status === 'not_done' ? 0 : Number(s.lineTotal)).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>₵{{ invoice()?.subtotal?.toFixed(2) }}</span>
          </div>
          <div class="total-line">
            <span>Amount Paid:</span>
            <span>₵{{ invoice()?.amountPaid?.toFixed(2) }}</span>
          </div>
          <div class="total-line grand">
            <span>Total GHS Reconciled:</span>
            <span>₵{{ invoice()?.total?.toFixed(2) }}</span>
          </div>
        </div>

        <div style="margin-top: 3rem; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;">
          <div style="border-top: 1px dashed var(--app-text-color); padding-top: 0.5rem; text-align: center; font-size: 0.8rem;">
            Prepared By (Cashier Stamp & Signature)
          </div>
          <div style="border-top: 1px dashed var(--app-text-color); padding-top: 0.5rem; text-align: center; font-size: 0.8rem;">
            Patient/Depositor Signature
          </div>
        </div>

        <div class="receipt-footer">
          <p>Thank you for choosing Antigravity Medical. Payments are non-refundable. Separate receipt issued for pharmacy transactions.</p>
          <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem;" class="no-print">
            <button class="btn btn-success" (click)="printReceipt()">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>Print Invoice Receipt</span>
            </button>
            <button class="btn btn-secondary" (click)="closeReceipt()">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>Close & Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingDeskPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  
  // Make Number available in template
  readonly Number = Number;

  readonly visits = signal<any[]>([]);
  readonly selectedVisit = signal<any | null>(null);
  readonly invoice = signal<any | null>(null);
  
  readonly paymentMethod = signal<'cash' | 'mobile_money'>('cash');
  readonly paymentReference = signal('');
  readonly isSubmitting = signal(false);
  readonly showReceipt = signal(false);

  readonly currentDateTime = new Date();

  readonly paymentMethods = [
    { label: 'Cash (GHS)', value: 'cash' },
    { label: 'Mobile Money', value: 'mobile_money' }
  ];

  ngOnInit(): void {
    this.loadVisits();
  }

  loadVisits(): void {
    this.api.getActiveVisits().subscribe({
      next: (res) => {
        this.visits.set(res.filter(v => v.status === 'completed' || v.status === 'awaiting_payment'));
      },
      error: (err) => console.error('Error fetching billing queue', err)
    });
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.invoice.set(null);
    this.paymentReference.set('');
    
    this.api.getInvoice(v.id).subscribe({
      next: (inv) => {
        // Ensure values are numbers
        const normalized = {
          ...inv,
          subtotal: Number(inv.subtotal),
          total: Number(inv.total),
          amountPaid: Number(inv.amountPaid),
          balanceDue: Number(inv.balanceDue),
          discount: Number(inv.discount || 0),
          services: (inv.services || []).map((s: any) => ({
            ...s,
            unitPrice: Number(s.unitPrice),
            lineTotal: Number(s.lineTotal)
          }))
        };
        this.invoice.set(normalized);
      },
      error: (err) => console.error('Error fetching clinic invoice', err)
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Awaiting Billing';
      case 'awaiting_payment': return 'Awaiting Payment';
      default: return status.replace('_', ' ');
    }
  }

  hasNotDoneServices(): boolean {
    const inv = this.invoice();
    if (!inv || !inv.services) return false;
    return inv.services.some((s: any) => s.status === 'not_done');
  }

  recordPayment(): void {
    const v = this.selectedVisit();
    const inv = this.invoice();
    if (!v || !inv) return;

    const ref = this.paymentReference().trim();
    if (this.paymentMethod() === 'mobile_money' && !ref) {
      alert('Reference transaction ID is required for Mobile Money payments.');
      return;
    }

    this.isSubmitting.set(true);

    const paymentData = {
      amount: inv.balanceDue,
      paymentMethod: this.paymentMethod(),
      transactionReference: ref
    };

    this.api.payInvoice(v.id, paymentData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.invoice.set({
          ...inv,
          balanceDue: 0,
          amountPaid: inv.total,
          status: 'paid'
        });
        this.viewReceipt();
      },
      error: (err) => {
        console.error('Payment failed', err);
        this.isSubmitting.set(false);
        alert(err?.error?.message ?? 'Failed to process full invoice payment.');
      }
    });
  }

  viewReceipt(): void {
    this.showReceipt.set(true);
  }

  printReceipt(): void {
    window.print();
  }

  closeReceipt(): void {
    this.showReceipt.set(false);
    this.selectedVisit.set(null);
    this.invoice.set(null);
    this.loadVisits();
  }
}
