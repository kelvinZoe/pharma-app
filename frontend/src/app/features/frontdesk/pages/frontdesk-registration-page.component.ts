import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

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
  selector: 'app-frontdesk-registration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="registration-workspace">
      <div class="panel">
        <div class="panel-header">
          <h2>New Patient Registration</h2>
          <button class="btn btn-secondary" routerLink="/frontdesk/clients">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Directory</span>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="registration-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">First Name <span class="text-danger">*</span></label>
              <input id="firstName" type="text" formControlName="firstName" class="form-control" placeholder="e.g. Yaw" />
              <div *ngIf="form.get('firstName')?.touched && form.get('firstName')?.invalid" class="text-danger small mt-1">
                First name is required.
              </div>
            </div>
            
            <div class="form-group">
              <label for="surname">Surname <span class="text-danger">*</span></label>
              <input id="surname" type="text" formControlName="surname" class="form-control" placeholder="e.g. Mensah" />
              <div *ngIf="form.get('surname')?.touched && form.get('surname')?.invalid" class="text-danger small mt-1">
                Surname is required.
              </div>
            </div>

            <div class="form-group">
              <label for="middleName">Middle Name <span class="text-muted">(Optional)</span></label>
              <input id="middleName" type="text" formControlName="middleName" class="form-control" placeholder="e.g. Kofi" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="sex">Gender <span class="text-danger">*</span></label>
              <select id="sex" formControlName="sex" class="form-control custom-select">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <div *ngIf="form.get('sex')?.touched && form.get('sex')?.invalid" class="text-danger small mt-1">
                Gender is required.
              </div>
            </div>

            <div class="form-group">
              <label for="age">Age (Years) <span class="text-danger">*</span></label>
              <input id="age" type="number" formControlName="age" class="form-control" placeholder="e.g. 28" min="0" />
              <div *ngIf="form.get('age')?.touched && form.get('age')?.invalid" class="text-danger small mt-1">
                Valid age is required.
              </div>
            </div>

            <div class="form-group">
              <label for="phone">Phone Number <span class="text-danger">*</span></label>
              <input id="phone" type="text" formControlName="phone" class="form-control" placeholder="e.g. 0244123456" />
              <div *ngIf="form.get('phone')?.touched && form.get('phone')?.invalid" class="text-danger small mt-1">
                Phone number is required.
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="referralCenter">Referral Center / Doctor <span class="text-muted">(Optional)</span></label>
              <input id="referralCenter" type="text" formControlName="referralCenter" class="form-control" placeholder="e.g. Ridge Hospital" />
            </div>

            <div class="form-group">
              <label for="reasonForVisit">Reason for Visit <span class="text-muted">(Optional)</span></label>
              <input id="reasonForVisit" type="text" formControlName="reasonForVisit" class="form-control" placeholder="e.g. Routine Checkup, Persistent Cough" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="emergencyContactName">Emergency Contact Name <span class="text-muted">(Optional)</span></label>
              <input id="emergencyContactName" type="text" formControlName="emergencyContactName" class="form-control" placeholder="e.g. Mary Mensah" />
            </div>

            <div class="form-group">
              <label for="emergencyContactPhone">Emergency Contact Phone <span class="text-muted">(Optional)</span></label>
              <input id="emergencyContactPhone" type="text" formControlName="emergencyContactPhone" class="form-control" placeholder="e.g. 0201122334" />
            </div>
          </div>

          <div class="form-group">
            <label class="d-flex align-items-center mt-3" style="cursor: pointer;">
              <input type="checkbox" formControlName="insured" style="width: 18px; height: 18px; margin-right: 0.5rem;" />
              <strong>Patient is Insured / Covers Radiography Billing</strong>
            </label>
          </div>
        </form>
      </div>

      <!-- Services & Check-in Panel -->
      <div class="panel">
        <div class="panel-header">
          <h2>Select Services Catalog</h2>
        </div>

        <p class="section-desc">Select initial services. You can type in the box to filter by name or department.</p>

        <!-- Service Catalog Selector -->
        <div class="service-selector">
          <div class="catalog-search">
            <input
              type="text"
              placeholder="Filter by name or department..."
              [(ngModel)]="serviceFilter"
              class="form-control form-control-sm search-input"
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

        <!-- Checkout Summary -->
        <div class="checkout-summary" *ngIf="selectedServicesCount() > 0">
          <div class="summary-line">
            <span>Insurance Cover:</span>
            <strong>{{ form.get('insured')?.value ? 'Active (NHIS / Corporate)' : 'None (Self-Pay)' }}</strong>
          </div>
          <div class="summary-line">
            <span>Selected Lines:</span>
            <strong>{{ selectedServicesCount() }} item(s)</strong>
          </div>
          <div class="summary-line total">
            <span>Total to Pay:</span>
            <strong>₵{{ runningTotal().toFixed(2) }}</strong>
          </div>

          <div class="checkin-actions">
            <button class="btn btn-success btn-block btn-lg" [disabled]="form.invalid || isSubmitting()" (click)="submit()">
              <span *ngIf="!isSubmitting()" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
                Register & Route Patient
              </span>
              <span *ngIf="isSubmitting()">Registering & routing...</span>
            </button>
          </div>
        </div>

        <div class="checkout-empty" *ngIf="selectedServicesCount() === 0">
          <p>Choose at least one scanner radiography or lab procedure from the catalog to submit registration.</p>
        </div>
      </div>
    </div>
  `,
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontdeskRegistrationPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly services = signal<ServiceItem[]>([]);
  readonly serviceFilter = signal('');
  readonly isSubmitting = signal(false);

  readonly form = this.fb.group({
    firstName: ['', [Validators.required]],
    surname: ['', [Validators.required]],
    middleName: [''],
    sex: ['', [Validators.required]],
    age: [null as number | null, [Validators.required, Validators.min(0)]],
    phone: ['', [Validators.required]],
    referralCenter: [''],
    reasonForVisit: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    insured: [false]
  });

  ngOnInit(): void {
    this.loadServices();
  }

  loadServices(): void {
    this.api.getServices().subscribe({
      next: (res) => {
        // Map string prices to number to avoid NaN in running totals
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

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const selected = this.selectedServices();
    if (selected.length === 0) {
      alert('Please select at least one clinical service catalog item.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const formValue = this.form.getRawValue();
      const patientData = {
        firstName: formValue.firstName?.trim() ?? '',
        surname: formValue.surname?.trim() ?? '',
        middleName: formValue.middleName?.trim() ?? '',
        sex: formValue.sex || 'male',
        age: Number(formValue.age),
        phone: formValue.phone?.trim() ?? '',
        referralCenter: formValue.referralCenter?.trim() ?? '',
        reasonForVisit: formValue.reasonForVisit?.trim() ?? '',
        emergencyContactName: formValue.emergencyContactName?.trim() ?? '',
        emergencyContactPhone: formValue.emergencyContactPhone?.trim() ?? '',
        insuranceStatus: formValue.insured ? 'insured' : 'uninsured'
      };

      // 1. Create Patient
      this.api.createPatient(patientData).subscribe({
        next: (patient) => {
          // 2. Create Visit
          const visitData = {
            patientId: patient.id,
            serviceIds: selected.map(s => s.id)
          };

          this.api.createVisit(visitData).subscribe({
            next: () => {
              this.isSubmitting.set(false);
              this.router.navigateByUrl('/frontdesk/visits');
            },
            error: (visitErr) => {
              console.error('Error creating visit', visitErr);
              this.isSubmitting.set(false);
              alert(visitErr?.error?.message ?? 'Failed to route patient visit.');
            }
          });
        },
        error: (patErr) => {
          console.error('Error registering patient', patErr);
          this.isSubmitting.set(false);
          alert(patErr?.error?.message ?? 'Failed to register new patient.');
        }
      });
    } catch (err: any) {
      console.error(err);
      this.isSubmitting.set(false);
    }
  }
}
