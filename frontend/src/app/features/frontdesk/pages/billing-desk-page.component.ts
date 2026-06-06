import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AppDropdownComponent } from '../../../shared/ui/app-dropdown/app-dropdown.component';

@Component({
  selector: 'app-billing-desk-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppDropdownComponent],
  template: `
    <div class="billing-workspace" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
      
      <!-- Full width visits table counter -->
      <div class="panel full-width">
        <div class="table-header-filters">
          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <h2>Billing Counter</h2>
            
            <!-- Segmented Control Button Toggle Group -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.8rem; font-weight: 700; height: 32px; align-items: center;">
              <button 
                type="button"
                [style.background]="!showHistory() ? '#ffffff' : 'transparent'"
                [style.color]="!showHistory() ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="!showHistory() ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="toggleShowHistory(false)"
              >
                Awaiting Payment
              </button>
              <button 
                type="button"
                [style.background]="showHistory() ? '#ffffff' : 'transparent'"
                [style.color]="showHistory() ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="showHistory() ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="toggleShowHistory(true)"
              >
                Paid History
              </button>
            </div>
          </div>

          <button class="btn btn-secondary btn-sm" (click)="loadVisits()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Refresh Queue</span>
          </button>
        </div>

        <p class="section-desc" style="margin-bottom: 1.25rem;">
          {{ showHistory() ? 'View completed invoices, reprint thermal POS receipts, and review historical checkout details.' : 'Select a patient visit from the queue below to compile procedures and collect payment.' }}
        </p>

        <!-- Full Queue Table -->
        <div class="frontdesk-table-card">
          <div class="frontdesk-table-responsive">
            <table class="frontdesk-premium-table">
              <thead>
                <tr>
                  <th>Visit Code</th>
                  <th>Patient Details</th>
                  <th>Status</th>
                  <th>Check-in Time</th>
                  <th>Requested Procedures</th>
                  <th style="text-align: right;">Cost (GHS)</th>
                  <th style="width: 160px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of visits()" (click)="selectVisit(v)">
                  <td>
                    <code class="tag code" style="font-weight: 700; font-family: monospace;">
                      VIS-{{ v.id.slice(-6).toUpperCase() }}
                    </code>
                  </td>
                  <td>
                    <strong style="color: var(--app-text-color); font-weight: 600;">{{ v.patient.surname }}, {{ v.patient.firstName }}</strong>
                    <div style="font-size: 0.75rem; color: var(--app-muted-text-color);">ID: {{ v.patient.patientCode }}</div>
                  </td>
                  <td>
                    <span class="status-pill" [class]="v.status">{{ getStatusLabel(v.status) }}</span>
                  </td>
                  <td>{{ v.createdAt | date:'shortTime' }}</td>
                  <td>
                    <div style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;" [title]="getProceduresSummary(v)">
                      {{ getProceduresSummary(v) }}
                    </div>
                  </td>
                  <td style="text-align: right; font-weight: 700; color: var(--app-primary-color);">
                    ₵{{ getVisitBillTotal(v).toFixed(2) }}
                  </td>
                  <td style="text-align: right;" (click)="$event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" (click)="selectVisit(v)" style="font-weight: 700;">
                      {{ showHistory() ? '🖨️ Reprint Receipt' : 'Process Checkout' }}
                    </button>
                  </td>
                </tr>
                <tr *ngIf="visits().length === 0">
                  <td colspan="7" style="text-align: center; padding: 4rem 2rem; color: var(--app-muted-text-color);">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; color: var(--slate-300);">
                        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                      </svg>
                      <p style="margin: 0; font-size: 0.95rem; font-weight: 500;">
                        {{ showHistory() ? 'No paid visits found in history.' : 'No active visits awaiting billing desk checkout.' }}
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Checkout payment / receipt overlay modal -->
      <div class="modal-backdrop" *ngIf="selectedVisit() !== null" (click)="closeModal()">
        <div class="modal-card wide-modal" (click)="$event.stopPropagation()" style="max-width: 840px;">
          
          <div class="modal-card-header">
            <h3>{{ showReceipt() ? 'Invoice Receipt Preview' : 'Invoice Settlement Terminal' }}</h3>
            <button class="modal-close-btn" (click)="closeModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body" style="padding: 1.25rem;">
            
            <!-- Standard Checkout View -->
            <div *ngIf="!showReceipt() && selectedVisit() as v">
              
              <!-- Demographics Card -->
              <div class="patient-header-card" style="padding: 1.25rem; margin-bottom: 1.25rem;">
                <div class="patient-title" style="margin-bottom: 0.75rem;">
                  <h3>{{ v.patient.surname }}, {{ v.patient.firstName }} {{ v.patient.middleName || '' }}</h3>
                  <span class="insurance-badge" [class.insured]="v.patient.insuranceStatus === 'insured'">
                    {{ v.patient.insuranceStatus === 'insured' ? 'NHIS Insured' : 'Self-Pay' }}
                  </span>
                </div>
                
                <div class="demographics-grid" style="gap: 0.75rem;">
                  <div class="demo-item">
                    <label>Patient ID</label>
                    <div class="value">{{ v.patient.patientCode }}</div>
                  </div>
                  <div class="demo-item">
                    <label>Sex & Age</label>
                    <div class="value">{{ v.patient.sex === 'male' ? 'Male' : (v.patient.sex === 'female' ? 'Female' : 'Other') }}, {{ v.patient.age }} yrs</div>
                  </div>
                  <div class="demo-item">
                    <label>Phone Number</label>
                    <div class="value">{{ v.patient.phone }}</div>
                  </div>
                </div>
              </div>

              <!-- Content Split Layout -->
              <div class="actions-grid" style="grid-template-columns: 1.2fr 1fr; gap: 1.25rem;">
                
                <!-- Left: Procedures List -->
                <div class="sub-panel" style="padding: 1rem; display: flex; flex-direction: column;">
                  <h4 style="margin-bottom: 0.75rem;">Visit Procedures Checklist</h4>
                  
                  <div style="flex: 1; overflow-y: auto; max-height: 280px; display: flex; flex-direction: column; gap: 0.5rem;" *ngIf="invoice()">
                    <div *ngFor="let s of invoice().services" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border: 1px solid var(--app-border-color); border-radius: 0.5rem; background: #fafafa;">
                      <div style="flex: 1; display: flex; flex-direction: column;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--app-text-color);">{{ s.serviceName }}</span>
                        <span style="font-size: 0.7rem; color: var(--app-muted-text-color);">{{ s.departmentName }} • Qty: {{ s.quantity }}</span>
                      </div>
                      
                      <div style="margin-right: 0.75rem; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 0.25rem;" [class.done]="s.status === 'done'" [class.not-done]="s.status === 'not_done'">
                        {{ s.status === 'not_done' ? 'NOT DONE' : 'DONE' }}
                      </div>
                      
                      <div style="font-size: 0.85rem; font-weight: 700; color: var(--app-primary-color);">
                        ₵{{ (s.status === 'not_done' ? 0 : s.lineTotal).toFixed(2) }}
                      </div>
                    </div>

                    <!-- Not Done Banner -->
                    <div class="billing-not-done-alert" *ngIf="hasNotDoneServices()" style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.725rem; border-radius: 0.5rem;">
                      <div style="display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.15rem; font-weight: 700; color: #b45309;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        </svg>
                        <span>Notice: Excluded Procedures</span>
                      </div>
                      Procedures cancelled by departments are excluded from the checkout total.
                    </div>
                  </div>
                </div>

                <!-- Right: Totals and Payment form -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                  <!-- Stat totals cards -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;" *ngIf="invoice()">
                    <div style="background: #fafafa; border: 1px solid var(--app-border-color); border-radius: 0.5rem; padding: 0.5rem; text-align: center;">
                      <div style="font-size: 0.7rem; color: var(--app-muted-text-color); font-weight: 600; text-transform: uppercase;">Subtotal</div>
                      <strong style="font-size: 1.1rem; color: var(--app-text-color);">₵{{ invoice().subtotal.toFixed(2) }}</strong>
                    </div>
                    <div style="background: #e6fcf5; border: 1px solid #c3fae8; border-radius: 0.5rem; padding: 0.5rem; text-align: center;">
                      <div style="font-size: 0.7rem; color: #0ca678; font-weight: 600; text-transform: uppercase;">Balance Due</div>
                      <strong style="font-size: 1.1rem; color: #0ca678;">₵{{ invoice().balanceDue.toFixed(2) }}</strong>
                    </div>
                  </div>

                  <!-- Payment form if outstanding balance -->
                  <div class="payment-form" style="padding: 1rem; border-radius: 0.75rem; border: 1px dashed var(--app-border-color); background: #fff;" *ngIf="invoice() && invoice().balanceDue > 0">
                    <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Collect Payment</h4>
                    
                    <div class="form-group" style="margin-bottom: 0.75rem;">
                      <label style="font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem;">Payment Method</label>
                      <app-dropdown
                        [value]="paymentMethod()"
                        (valueChange)="paymentMethod.set($event)"
                        [items]="paymentMethods"
                        labelKey="label"
                        valueKey="value"
                        placeholder="Select method"
                      ></app-dropdown>
                    </div>

                    <div class="form-group" style="margin-bottom: 0.75rem;">
                      <label style="font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem;">Transaction Note / Memo</label>
                      <input
                        type="text"
                        class="form-control"
                        style="padding: 0.5rem 0.75rem; font-size: 0.85rem;"
                        [ngModel]="paymentReference()"
                        (ngModelChange)="paymentReference.set($event)"
                        placeholder="Momo Txn ID or notes..."
                        [required]="paymentMethod() === 'mobile_money'"
                      />
                    </div>

                    <button
                      class="btn btn-success btn-block"
                      [disabled]="isSubmitting() || (paymentMethod() === 'mobile_money' && !paymentReference().trim())"
                      (click)="recordPayment()"
                      style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem 1rem; font-weight: 700;"
                    >
                      <span *ngIf="!isSubmitting()">Collect Full Payment (₵{{ invoice().balanceDue.toFixed(2) }})</span>
                      <span *ngIf="isSubmitting()">Processing payment...</span>
                    </button>
                  </div>

                  <!-- Already paid actions -->
                  <div class="already-paid-container" *ngIf="invoice() && invoice().balanceDue === 0" style="padding: 1.5rem; text-align: center; background: #fafafa; border: 1px solid var(--app-border-color); border-radius: 0.75rem;">
                    <div style="color: var(--app-success-color); margin-bottom: 0.5rem; display: flex; justify-content: center;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 48px; height: 48px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    </div>
                    <h3 style="color: var(--app-success-color); font-weight: 700; font-size: 1.15rem; margin-bottom: 1rem;">Paid In Full</h3>
                    <button class="btn btn-primary" (click)="viewReceipt()" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                      View & Print Receipt
                    </button>
                  </div>

                </div>

              </div>

            </div>

            <!-- Receipt Print Summary Template inside Modal -->
            <div class="invoice-print-container" *ngIf="showReceipt()">
              <div class="receipt-header" *ngIf="settings() as s">
                <div *ngIf="s.logo">
                  <img [src]="s.logo" alt="Clinic Logo" />
                </div>
                <h1>{{ s.clinicName }}</h1>
                <p>{{ s.tagline }}</p>
                <p>{{ s.location }}</p>
                <p>Tel: {{ s.phone }}</p>
              </div>

              <div class="receipt-meta-grid">
                <div>
                  <strong>PATIENT</strong>
                  <div>{{ selectedVisit()?.patient?.surname }}, {{ selectedVisit()?.patient?.firstName }}</div>
                  <div>ID: {{ selectedVisit()?.patient?.patientCode }}</div>
                  <div>{{ selectedVisit()?.patient?.sex === 'male' ? 'M' : 'F' }} / {{ selectedVisit()?.patient?.age }}yrs</div>
                  <div>Ph: {{ selectedVisit()?.patient?.phone }}</div>
                </div>
                <div>
                  <strong>RECEIPT</strong>
                  <div>No: REC-{{ selectedVisit()?.id?.slice(-6)?.toUpperCase() }}</div>
                  <div>Date: {{ currentDateTime | date:'dd/MM/yy HH:mm' }}</div>
                  <div>PAID IN FULL</div>
                  <div>Pay: {{ paymentMethod() | uppercase }}</div>
                  <div *ngIf="paymentReference()">Ref: {{ paymentReference() }}</div>
                </div>
              </div>

              <table class="receipt-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Procedure</th>
                    <th>Dept</th>
                    <th style="text-align:right;">Qty</th>
                    <th style="text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of invoice()?.services">
                    <td>{{ s.serviceId.slice(-6).toUpperCase() }}</td>
                    <td>
                      {{ s.serviceName }}
                      <div *ngIf="s.status === 'not_done'" style="font-size: 8px; color: #c00;">*Cancelled</div>
                    </td>
                    <td>{{ s.departmentName }}</td>
                    <td style="text-align:right;">{{ s.quantity }}</td>
                    <td style="text-align:right;">₵{{ (s.status === 'not_done' ? 0 : Number(s.lineTotal)).toFixed(2) }}</td>
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
                  <span>TOTAL:</span>
                  <span>₵{{ invoice()?.total?.toFixed(2) }}</span>
                </div>
              </div>

              <div style="margin-top: 12px; font-size: 9px;">

                  <div style="border-top: 1px dashed var(--app-muted-text-color); padding-top: 0.35rem; text-align: center;">
                  Prepared By (Cashier Stamp & Signature)
                </div>
                <div style="border-top: 1px dashed var(--app-muted-text-color); padding-top: 0.35rem; text-align: center;">
                  Patient/Depositor Signature
                </div>
              </div>
              
              <div class="receipt-footer">
                <p>Thank you for choosing {{ settings()?.clinicName || 'our clinic' }}.</p>
                <p>Payments are non-refundable. Separate receipt issued for pharmacy transactions.</p>
                <div style="margin-top: 1rem; display: flex; justify-content: center; gap: 0.75rem;" class="no-print">
                  <button 
                    class="btn btn-primary" 
                    (click)="printReceipt()"
                    style="font-weight: 700; font-size: 0.85rem; padding: 0.5rem 1rem;"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    <span>🖨️ Print Thermal Receipt</span>
                  </button>
                  
                  <button 
                    class="btn btn-secondary" 
                    (click)="showReceipt.set(false)"
                    style="font-weight: 700; font-size: 0.85rem; padding: 0.5rem 1rem;"
                  >
                    <span>Back to Details</span>
                  </button>
                </div>
              </div>

            </div>

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
  readonly showHistory = signal(false);

  readonly settings = signal<any>({
    clinicName: 'KELVIN CLINICAL DIAGNOSTICS & PHARMACY',
    tagline: 'Pathology, Diagnostic Imaging, & Premium Pharmaceutical Care',
    location: 'Accra, Ghana',
    phone: '+233 (0) 30 220 9999',
    email: 'billing@kelvinpharma.com',
    tollFree: '0800-KELVIN',
    labEmail: 'lab@kelvinpharma.com',
    accreditationId: 'KPL-2026-991A',
  });

  readonly currentDateTime = new Date();

  readonly paymentMethods = [
    { label: 'Cash (GHS)', value: 'cash' },
    { label: 'Mobile Money', value: 'mobile_money' }
  ];

  ngOnInit(): void {
    this.loadVisits();
    this.loadSettings();
  }

  toggleShowHistory(val: boolean): void {
    this.showHistory.set(val);
    this.selectedVisit.set(null);
    this.invoice.set(null);
    this.paymentReference.set('');
    this.loadVisits();
  }

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: (res) => {
        if (res) this.settings.set(res);
      },
      error: (err) => console.error('Error fetching clinic settings', err)
    });
  }

  loadVisits(): void {
    const showAll = this.showHistory();
    this.api.getActiveVisits(undefined, showAll).subscribe({
      next: (res) => {
        if (showAll) {
          this.visits.set(res.filter(v => v.status === 'paid'));
        } else {
          this.visits.set(res.filter(v => v.status === 'completed' || v.status === 'awaiting_payment'));
        }
      },
      error: (err) => console.error('Error fetching billing queue', err)
    });
  }

  getProceduresSummary(v: any): string {
    if (!v || !v.visitServices) return 'None';
    return v.visitServices.map((vs: any) => vs.service?.name).join(', ');
  }

  getVisitBillTotal(v: any): number {
    if (!v || !v.invoice) return 0;
    return Number(v.invoice.total || 0);
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.invoice.set(null);
    this.paymentReference.set('');
    this.showReceipt.set(false);
    
    this.api.getInvoice(v.id).subscribe({
      next: (res) => {
        const invObj = res.invoice;
        const visitObj = res.visit;
        
        // Map all services (including canceled ones so the checklist shows them as NOT DONE)
        const servicesList = (visitObj.visitServices || []).map((vs: any) => ({
          serviceId: vs.service.id,
          serviceName: vs.service.name,
          departmentName: vs.service.department?.name || 'Department',
          quantity: vs.quantity,
          unitPrice: Number(vs.unitPrice),
          lineTotal: Number(vs.lineTotal),
          status: vs.status
        }));

        // Ensure values are numbers
        const normalized = {
          subtotal: Number(invObj.subtotal),
          total: Number(invObj.total),
          amountPaid: Number(invObj.amountPaid),
          balanceDue: Number(invObj.balanceDue),
          discount: Number(invObj.discount || 0),
          services: servicesList
        };
        this.invoice.set(normalized);
      },
      error: (err) => console.error('Error fetching clinic invoice', err)
    });
  }

  closeModal(): void {
    this.selectedVisit.set(null);
    this.invoice.set(null);
    this.paymentReference.set('');
    this.showReceipt.set(false);
    this.loadVisits();
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Awaiting Billing';
      case 'awaiting_payment': return 'Awaiting Payment';
      case 'paid': return 'Paid';
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
}
