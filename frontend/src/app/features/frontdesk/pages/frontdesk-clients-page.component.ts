import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AppTableComponent, TableColumn } from '../../../shared/ui/app-table/app-table.component';

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
    <div class="clients-workspace">
      <!-- Search & Results Panel -->
      <div class="panel list-panel">
        <div class="panel-header">
          <h2>Client Directory</h2>
          <button class="btn btn-primary" routerLink="/frontdesk/new-registration">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <span>Register New Patient</span>
          </button>
        </div>

        <div class="search-box">
          <input
            type="text"
            placeholder="Search by surname, first name or phone..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
            class="form-control search-input"
          />
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <div class="results-list" *ngIf="patients().length > 0; else noResults">
          <div
            *ngFor="let p of patients()"
            class="patient-card"
            [class.active]="selectedPatient()?.id === p.id"
            (click)="selectPatient(p)"
          >
            <div class="avatar">{{ p.surname[0] }}{{ p.firstName[0] }}</div>
            <div class="patient-info">
              <div class="patient-name">{{ p.surname }}, {{ p.firstName }} {{ p.middleName || '' }}</div>
              <div class="patient-meta">
                <span class="tag code">{{ p.patientCode || p.code || 'N/A' }}</span>
                <span class="tag sex" [class.male]="p.sex === 'male'" [class.female]="p.sex === 'female'">
                  {{ p.sex === 'male' ? 'Male' : (p.sex === 'female' ? 'Female' : 'Other') }}
                </span>
                <span class="tag age">{{ p.age }} yrs</span>
              </div>
              <div class="patient-phone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; margin-right: 4px; vertical-align: middle;">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                {{ p.phone }}
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

        <ng-template #noResults>
          <div class="empty-state">
            <div class="empty-icon-wrap" style="color: var(--slate-300); margin-bottom: 1rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px;">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <p *ngIf="searchQuery().trim() === ''">Enter a patient's name or phone to search.</p>
            <p *ngIf="searchQuery().trim() !== ''">No patients found matching "{{ searchQuery() }}".</p>
          </div>
        </ng-template>
      </div>

      <!-- Detail & Visit Checklist Panel -->
      <div class="panel detail-panel" [class.visible]="selectedPatient() !== null">
        <div *ngIf="selectedPatient() as p; else selectPlaceholder" class="detail-container">
          
          <!-- Demographics Card -->
          <div class="patient-header-card">
            <div class="patient-title">
              <h3>{{ p.surname }}, {{ p.firstName }} {{ p.middleName || '' }}</h3>
              <span class="insurance-badge" [class.insured]="p.insuranceStatus === 'insured'">
                {{ p.insuranceStatus === 'insured' ? 'Insured (GHS)' : 'Self-Pay (GHS)' }}
              </span>
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
            </div>
          </div>

          <!-- Actions Grid: Split into History and New Checkin -->
          <div class="actions-grid">
            
            <!-- History Section -->
            <div class="sub-panel history-section">
              <h4>Visit History</h4>
              <div class="history-timeline" *ngIf="history().length > 0; else noHistory">
                <div *ngFor="let h of history()" class="history-item">
                  <div class="timeline-dot" [class.completed]="h.status === 'completed' || h.status === 'paid'"></div>
                  <div class="history-content">
                    <div class="history-date">
                      {{ h.createdAt | date:'MMM d, y, h:mm a' }}
                      <span class="status-pill" [class]="h.status">{{ h.status | uppercase }}</span>
                    </div>
                    <div class="history-services">
                      <span *ngFor="let s of h.visitServices" class="mini-service-tag">
                        {{ s.service?.name }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <ng-template #noHistory>
                <div class="sub-empty">
                  <p>No past visits recorded for this client.</p>
                </div>
              </ng-template>
            </div>

            <!-- New Visit Creation Section -->
            <div class="sub-panel checkin-section">
              <h4>Quick Check-in / Visit Builder</h4>
              <p class="section-desc">Select clinic radiography scans or laboratory services below to route this patient.</p>

              <!-- Services Catalog Selection -->
              <div class="service-selector">
                <div class="catalog-search">
                  <input
                    type="text"
                    placeholder="Filter services..."
                    [(ngModel)]="serviceFilter"
                    class="form-control form-control-sm"
                  />
                </div>
                
                <div class="catalog-list">
                  <div
                    *ngFor="let s of filteredServices()"
                    class="service-row"
                    [class.selected]="s.selected"
                    (click)="toggleService(s)"
                  >
                    <div class="checkbox-box">
                      <input type="checkbox" [checked]="s.selected" readonly />
                    </div>
                    <div class="service-details">
                      <div class="service-name">{{ s.name }}</div>
                      <div class="service-dept">{{ s.department.name }}</div>
                    </div>
                    <div class="service-price">₵{{ s.price.toFixed(2) }}</div>
                  </div>
                </div>
              </div>

              <!-- Running Total & Checkout -->
              <div class="checkout-summary" *ngIf="selectedServicesCount() > 0">
                <div class="summary-line">
                  <span>Selected Services:</span>
                  <strong>{{ selectedServicesCount() }} item(s)</strong>
                </div>
                <div class="summary-line total">
                  <span>Running Total:</span>
                  <strong>₵{{ runningTotal().toFixed(2) }}</strong>
                </div>

                <div class="checkin-actions">
                  <button class="btn btn-success btn-block" [disabled]="isSubmitting()" (click)="createVisit()">
                    <span *ngIf="!isSubmitting()" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                        <path d="M22 2L11 13"></path>
                        <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                      </svg>
                      Check-in & Route Patient
                    </span>
                    <span *ngIf="isSubmitting()">Checking in...</span>
                  </button>
                </div>
              </div>
              
              <div class="checkout-empty" *ngIf="selectedServicesCount() === 0">
                <p>Select one or more services to generate a visit check-in.</p>
              </div>

            </div>

          </div>

        </div>
        
        <ng-template #selectPlaceholder>
          <div class="select-placeholder">
            <div class="pulse-icon-wrap" style="color: var(--slate-300); margin-bottom: 1rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
              </svg>
            </div>
            <h3>Select a Client</h3>
            <p>Choose a patient from the list on the left to view demographics, history, or execute a new clinic visit routing.</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontdeskClientsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');
  readonly patients = signal<any[]>([]);
  readonly selectedPatient = signal<any | null>(null);
  readonly history = signal<any[]>([]);
  readonly services = signal<ServiceItem[]>([]);
  readonly serviceFilter = signal('');
  readonly isSubmitting = signal(false);

  ngOnInit(): void {
    this.loadServices();
    this.loadAllPatients();
  }

  loadAllPatients(): void {
    this.api.searchPatients('').subscribe({
      next: (res) => {
        this.patients.set(res);
      },
      error: (err) => console.error('Patient search error', err)
    });
  }

  onSearchChange(): void {
    const query = this.searchQuery().trim();
    this.api.searchPatients(query).subscribe({
      next: (res) => {
        this.patients.set(res);
      },
      error: (err) => console.error('Patient search error', err)
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
    
    // Reset service selections
    this.services.update(list => list.map(s => ({ ...s, selected: false })));
    
    // Fetch patient history
    this.api.getPatientHistory(p.id).subscribe({
      next: (res) => {
        this.history.set(res);
      },
      error: (err) => console.error('Error fetching history', err)
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
