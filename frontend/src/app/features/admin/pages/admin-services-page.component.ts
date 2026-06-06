import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
}

@Component({
  selector: 'app-admin-services-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AppTableComponent],
  template: `
    <div class="admin-workspace">
      
      <!-- Services catalog Panel -->
      <div class="panel full-width">
        <div class="panel-header">
          <h2>Clinical Services Catalog</h2>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm" (click)="loadServices()">
              <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh List
            </button>
            <button class="btn btn-primary btn-sm" (click)="openNewServiceModal()">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Register Service
            </button>
          </div>
        </div>

        <p class="section-desc">Define fixed baseline pricing for scanners and laboratory diagnostics. Select a service to customize its result template layout.</p>

        <!-- Reusable Paginated Table -->
        <app-table
          [columns]="columns"
          [data]="services()"
          [total]="total()"
          [page]="page()"
          [limit]="limit()"
          [loading]="loading()"
          [selectedRowId]="null"
          rowIdKey="id"
          exportFileName="services_catalog"
          (pageChange)="onPageChange($event)"
          (searchChange)="onSearchChange($event)"
          (actionClick)="onActionClick($event)"
          (rowClick)="onRowClick($event)"
        ></app-table>
      </div>

      <!-- Pricing Overlay Modal Dialog -->
      <div class="modal-backdrop" *ngIf="isModalOpen()" (click)="cancelPriceEdit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-card-header">
            <h3>
              {{ editingPriceService() ? 'Edit Service Details' : 'Register Clinical Service' }}
            </h3>
            <button class="modal-close-btn" (click)="cancelPriceEdit()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="modal-body">
            <form [formGroup]="serviceForm" (ngSubmit)="submitService()" class="sidebar-form">
              <div class="form-group">
                <label for="service-name">Procedure/Scan Name <span class="text-danger">*</span></label>
                <input id="service-name" type="text" formControlName="name" class="form-control" placeholder="e.g. Chest X-Ray (A/P)" />
                <div *ngIf="serviceForm.get('name')?.touched && serviceForm.get('name')?.invalid" class="text-danger small mt-1">
                  Service name is required.
                </div>
              </div>

              <div class="form-group">
                <label for="service-department">Clinic Department <span class="text-danger">*</span></label>
                <select id="service-department" formControlName="departmentId" class="form-control">
                  <option value="">-- Choose Department --</option>
                  <option *ngFor="let d of departments()" [value]="d.id">{{ d.name }}</option>
                </select>
                <div *ngIf="serviceForm.get('departmentId')?.touched && serviceForm.get('departmentId')?.invalid" class="text-danger small mt-1">
                  Department selection is required.
                </div>
              </div>

              <div class="form-group">
                <label for="service-price">Standard GHS Price (₵) <span class="text-danger">*</span></label>
                <input id="service-price" type="number" step="0.01" formControlName="price" class="form-control" placeholder="0.00" />
                <div *ngIf="serviceForm.get('price')?.touched && serviceForm.get('price')?.invalid" class="text-danger small mt-1">
                  A valid positive price is required.
                </div>
              </div>

              <div class="d-flex justify-content-between mt-4">
                <div>
                  <button type="button" class="btn btn-danger" *ngIf="editingPriceService()" (click)="deleteService()" [disabled]="isSubmittingService()" style="background-color: #dc2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#b91c1c'" onmouseout="this.style.backgroundColor='#dc2626'">
                    Delete Service
                  </button>
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-secondary" (click)="cancelPriceEdit()">Cancel</button>
                  <button type="submit" class="btn btn-primary" [disabled]="serviceForm.invalid || isSubmittingService()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span *ngIf="!isSubmittingService()">Save Service</span>
                    <span *ngIf="isSubmittingService()">Processing...</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `,
  styleUrl: './admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminServicesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Table source signals
  readonly services = signal<ServiceItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly loading = signal(false);
  readonly search = signal('');

  readonly departments = signal<any[]>([]);
  readonly serviceTemplatesMap = signal<Record<string, boolean>>({});

  // Overlay forms
  readonly isModalOpen = signal(false);
  readonly editingPriceService = signal<ServiceItem | null>(null);
  readonly isSubmittingService = signal(false);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Procedure Name', type: 'text' },
    { key: 'department.name', label: 'Clinic Department', type: 'badge' },
    { key: 'price', label: 'Standard Price', type: 'price' },
    { key: 'templateStatus', label: 'Template Status', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions', actionLabel: 'Edit Details' }
  ];

  readonly serviceForm = this.fb.group({
    name: ['', [Validators.required]],
    departmentId: ['', [Validators.required]],
    price: [null as number | null, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    this.loadServices();
    this.loadDepartments();
  }

  loadServices(): void {
    this.loading.set(true);
    this.api.getServices(this.page(), this.limit(), this.search()).subscribe({
      next: (res) => {
        this.loading.set(false);
        let list: ServiceItem[] = [];

        if (Array.isArray(res)) {
          list = res;
          this.total.set(res.length);
        } else if (res && res.data) {
          list = res.data;
          this.total.set(res.total || 0);
        }

        // Trace templates configuration status
        const map = { ...this.serviceTemplatesMap() };
        list.forEach((s: any) => {
          map[s.id] = s.resultTemplates && s.resultTemplates.length > 0;
        });
        this.serviceTemplatesMap.set(map);

        // Map status value
        const mapped = list.map(s => ({
          ...s,
          templateStatus: this.hasTemplate(s.id)
        }));
        this.services.set(mapped);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error loading services', err);
      }
    });
  }

  loadDepartments(): void {
    this.api.getDepartments().subscribe({
      next: (res) => {
        this.departments.set(res);
      },
      error: (err) => console.error('Error fetching departments', err)
    });
  }

  hasTemplate(serviceId: string): boolean {
    return !!this.serviceTemplatesMap()[serviceId];
  }

  openNewServiceModal(): void {
    this.cancelPriceEdit();
    this.isModalOpen.set(true);
  }

  editServicePrice(s: ServiceItem): void {
    this.editingPriceService.set(s);
    this.serviceForm.patchValue({
      name: s.name,
      departmentId: s.departmentId ?? '',
      price: s.price
    });
    this.isModalOpen.set(true);
  }

  cancelPriceEdit(): void {
    this.editingPriceService.set(null);
    this.isModalOpen.set(false);
    this.serviceForm.reset({ name: '', departmentId: '', price: null });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadServices();
  }

  onSearchChange(search: string): void {
    this.search.set(search);
    this.page.set(1);
    this.loadServices();
  }

  onActionClick(event: { action: string, row: any }): void {
    if (event.action === 'click') {
      this.editServicePrice(event.row);
    }
  }

  onRowClick(row: any): void {
    this.router.navigate(['/admin/templates'], { queryParams: { id: row.id } });
  }

  deleteService(): void {
    const service = this.editingPriceService();
    if (!service) return;

    const confirmDelete = confirm(`Are you sure you want to permanently delete the service "${service.name}"?`);
    if (!confirmDelete) return;

    this.isSubmittingService.set(true);
    this.api.deleteService(service.id).subscribe({
      next: () => {
        this.isSubmittingService.set(false);
        this.cancelPriceEdit();
        this.loadServices();
        alert('Service has been successfully deleted.');
      },
      error: (err) => {
        console.error(err);
        this.isSubmittingService.set(false);
        alert(err?.error?.message ?? 'Failed to delete service.');
      }
    });
  }

  submitService(): void {
    if (this.serviceForm.invalid) return;

    this.isSubmittingService.set(true);
    const formVal = this.serviceForm.getRawValue();
    const priceVal = Number(formVal.price);

    const priceTarget = this.editingPriceService();
    if (priceTarget) {
      this.api.updateService(priceTarget.id, {
        name: (formVal.name ?? '').trim(),
        departmentId: formVal.departmentId,
        price: priceVal
      }).subscribe({
        next: () => {
          this.isSubmittingService.set(false);
          this.cancelPriceEdit();
          this.loadServices();
          alert('Catalog service updated successfully.');
        },
        error: (err) => {
          console.error(err);
          this.isSubmittingService.set(false);
          alert('Failed to edit standard service details.');
        }
      });
    } else {
      this.api.createService({
        name: (formVal.name ?? '').trim(),
        departmentId: formVal.departmentId,
        price: priceVal
      }).subscribe({
        next: () => {
          this.isSubmittingService.set(false);
          this.cancelPriceEdit();
          this.loadServices();
          alert('New radiography/laboratory service registered in catalog.');
        },
        error: (err) => {
          console.error(err);
          this.isSubmittingService.set(false);
          alert(err?.error?.message ?? 'Failed to create service catalog.');
        }
      });
    }
  }
}

