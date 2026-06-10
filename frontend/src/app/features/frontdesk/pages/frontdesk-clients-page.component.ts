import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  department: {
    code: string;
    name: string;
  };
  selected?: boolean;
}

@Component({
  selector: 'app-frontdesk-clients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="clients-workspace" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
      <div class="panel full-width">
        <!-- Table Header and Registration trigger -->
        <div class="table-header-filters">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <h2>Client Directory</h2>
            <div class="filter-search-group">
              <input
                type="text"
                placeholder="Search name, phone or code..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event); onSearchChange()"
                class="search-input-control"
              />
              <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
          
          <button class="btn btn-primary" routerLink="/frontdesk/new-registration" style="display: flex; align-items: center; gap: 0.5rem;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <span>Register New Patient</span>
          </button>
        </div>

        <!-- Table Container -->
        <div class="frontdesk-table-card">
          <div class="frontdesk-table-responsive">
            <table class="frontdesk-premium-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Sex/Age</th>
                  <th>Phone Number</th>
                  <th>Emergency Contact</th>
                  <th style="width: 180px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading Skeleton Rows -->
                <ng-container *ngIf="loading()">
                  <tr *ngFor="let dummy of [1, 2, 3, 4, 5]">
                    <td><div class="skeleton-shimmer" style="width: 70px;"></div></td>
                    <td><div class="skeleton-shimmer" style="width: 140px;"></div></td>
                    <td><div class="skeleton-shimmer" style="width: 95px;"></div></td>
                    <td><div class="skeleton-shimmer" style="width: 90px;"></div></td>
                    <td><div class="skeleton-shimmer" style="width: 160px;"></div></td>
                    <td style="text-align: right;"><div class="skeleton-shimmer" style="width: 100px; display: inline-block;"></div></td>
                  </tr>
                </ng-container>

                <!-- Patient Data Rows -->
                <ng-container *ngIf="!loading()">
                  <tr *ngFor="let p of paginatedPatients()" (click)="selectPatient(p)">
                    <td><code class="tag code" style="font-weight: 700; font-family: monospace;">{{ p.patientCode || p.code || 'N/A' }}</code></td>
                    <td><strong style="color: var(--app-text-color); font-weight: 600;">{{ p.surname }}, {{ p.firstName }} {{ p.middleName || '' }}</strong></td>
                    <td>
                      <span class="tag sex" [class.male]="p.sex === 'male'" [class.female]="p.sex === 'female'">
                        {{ p.sex === 'male' ? 'Male' : (p.sex === 'female' ? 'Female' : 'Other') }}
                      </span>
                      <span class="tag age" style="margin-left: 0.25rem;">{{ p.age }} yrs</span>
                    </td>
                    <td>{{ p.phone }}</td>
                    <td>{{ p.emergencyContactName || 'N/A' }} ({{ p.emergencyContactPhone || 'N/A' }})</td>
                    <td style="text-align: right;" (click)="$event.stopPropagation()">
                      <button class="btn btn-secondary btn-sm" (click)="selectPatient(p)" style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 8v8"></path>
                          <path d="M8 12h8"></path>
                        </svg>
                        <span>Manage & Route</span>
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="totalPatients() === 0">
                    <td colspan="6" style="text-align: center; padding: 4rem 2rem; color: var(--app-muted-text-color);">
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; color: var(--slate-300);">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No patient records match the filter criteria.</p>
                      </div>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>

          <!-- Pagination Footer -->
          <div class="table-footer" *ngIf="!loading() && totalPatients() > 0">
            <div class="pagination-info">
              Showing <strong>{{ getRangeStart() }}-{{ getRangeEnd() }}</strong> of <strong>{{ totalPatients() }}</strong> clients
            </div>
            <div class="pagination-controls">
              <button 
                class="page-btn" 
                [disabled]="page() === 1" 
                (click)="page.set(page() - 1)"
              >
                &larr; Prev
              </button>
              <button 
                *ngFor="let pNum of [].constructor(totalPages()); let i = index" 
                class="page-btn" 
                [class.active]="page() === i + 1"
                (click)="page.set(i + 1)"
              >
                {{ i + 1 }}
              </button>
              <button 
                class="page-btn" 
                [disabled]="page() === totalPages()" 
                (click)="page.set(page() + 1)"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Overlay Detail & Visit Checklist Modal -->
      <div class="modal-backdrop" *ngIf="selectedPatient() !== null" (click)="closeModal()">
        <div class="modal-card wide-modal" (click)="$event.stopPropagation()">
          <div class="modal-card-header">
            <h3>Client Management Hub</h3>
            <button class="modal-close-btn" (click)="closeModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body" *ngIf="selectedPatient() as p">
            <!-- Demographics Card (Edit Mode) -->
            <div class="patient-header-card" style="margin-bottom: 1.5rem;" *ngIf="isEditingDemographics()">
              <div class="patient-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <h3 style="margin: 0;">Edit Patient Demographics</h3>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-secondary btn-sm" (click)="isEditingDemographics.set(false)" style="font-weight: 700;">Cancel</button>
                  <button class="btn btn-primary btn-sm" (click)="saveDemographics()" style="font-weight: 700;">Save Changes</button>
                </div>
              </div>
              
              <div class="demographics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Surname *</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editSurname()" (ngModelChange)="editSurname.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">First Name *</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editFirstName()" (ngModelChange)="editFirstName.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Middle Name</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editMiddleName()" (ngModelChange)="editMiddleName.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Sex *</label>
                  <select class="form-control form-control-sm" [ngModel]="editSex()" (ngModelChange)="editSex.set($event)">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Age *</label>
                  <input type="number" class="form-control form-control-sm" [ngModel]="editAge()" (ngModelChange)="editAge.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Phone Number *</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editPhone()" (ngModelChange)="editPhone.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Referral Center *</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editReferralCenter()" (ngModelChange)="editReferralCenter.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Insurance Status *</label>
                  <select class="form-control form-control-sm" [ngModel]="editInsuranceStatus()" (ngModelChange)="editInsuranceStatus.set($event)">
                    <option value="uninsured">Self-Pay</option>
                    <option value="insured">Insured</option>
                  </select>
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Emergency Contact Name</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editEmergencyContactName()" (ngModelChange)="editEmergencyContactName.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Emergency Contact Phone</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editEmergencyContactPhone()" (ngModelChange)="editEmergencyContactPhone.set($event)" />
                </div>
                <div class="demo-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <label style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600;">Emergency Contact Relation</label>
                  <input type="text" class="form-control form-control-sm" [ngModel]="editEmergencyContactRel()" (ngModelChange)="editEmergencyContactRel.set($event)" />
                </div>
              </div>
            </div>

            <!-- Demographics Card (View Mode) -->
            <div class="patient-header-card" style="margin-bottom: 1.5rem;" *ngIf="!isEditingDemographics()">
              <div class="patient-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                  <h3 style="margin: 0;">{{ p.surname }}, {{ p.firstName }} {{ p.middleName || '' }}</h3>
                  <span class="insurance-badge" [class.insured]="p.insuranceStatus === 'insured'" style="margin-top: 0.25rem; display: inline-block;">
                    {{ p.insuranceStatus === 'insured' ? 'Insured (GHS)' : 'Self-Pay (GHS)' }}
                  </span>
                </div>
                <button class="btn btn-secondary btn-sm" (click)="editDemographics(p)" style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  <span>Edit Demographics</span>
                </button>
              </div>
              
              <div class="demographics-grid">
                <div class="demo-item">
                  <label>Patient ID</label>
                  <div class="value">{{ p.patientCode || p.code || 'N/A' }}</div>
                </div>
                <div class="demo-item">
                  <label>Gender & Age</label>
                  <div class="value">{{ p.sex === 'male' ? 'Male' : (p.sex === 'female' ? 'Female' : 'Other') }}, {{ p.age }} yrs</div>
                </div>
                <div class="demo-item">
                  <label>Phone Number</label>
                  <div class="value">{{ p.phone }}</div>
                </div>
                <div class="demo-item">
                  <label>Emergency Contact</label>
                  <div class="value">{{ p.emergencyContactName || 'N/A' }} ({{ p.emergencyContactPhone || 'N/A' }})</div>
                </div>
                <div class="demo-item" *ngIf="p.referralCenter">
                  <label>Referral Center</label>
                  <div class="value">{{ p.referralCenter }}</div>
                </div>
              </div>
            </div>

            <!-- Side-by-side Layout inside Modal -->
            <div class="actions-grid">
              <!-- History Section -->
              <div class="sub-panel history-section" style="max-height: 480px; display: flex; flex-direction: column;">
                <h4>Visit History</h4>
                <!-- History Loading Shimmers -->
                <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem;" *ngIf="loadingHistory()">
                  <div *ngFor="let dummy of [1, 2]" style="display: flex; gap: 1rem; position: relative; padding-bottom: 0.5rem;">
                    <div class="timeline-dot" style="background-color: var(--app-border-color); margin-top: 4px;"></div>
                    <div class="history-content" style="display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
                      <div class="skeleton-shimmer" style="width: 50%; height: 12px;"></div>
                      <div class="skeleton-shimmer" style="width: 80%; height: 10px;"></div>
                    </div>
                  </div>
                </div>

                <div class="history-timeline" style="flex: 1; max-height: 380px;" *ngIf="!loadingHistory() && history().length > 0; else noHistory">
                  <div *ngFor="let h of history()" class="history-item">
                    <div class="timeline-dot" [class.completed]="h.status === 'completed' || h.status === 'paid'"></div>
                    <div class="history-content">
                      <div class="history-date">
                        {{ h.createdAt | date:'MMM d, y, h:mm a' }}
                        <span class="status-pill" [class]="h.status" style="font-size: 0.65rem; padding: 0.1rem 0.3rem;">{{ h.status | uppercase }}</span>
                      </div>
                      <div class="history-services">
                        <span *ngFor="let s of h.visitServices" class="mini-service-tag" style="font-size: 0.725rem; background-color: var(--slate-100); color: var(--app-text-color); border: 1px solid var(--app-border-color); padding: 0.15rem 0.35rem; border-radius: 0.375rem; margin-right: 0.25rem; display: inline-block;">
                          {{ s.service?.name }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <ng-template #noHistory>
                  <div class="sub-empty" style="text-align: center; padding: 3rem 1rem; color: var(--app-muted-text-color);" *ngIf="!loadingHistory()">
                    <p>No past visits recorded for this client.</p>
                  </div>
                </ng-template>
              </div>

              <!-- New Visit Creation Section -->
              <div class="sub-panel checkin-section" style="max-height: 480px; display: flex; flex-direction: column;">
                <h4>Quick Check-in / Visit Builder</h4>
                <p class="section-desc">Select scans or laboratory tests to route this patient.</p>

                <!-- Services Catalog Selection -->
                <div class="service-selector" style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1; overflow: hidden; min-height: 180px;">
                  <div class="catalog-search" style="margin-bottom: 0.25rem;">
                    <input
                      type="text"
                      placeholder="Filter services..."
                      [ngModel]="serviceFilter()"
                      (ngModelChange)="serviceFilter.set($event)"
                      class="form-control form-control-sm"
                    />
                  </div>
                  
                  <div class="catalog-list" style="flex: 1; overflow-y: auto; max-height: 200px; display: flex; flex-direction: column; gap: 0.35rem;">
                    <div
                      *ngFor="let s of filteredServices()"
                      class="service-row"
                      [class.selected]="s.selected"
                      (click)="toggleService(s)"
                      style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--app-border-color); border-radius: 0.5rem; cursor: pointer; transition: all 0.15s ease;"
                    >
                      <div class="checkbox-box" style="display: flex; align-items: center;">
                        <input type="checkbox" [checked]="s.selected" readonly style="pointer-events: none;" />
                      </div>
                      <div class="service-details" style="flex: 1; display: flex; flex-direction: column;">
                        <div class="service-name" style="font-size: 0.85rem; font-weight: 600; color: var(--app-text-color);">{{ s.name }}</div>
                        <div class="service-dept" style="font-size: 0.725rem; color: var(--app-muted-text-color);">{{ s.department.name }}</div>
                      </div>
                      <div class="service-price" style="font-size: 0.85rem; font-weight: 700; color: var(--app-primary-color);">₵{{ s.price.toFixed(2) }}</div>
                    </div>
                  </div>
                </div>

                <!-- Running Total & Checkout -->
                <div class="checkout-summary" *ngIf="selectedServicesCount() > 0" style="border-top: 1px solid var(--app-border-color); padding-top: 0.75rem; margin-top: 0.5rem;">
                  <div class="summary-line" style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <span>Selected Services:</span>
                    <strong>{{ selectedServicesCount() }} item(s)</strong>
                  </div>
                  <div class="summary-line total" style="display: flex; justify-content: space-between; font-size: 1rem; margin-bottom: 0.75rem;">
                    <span>Running Total:</span>
                    <strong style="color: var(--app-success-color);">₵{{ runningTotal().toFixed(2) }}</strong>
                  </div>

                  <div class="checkin-actions">
                    <button class="btn btn-success btn-block" [disabled]="isSubmitting()" (click)="createVisit()" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700;">
                      <span *ngIf="!isSubmitting()" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                          <path d="M22 2L11 13"></path>
                          <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                        </svg>
                        Check-in & Route Patient
                      </span>
                      <span *ngIf="isSubmitting()">Checking in...</span>
                    </button>
                  </div>
                </div>
                
                <div class="checkout-empty" *ngIf="selectedServicesCount() === 0" style="text-align: center; padding: 1rem 0; color: var(--app-muted-text-color); font-size: 0.8rem; border-top: 1px dashed var(--app-border-color); margin-top: 0.5rem;">
                  <p>Select one or more services to generate a visit check-in.</p>
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
export class FrontdeskClientsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly isEditingDemographics = signal(false);
  readonly editSurname = signal('');
  readonly editFirstName = signal('');
  readonly editMiddleName = signal('');
  readonly editSex = signal('other');
  readonly editAge = signal(0);
  readonly editPhone = signal('');
  readonly editReferralCenter = signal('');
  readonly editInsuranceStatus = signal('uninsured');
  readonly editEmergencyContactName = signal('');
  readonly editEmergencyContactPhone = signal('');
  readonly editEmergencyContactRel = signal('');

  readonly searchQuery = signal('');
  readonly patients = signal<any[]>([]);
  readonly selectedPatient = signal<any | null>(null);
  readonly history = signal<any[]>([]);
  readonly services = signal<ServiceItem[]>([]);
  readonly serviceFilter = signal('');
  readonly isSubmitting = signal(false);

  // Pagination & Loader signals
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly loading = signal(false);
  readonly loadingHistory = signal(false);

  readonly totalPatients = computed(() => this.patients().length);
  readonly paginatedPatients = computed(() => {
    const start = (this.page() - 1) * this.limit();
    return this.patients().slice(start, start + this.limit());
  });
  readonly totalPages = computed(() => Math.ceil(this.totalPatients() / this.limit()));
  readonly getRangeStart = computed(() => {
    if (this.totalPatients() === 0) return 0;
    return (this.page() - 1) * this.limit() + 1;
  });
  readonly getRangeEnd = computed(() => {
    return Math.min(this.page() * this.limit(), this.totalPatients());
  });

  ngOnInit(): void {
    this.loadServices();
    this.loadAllPatients();
  }

  loadAllPatients(): void {
    this.loading.set(true);
    this.api.searchPatients('').subscribe({
      next: (res) => {
        this.patients.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Patient search error', err);
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    const query = this.searchQuery().trim();
    this.loading.set(true);
    this.page.set(1);
    this.api.searchPatients(query).subscribe({
      next: (res) => {
        this.patients.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Patient search error', err);
        this.loading.set(false);
      }
    });
  }

  loadServices(): void {
    this.api.getServices().subscribe({
      next: (res) => {
        // Map decimal strings to numbers and add selected flag
        const mapped = res.map((s: any) => ({ 
          ...s, 
          price: typeof s.price === 'string' ? parseFloat(s.price) : s.price,
          selected: false 
        }));
        this.services.set(mapped);
      },
      error: (err) => console.error('Error fetching services', err)
    });
  }

  selectPatient(p: any): void {
    this.selectedPatient.set(p);
    this.history.set([]);
    this.loadingHistory.set(true);
    
    // Reset service selections
    this.services.update(list => list.map(s => ({ ...s, selected: false })));
    
    // Fetch patient history
    this.api.getPatientHistory(p.id).subscribe({
      next: (res) => {
        this.history.set(res);
        this.loadingHistory.set(false);
      },
      error: (err) => {
        console.error('Error fetching history', err);
        this.loadingHistory.set(false);
      }
    });
  }

  closeModal(): void {
    this.selectedPatient.set(null);
    this.history.set([]);
    this.loadingHistory.set(false);
    this.services.update(list => list.map(s => ({ ...s, selected: false })));
    this.serviceFilter.set('');
    this.isEditingDemographics.set(false);
  }

  editDemographics(p: any): void {
    this.editSurname.set(p.surname || '');
    this.editFirstName.set(p.firstName || '');
    this.editMiddleName.set(p.middleName || '');
    this.editSex.set(p.sex || 'other');
    this.editAge.set(p.age || 0);
    this.editPhone.set(p.phone || '');
    this.editReferralCenter.set(p.referralCenter || '');
    this.editInsuranceStatus.set(p.insuranceStatus || 'uninsured');
    this.editEmergencyContactName.set(p.emergencyContactName || '');
    this.editEmergencyContactPhone.set(p.emergencyContactPhone || '');
    this.editEmergencyContactRel.set(p.emergencyContactRel || '');
    this.isEditingDemographics.set(true);
  }

  saveDemographics(): void {
    const p = this.selectedPatient();
    if (!p) return;

    if (!this.editSurname().trim() || !this.editFirstName().trim() || !this.editPhone().trim() || !this.editReferralCenter().trim()) {
      this.toast.error('Surname, First Name, Phone, and Referral Center are required.');
      return;
    }

    const payload = {
      surname: this.editSurname().trim(),
      firstName: this.editFirstName().trim(),
      middleName: this.editMiddleName()?.trim() || null,
      sex: this.editSex(),
      age: Number(this.editAge()),
      phone: this.editPhone().trim(),
      referralCenter: this.editReferralCenter().trim(),
      insuranceStatus: this.editInsuranceStatus(),
      emergencyContactName: this.editEmergencyContactName()?.trim() || '',
      emergencyContactPhone: this.editEmergencyContactPhone()?.trim() || '',
      emergencyContactRel: this.editEmergencyContactRel()?.trim() || ''
    };

    this.api.updatePatient(p.id, payload).subscribe({
      next: (updatedPatient) => {
        this.selectedPatient.set(updatedPatient);
        this.patients.update(list => list.map(item => item.id === p.id ? updatedPatient : item));
        this.isEditingDemographics.set(false);
        this.toast.success('Patient demographics updated successfully.');
      },
      error: (err) => {
        console.error('Error updating demographics', err);
        this.toast.error(err?.error?.message ?? 'Failed to update demographics.');
      }
    });
  }

  toggleService(s: ServiceItem): void {
    this.services.update(list =>
      list.map(item => (item.id === s.id ? { ...item, selected: !item.selected } : item))
    );
  }

  readonly filteredServices = computed(() => {
    const filterText = this.serviceFilter().toLowerCase().trim();
    return this.services().filter(s => 
      s.name.toLowerCase().includes(filterText) || 
      s.department.name.toLowerCase().includes(filterText)
    );
  });

  readonly selectedServices = computed(() => {
    return this.services().filter(s => s.selected);
  });

  readonly selectedServicesCount = computed(() => {
    return this.selectedServices().length;
  });

  readonly runningTotal = computed(() => {
    return this.selectedServices().reduce((sum, item) => sum + (item.price || 0), 0);
  });

  createVisit(): void {
    const patient = this.selectedPatient();
    const selected = this.selectedServices();
    
    if (!patient || selected.length === 0) return;

    this.isSubmitting.set(true);
    
    const visitData = {
      patientId: patient.id,
      serviceIds: selected.map(s => s.id)
    };

    this.api.createVisit(visitData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        // Clear selection
        this.services.update(list => list.map(s => ({ ...s, selected: false })));
        // Navigate to Visits board
        this.router.navigateByUrl('/frontdesk/visits');
      },
      error: (err) => {
        console.error('Error creating visit', err);
        this.isSubmitting.set(false);
        alert(err?.error?.message ?? 'Failed to check-in patient.');
      }
    });
  }
}
