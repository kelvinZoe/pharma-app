import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

interface GeneralTemplateItem {
  id: string;
  name: string;
  isActive: boolean;
  items: {
    id: string;
    sortOrder: number;
    service: {
      id: string;
      name: string;
      price: number;
      department: {
        id: string;
        name: string;
        code: string;
      }
    }
  }[];
}

@Component({
  selector: 'app-admin-general-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="admin-workspace">
      
      <!-- General Templates Panel -->
      <div class="panel full-width">
        <div class="panel-header">
          <h2>General Report Templates</h2>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm" (click)="loadTemplates()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh
            </button>
            <button class="btn btn-primary btn-sm" (click)="openNewTemplateModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 4px; display: inline-block; vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create Template
            </button>
          </div>
        </div>

        <p class="section-desc">Create composite report layouts grouping multiple diagnostic services. These templates let clinicians print complete structured reports, showing blank sections for tests not performed during a visit.</p>

        <!-- Templates Grid/List -->
        <div class="table-responsive" style="margin-top: 1rem; background: #ffffff; border-radius: 0.5rem; border: 1px solid var(--app-border-color); overflow: hidden;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid var(--app-border-color); background: #f8fafc; font-size: 0.75rem; text-transform: uppercase; color: var(--slate-500); font-weight: 800;">
                <th style="padding: 0.85rem 1rem;">Template Name</th>
                <th style="padding: 0.85rem 1rem;">Department</th>
                <th style="padding: 0.85rem 1rem;">Included Services</th>
                <th style="padding: 0.85rem 1rem; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="loading()">
                <td colspan="4" style="text-align: center; padding: 3rem; color: var(--slate-400);">
                  <div style="border: 3px solid #e2e8f0; border-top: 3px solid var(--teal-600); border-radius: 50%; width: 24px; height: 24px; animation: spin-loader 0.8s linear infinite; margin: 0 auto 0.75rem;"></div>
                  <style>
                    @keyframes spin-loader {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  </style>
                  <span>Loading templates...</span>
                </td>
              </tr>
              <tr *ngFor="let t of templates()" style="border-bottom: 1px solid var(--app-border-color); font-size: 0.85rem; color: var(--slate-700);" class="table-row-hover" [class.d-none]="loading()">
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: var(--slate-800);">{{ t.name }}</td>
                <td style="padding: 0.85rem 1rem;">
                  <span class="badge" style="background: var(--teal-50); color: var(--teal-700); font-weight: 750; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 12px;">
                    {{ getTemplateDepartment(t) }}
                  </span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                  <div style="font-size: 0.8rem; color: var(--slate-500);">
                    {{ getServicesListString(t) }}
                  </div>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                  <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-secondary btn-xs" (click)="editTemplate(t)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                      Edit
                    </button>
                    <button class="btn btn-danger btn-xs" (click)="deleteTemplate(t)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="templates().length === 0 && !loading()">
                <td colspan="4" style="text-align: center; padding: 3rem; color: var(--slate-400);">
                  <h3>No general templates created yet</h3>
                  <p>Click "Create Template" to configure your first composite clinic report.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create/Edit Modal Overlay -->
      <div class="modal-backdrop" *ngIf="isModalOpen()" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()" style="max-width: 580px; width: 90%;">
          <div class="modal-card-header">
            <h3>
              {{ editingTemplate() ? 'Edit General Template' : 'Create General Template' }}
            </h3>
            <button class="modal-close-btn" (click)="closeModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="modal-body">
            <form [formGroup]="templateForm" (ngSubmit)="submitTemplate()" class="sidebar-form">
              
              <div class="form-group">
                <label for="template-name">Template Name <span class="text-danger">*</span></label>
                <input id="template-name" type="text" formControlName="name" class="form-control" placeholder="e.g. Lab General Report" />
                <div *ngIf="templateForm.get('name')?.touched && templateForm.get('name')?.invalid" class="text-danger small mt-1">
                  Template name is required.
                </div>
              </div>

              <div class="form-group">
                <label for="template-department">Department <span class="text-danger">*</span></label>
                <select id="template-department" formControlName="departmentId" (change)="onDepartmentChange()" class="form-control">
                  <option value="">-- Select Department --</option>
                  <option *ngFor="let d of departments()" [value]="d.id">{{ d.name }}</option>
                </select>
                <div *ngIf="templateForm.get('departmentId')?.touched && templateForm.get('departmentId')?.invalid" class="text-danger small mt-1">
                  Department selection is required.
                </div>
              </div>

              <!-- Services Selection (Filtered by Department) -->
              <div class="form-group" *ngIf="templateForm.get('departmentId')?.value">
                <label style="font-weight: 750; display: block; margin-bottom: 0.5rem;">Select Services to Include:</label>
                
                <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--app-border-color); border-radius: 0.375rem; padding: 0.5rem; background: #fafafa;">
                  <div *ngFor="let s of filteredServices()" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; font-size: 0.85rem;">
                    <input 
                      type="checkbox" 
                      [id]="'svc-' + s.id" 
                      [checked]="isServiceSelected(s.id)"
                      (change)="toggleServiceSelection(s)"
                      style="width: 16px; height: 16px; cursor: pointer;" />
                    <label [for]="'svc-' + s.id" style="cursor: pointer; margin: 0; font-weight: 500; color: var(--slate-700);">
                      {{ s.name }}
                    </label>
                  </div>
                  <div *ngIf="filteredServices().length === 0" style="text-align: center; color: var(--slate-400); padding: 1rem 0;">
                    No services configured for this department.
                  </div>
                </div>
              </div>

              <!-- Reordering / Sort list of selected services -->
              <div class="form-group" *ngIf="selectedServices().length > 0">
                <label style="font-weight: 750; display: block; margin-bottom: 0.25rem;">Arrange Print Order:</label>
                <p style="font-size: 12px; color: var(--slate-400); margin: 0 0 0.5rem;">Use arrows to arrange services in the exact order they should print on report sheet.</p>

                <div style="border: 1px solid var(--app-border-color); border-radius: 0.375rem; background: #ffffff; overflow: hidden;">
                  <div *ngFor="let s of selectedServices(); let idx = index" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--app-border-color); font-size: 0.825rem; font-weight: 600; color: var(--slate-700);" class="table-row-hover">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="color: var(--slate-400); font-size: 0.75rem;">{{ idx + 1 }}.</span>
                      {{ s.name }}
                    </span>
                    <div style="display: flex; gap: 0.25rem;">
                      <button type="button" class="btn btn-secondary btn-xs" style="padding: 2px 6px;" [disabled]="idx === 0" (click)="moveServiceUp(idx)">
                        ▲
                      </button>
                      <button type="button" class="btn btn-secondary btn-xs" style="padding: 2px 6px;" [disabled]="idx === selectedServices().length - 1" (click)="moveServiceDown(idx)">
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="d-flex gap-2 justify-content-end mt-4">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="templateForm.invalid || selectedServices().length === 0 || isSubmitting()">
                  <span *ngIf="!isSubmitting()">Save Template</span>
                  <span *ngIf="isSubmitting()">Processing...</span>
                </button>
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
export class AdminGeneralTemplatesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly templates = signal<GeneralTemplateItem[]>([]);
  readonly departments = signal<any[]>([]);
  readonly services = signal<any[]>([]);

  readonly filteredServices = signal<any[]>([]);
  readonly selectedServices = signal<any[]>([]);

  readonly isModalOpen = signal(false);
  readonly editingTemplate = signal<GeneralTemplateItem | null>(null);
  readonly isSubmitting = signal(false);
  readonly loading = signal(false);

  readonly templateForm = this.fb.group({
    name: ['', [Validators.required]],
    departmentId: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.loadTemplates();
    this.loadDepartments();
    this.loadServices();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.api.getGeneralTemplates().subscribe({
      next: (res) => {
        this.templates.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching general templates', err);
        this.loading.set(false);
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

  loadServices(): void {
    this.api.getServices().subscribe({
      next: (res) => {
        let list = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && res.data) {
          list = res.data;
        }
        this.services.set(list);
      },
      error: (err) => console.error('Error fetching services', err)
    });
  }

  getTemplateDepartment(t: GeneralTemplateItem): string {
    if (t.items && t.items.length > 0) {
      return t.items[0].service?.department?.name ?? 'General';
    }
    return 'Unassigned';
  }

  getServicesListString(t: GeneralTemplateItem): string {
    if (!t.items || t.items.length === 0) return 'No services configured';
    return t.items.map(i => i.service?.name).join(', ');
  }

  onDepartmentChange(): void {
    const deptId = this.templateForm.get('departmentId')?.value;
    this.selectedServices.set([]); // Reset selected services
    
    if (!deptId) {
      this.filteredServices.set([]);
      return;
    }

    const filtered = this.services().filter(s => s.departmentId === deptId);
    this.filteredServices.set(filtered);
  }

  isServiceSelected(serviceId: string): boolean {
    return this.selectedServices().some(s => s.id === serviceId);
  }

  toggleServiceSelection(service: any): void {
    const list = [...this.selectedServices()];
    const index = list.findIndex(s => s.id === service.id);

    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(service);
    }
    this.selectedServices.set(list);
  }

  moveServiceUp(index: number): void {
    if (index === 0) return;
    const list = [...this.selectedServices()];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;
    this.selectedServices.set(list);
  }

  moveServiceDown(index: number): void {
    const list = [...this.selectedServices()];
    if (index === list.length - 1) return;
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;
    this.selectedServices.set(list);
  }

  openNewTemplateModal(): void {
    this.editingTemplate.set(null);
    this.selectedServices.set([]);
    this.filteredServices.set([]);
    this.templateForm.reset({ name: '', departmentId: '' });
    this.isModalOpen.set(true);
  }

  editTemplate(t: GeneralTemplateItem): void {
    this.editingTemplate.set(t);
    this.isModalOpen.set(true);

    // Get department ID from first item
    const firstItem = t.items[0];
    const deptId = firstItem?.service?.department?.id ?? '';

    this.templateForm.patchValue({
      name: t.name,
      departmentId: deptId
    });

    // Populate filtered services for this department
    const filtered = this.services().filter(s => s.departmentId === deptId);
    this.filteredServices.set(filtered);

    // Populate selected services from template items, ordered by sortOrder
    const sortedItems = [...t.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const selected = sortedItems.map(item => item.service);
    this.selectedServices.set(selected);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingTemplate.set(null);
    this.selectedServices.set([]);
    this.filteredServices.set([]);
    this.templateForm.reset({ name: '', departmentId: '' });
  }

  deleteTemplate(t: GeneralTemplateItem): void {
    const confirmDelete = confirm(`Are you sure you want to permanently delete template "${t.name}"?`);
    if (!confirmDelete) return;

    this.api.deleteGeneralTemplate(t.id).subscribe({
      next: () => {
        this.loadTemplates();
        this.toast.success('Template has been successfully deleted.');
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err?.error?.message ?? 'Failed to delete template.');
      }
    });
  }

  submitTemplate(): void {
    if (this.templateForm.invalid || this.selectedServices().length === 0) return;

    this.isSubmitting.set(true);
    const formVal = this.templateForm.getRawValue();
    const serviceIds = this.selectedServices().map(s => s.id);

    const payload = {
      name: (formVal.name ?? '').trim(),
      serviceIds
    };

    const target = this.editingTemplate();
    const req$ = target 
      ? this.api.updateGeneralTemplate(target.id, payload)
      : this.api.createGeneralTemplate(payload);

    req$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.loadTemplates();
        this.toast.success(target ? 'Template updated successfully.' : 'General template registered successfully.');
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to save general template.');
      }
    });
  }
}
