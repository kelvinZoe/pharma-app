import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { evaluateFormula } from '../../../shared/utils/formula-parser';

interface ServiceLine {
  id: string;
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'done' | 'not_done';
  notDoneReason?: string;
  template?: any;
  resultValues: Record<string, any>;
  narrativeText?: string;
}

@Component({
  selector: 'app-worklist-queue-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clinical-workspace">
      <!-- Requests Queue Panel -->
      <div class="panel list-panel" style="box-shadow: none; border-color: var(--app-border-color);">
        <div class="panel-header">
          <h2>{{ deptName() }} Queue</h2>
          <button class="btn btn-secondary btn-sm" (click)="loadQueue()">
            🔄 Refresh Queue
          </button>
        </div>

        <p class="section-desc">Select a patient below to start executing procedures, capturing results, or prescribing drugs.</p>

        <div class="queue-list" *ngIf="visits().length > 0; else emptyQueue">
          <div
            *ngFor="let v of visits()"
            class="queue-card"
            [class.active]="selectedVisit()?.id === v.id"
            (click)="selectVisit(v)"
            style="box-shadow: none;"
          >
            <div class="avatar" [style.backgroundColor]="deptColor()">
              {{ v.patient.surname[0] }}{{ v.patient.firstName[0] }}
            </div>
            <div class="queue-info">
              <div class="patient-name">{{ v.patient.surname }}, {{ v.patient.firstName }}</div>
              <div class="queue-meta">
                <span>Code: {{ v.patient.patientCode }}</span> • 
                <span>Age: {{ v.patient.age }}</span> • 
                <span>Time: {{ v.createdAt | date:'shortTime' }}</span>
              </div>
            </div>
            <div class="arrow-indicator">➔</div>
          </div>
        </div>

        <ng-template #emptyQueue>
          <div class="empty-queue" style="padding: 2.5rem 1rem; text-align: center; color: var(--app-muted-text-color);">
            <div class="queue-icon" style="font-size: 2.5rem; margin-bottom: 0.75rem;">📋</div>
            <h3 style="margin: 0 0 0.5rem; color: var(--app-text-color);">No Queued Patients</h3>
            <p style="font-size: 0.85rem; max-width: 260px; margin: 0 auto; line-height: 1.4;">There are currently no active requests routed to the {{ deptName() }} department.</p>
          </div>
        </ng-template>
      </div>

      <!-- Procedure Workspace Panel -->
      <div class="panel detail-panel" [class.visible]="selectedVisit() !== null" style="box-shadow: none; border-color: var(--app-border-color);">
        <div *ngIf="selectedVisit() as v; else selectPlaceholder" class="clinical-details">
          
          <!-- Demographics Strip -->
          <div class="demographics-banner" style="box-shadow: none; border-color: var(--app-border-color);">
            <div class="patient-info">
              <h3>{{ v.patient.surname }}, {{ v.patient.firstName }} {{ v.patient.middleName || '' }}</h3>
              <div class="meta">
                Code: <strong>{{ v.patient.patientCode }}</strong> • 
                Sex: <strong>{{ v.patient.sex }}</strong> • 
                Age: <strong>{{ v.patient.age }} Yrs</strong>
              </div>
            </div>
            <div class="referral-source" *ngIf="v.patient.referralCenter">
              Ref: {{ v.patient.referralCenter }}
            </div>
          </div>

          <!-- Main Workspace split -->
          <div class="procedure-grid">
            
            <!-- Procedure forms -->
            <div class="procedure-sub-panel" style="box-shadow: none; border-color: var(--app-border-color);">
              <h3>Requested Clinical Services</h3>
              <p class="section-desc">Record results and mark status for each service line item.</p>

              <div *ngFor="let s of serviceLines()" class="visit-service-line" [class.done]="s.status === 'done'" [class.not-done]="s.status === 'not_done'">
                <div class="line-header">
                  <span class="service-name">{{ s.serviceName }}</span>
                  
                  <div class="line-status-actions">
                    <button
                      class="btn-done-toggle"
                      [class.active]="s.status === 'done'"
                      (click)="setLineStatus(s, 'done')"
                    >
                      ✓ DONE
                    </button>
                    <button
                      class="btn-notdone-toggle"
                      [class.active]="s.status === 'not_done'"
                      (click)="setLineStatus(s, 'not_done')"
                    >
                      ✗ NOT DONE
                    </button>
                  </div>
                </div>

                <!-- DONE state form results -->
                <div *ngIf="s.status === 'done'" class="result-template-form mt-2" style="box-shadow: none;">
                  <div *ngIf="s.template; else loadingTemplate">
                    
                    <!-- IF NEW DYNAMIC SCHEMA FORMAT -->
                    <div *ngIf="s.template.columns && s.template.columns.length > 0; else narrativeOnly">
                      <div style="overflow-x: auto; width: 100%;">
                        <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
                          <thead>
                            <tr>
                              <th style="border: 1px solid var(--app-border-color); padding: 0.5rem 0.65rem; background-color: var(--slate-50); font-weight: 750; font-size: 0.725rem; text-align: left; color: var(--slate-600); text-transform: uppercase;">
                                Test Parameter
                              </th>
                              <th *ngFor="let col of s.template.columns" style="border: 1px solid var(--app-border-color); padding: 0.5rem 0.65rem; background-color: var(--slate-50); font-weight: 750; font-size: 0.725rem; color: var(--slate-600); text-transform: uppercase;" [style.textAlign]="col.alignment">
                                {{ col.label }}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            
                            <!-- Grouped by custom configured sections -->
                            <ng-container *ngFor="let sec of s.template.sections">
                              <tr style="background-color: var(--slate-100);">
                                <td [attr.colspan]="s.template.columns.length + 1" style="border: 1px solid var(--app-border-color); padding: 0.4rem 0.65rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--slate-700);">
                                  {{ sec.name }}
                                </td>
                              </tr>
                              
                              <tr *ngFor="let row of getRowsForSection(s, sec.id)" [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? '#fee2e2' : 'transparent'">
                                <td style="border: 1px solid var(--app-border-color); padding: 0.45rem 0.65rem; font-weight: 700; font-size: 0.8rem; color: var(--slate-800);">
                                  {{ row.label }}
                                </td>
                                
                                <td *ngFor="let col of s.template.columns" style="border: 1px solid var(--app-border-color); padding: 0.35rem 0.5rem;" [style.textAlign]="col.alignment">
                                  
                                  <!-- Read-only or formula computed values -->
                                  <div *ngIf="col.isReadonly || col.dataType === 'computed' || col.dataType === 'formula'; else inputCell" style="font-size: 0.8rem; display: flex; align-items: center; justify-content: flex-start; gap: 0.25rem;">
                                    <span [style.fontWeight]="col.key === 'observed_value' || col.key === 'status' ? '700' : '400'"
                                          [style.color]="s.resultValues[row.id]?.[col.key] === 'HIGH' || s.resultValues[row.id]?.[col.key] === 'ABNORMAL' || s.resultValues[row.id]?.[col.key] === 'LOW' || s.resultValues[row.id]?.isAbnormal ? 'var(--app-danger-color)' : 'var(--slate-800)'">
                                      {{ s.resultValues[row.id]?.[col.key] }}
                                    </span>
                                    <span style="font-size: 0.65rem; color: var(--app-muted-text-color);" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">
                                      {{ col.refUnit }}
                                    </span>
                                  </div>

                                  <!-- Editable cells input switcher -->
                                  <ng-template #inputCell>
                                    
                                    <!-- Decimal / Number inputs -->
                                    <input
                                      *ngIf="col.dataType === 'decimal' || col.dataType === 'number'"
                                      type="number"
                                      step="any"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem; text-align: right;"
                                      [style.borderColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--app-danger-color)' : 'var(--app-border-color)'"
                                      [required]="col.isRequired"
                                    />

                                    <!-- Choice option selects -->
                                    <select
                                      *ngIf="col.dataType === 'select'"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                      [required]="col.isRequired"
                                    >
                                      <option value="">-- Choose --</option>
                                      <option *ngFor="let opt of col.validationRules?.split(',')" [value]="opt.trim()">
                                        {{ opt.trim() }}
                                      </option>
                                    </select>

                                    <!-- Yes/No Checkboxes -->
                                    <input
                                      *ngIf="col.dataType === 'checkbox'"
                                      type="checkbox"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      style="width: 16px; height: 16px; cursor: pointer; display: block; margin: 0 auto;"
                                    />

                                    <!-- Date Picker cells -->
                                    <input
                                      *ngIf="col.dataType === 'date'"
                                      type="date"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                    />

                                    <!-- Standard clinical Text input fallbacks -->
                                    <input
                                      *ngIf="col.dataType !== 'decimal' && col.dataType !== 'number' && col.dataType !== 'select' && col.dataType !== 'checkbox' && col.dataType !== 'date'"
                                      type="text"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                      [required]="col.isRequired"
                                    />
                                  </ng-template>
                                </td>
                              </tr>
                            </ng-container>

                            <!-- General rows outside sections -->
                            <ng-container *ngIf="getRowsForSection(s, null).length > 0">
                              <tr style="background-color: var(--slate-100);" *ngIf="s.template.sections?.length > 0">
                                <td [attr.colspan]="s.template.columns.length + 1" style="border: 1px solid var(--app-border-color); padding: 0.4rem 0.65rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--slate-700);">
                                  General Observation Parameters
                                </td>
                              </tr>
                              
                              <tr *ngFor="let row of getRowsForSection(s, null)" [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? '#fee2e2' : 'transparent'">
                                <td style="border: 1px solid var(--app-border-color); padding: 0.45rem 0.65rem; font-weight: 700; font-size: 0.8rem; color: var(--slate-800);">
                                  {{ row.label }}
                                </td>
                                <td *ngFor="let col of s.template.columns" style="border: 1px solid var(--app-border-color); padding: 0.35rem 0.5rem;" [style.textAlign]="col.alignment">
                                  <div *ngIf="col.isReadonly || col.dataType === 'computed' || col.dataType === 'formula'; else inputCell" style="font-size: 0.8rem; display: flex; align-items: center; justify-content: flex-start; gap: 0.25rem;">
                                    <span [style.fontWeight]="col.key === 'observed_value' || col.key === 'status' ? '700' : '400'"
                                          [style.color]="s.resultValues[row.id]?.[col.key] === 'HIGH' || s.resultValues[row.id]?.[col.key] === 'ABNORMAL' || s.resultValues[row.id]?.[col.key] === 'LOW' || s.resultValues[row.id]?.isAbnormal ? 'var(--app-danger-color)' : 'var(--slate-800)'">
                                      {{ s.resultValues[row.id]?.[col.key] }}
                                    </span>
                                    <span style="font-size: 0.65rem; color: var(--app-muted-text-color);" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">
                                      {{ col.refUnit }}
                                    </span>
                                  </div>
                                  
                                  <ng-template #inputCell>
                                    <input
                                      *ngIf="col.dataType === 'decimal' || col.dataType === 'number'"
                                      type="number"
                                      step="any"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem; text-align: right;"
                                      [style.borderColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--app-danger-color)' : 'var(--app-border-color)'"
                                      [required]="col.isRequired"
                                    />
                                    <select
                                      *ngIf="col.dataType === 'select'"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                      [required]="col.isRequired"
                                    >
                                      <option value="">-- Choose --</option>
                                      <option *ngFor="let opt of col.validationRules?.split(',')" [value]="opt.trim()">
                                        {{ opt.trim() }}
                                      </option>
                                    </select>
                                    <input
                                      *ngIf="col.dataType === 'checkbox'"
                                      type="checkbox"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      style="width: 16px; height: 16px; cursor: pointer; display: block; margin: 0 auto;"
                                    />
                                    <input
                                      *ngIf="col.dataType === 'date'"
                                      type="date"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                    />
                                    <input
                                      *ngIf="col.dataType !== 'decimal' && col.dataType !== 'number' && col.dataType !== 'select' && col.dataType !== 'checkbox' && col.dataType !== 'date'"
                                      type="text"
                                      [(ngModel)]="s.resultValues[row.id][col.key]"
                                      (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                      class="form-control form-control-sm"
                                      style="padding: 0.25rem 0.45rem; font-size: 0.775rem;"
                                      [required]="col.isRequired"
                                    />
                                  </ng-template>
                                </td>
                              </tr>
                            </ng-container>

                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- Narrative note fallback in case columns are empty -->
                    <ng-template #narrativeOnly>
                      <div class="form-group mb-0">
                        <label style="font-weight: 750; font-size: 0.8rem; color: var(--slate-700);">
                          Procedure Narrative Findings / Scans Summary
                        </label>
                        <textarea
                          class="form-control"
                          rows="4"
                          [(ngModel)]="s.narrativeText"
                          placeholder="Type detailed radiography findings or clinical summary here..."
                          style="font-size: 0.85rem;"
                        ></textarea>
                      </div>
                    </ng-template>

                  </div>
                  
                  <ng-template #loadingTemplate>
                    <div style="padding: 1.5rem; text-align: center; color: var(--app-muted-text-color);">
                      <div class="pulse-icon" style="font-size: 1.5rem; display: inline-block; animation: pulse 2s infinite;">🔬</div>
                      <p style="font-size: 0.8rem; margin-top: 0.5rem;">Loading dynamic template layout...</p>
                    </div>
                  </ng-template>
                </div>

                <!-- Not Done state reason form -->
                <div *ngIf="s.status === 'not_done'" class="not-done-reason-container mt-2">
                  <label>Reason for Cancellation <span class="text-danger">*</span></label>
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    [(ngModel)]="s.notDoneReason"
                    placeholder="Enter reason for not performing service"
                  />
                  <div class="preset-reasons">
                    <span class="preset-badge" (click)="s.notDoneReason = 'Patient uncooperative'">
                      Patient uncooperative
                    </span>
                    <span class="preset-badge" (click)="s.notDoneReason = 'Equipment malfunction'">
                      Equipment malfunction
                    </span>
                    <span class="preset-badge" (click)="s.notDoneReason = 'Prep guidelines not followed'">
                      Prep guidelines not followed
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <!-- Sidebar Panel: Extra Procedures and Prescriptions -->
            <div class="sidebar-panel">
              
              <!-- Add Extra Procedure -->
              <div class="extra-services-card" style="box-shadow: none; border-color: var(--app-border-color);">
                <h4>➕ Add Extra Procedure</h4>
                <p class="section-desc">Add supplementary scans or laboratory tests directly during this session.</p>
                
                <div class="extra-selector">
                  <div class="form-group mb-2">
                    <select class="form-control form-control-sm" [ngModel]="selectedExtraServiceId()" (ngModelChange)="selectedExtraServiceId.set($event)">
                      <option value="">-- Select Scan/Test Catalog --</option>
                      <option *ngFor="let cat of catalogServices()" [value]="cat.id">
                        {{ cat.name }} (₵{{ cat.price.toFixed(2) }})
                      </option>
                    </select>
                  </div>
                  
                  <label class="consent-checkbox mb-2" [class.active]="consentApproved()">
                    <input type="checkbox" [ngModel]="consentApproved()" (ngModelChange)="consentApproved.set($event)" style="width: 16px; height: 16px;" />
                    <span>Patient has approved and consented to billing</span>
                  </label>

                  <button
                    class="btn btn-secondary btn-sm btn-block"
                    [disabled]="!selectedExtraServiceId() || !consentApproved()"
                    (click)="addExtraService()"
                  >
                    Add to Session
                  </button>
                </div>
              </div>

              <!-- Prescriber Notepad -->
              <div class="prescriptions-card" style="box-shadow: none; border-color: var(--app-border-color);">
                <h4>💊 Prescriber Notepad</h4>
                <p>Prescribe medications or follow-up pharmacy treatments below.</p>
                
                <textarea
                  placeholder="e.g. Amoxicillin 500mg - 3 times daily for 5 days. Paracetamol 500mg - PRN for pain."
                  [ngModel]="prescriptionText()"
                  (ngModelChange)="prescriptionText.set($event)"
                  class="form-control"
                ></textarea>
              </div>

              <!-- Final Submit actions -->
              <div class="submit-actions mt-3">
                <button
                  class="btn btn-success btn-lg btn-block"
                  [disabled]="isSubmitting() || !isWorkspaceValid()"
                  (click)="finalizeWorkspace()"
                >
                  <span *ngIf="!isSubmitting()">🚀 Finalize & Route Patient</span>
                  <span *ngIf="isSubmitting()">Saving results...</span>
                </button>
              </div>

            </div>

          </div>

        </div>
        
        <ng-template #selectPlaceholder>
          <div class="select-placeholder">
            <div class="pulse-icon" [style.color]="deptColor()">🔬</div>
            <h3>Procedure Room</h3>
            <p>Select a queued patient from the list on the left to begin radiography imaging execution, lab results capture, and prescribing medications.</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styleUrl: './department-worklist-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorklistQueuePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly deptCode = signal<'LAB' | 'SCAN'>('LAB');
  readonly visits = signal<any[]>([]);
  readonly selectedVisit = signal<any | null>(null);
  
  // Active procedures to capture
  readonly serviceLines = signal<ServiceLine[]>([]);
  
  // Extra service catalogue
  readonly catalogServices = signal<any[]>([]);
  readonly selectedExtraServiceId = signal('');
  readonly consentApproved = signal(false);

  // Prescriptions Text
  readonly prescriptionText = signal('');
  readonly isSubmitting = signal(false);

  readonly deptName = computed(() => this.deptCode() === 'LAB' ? 'Laboratory' : 'Scanning');
  readonly deptColor = computed(() => this.deptCode() === 'LAB' ? '#0d9488' : '#3b82f6');

  ngOnInit(): void {
    // Infer department based on active route url segment
    const url = this.router.url;
    if (url.includes('scanning')) {
      this.deptCode.set('SCAN');
    } else {
      this.deptCode.set('LAB');
    }
    
    this.loadQueue();
    this.loadCatalog();
  }

  loadQueue(): void {
    this.api.getActiveVisits(this.deptCode()).subscribe({
      next: (res) => {
        // Exclude completely finalized visits that are paid or fully completed
        this.visits.set(res.filter(v => v.status === 'registered' || v.status === 'sent_to_department' || v.status === 'in_progress'));
      },
      error: (err) => console.error('Error loading request queue', err)
    });
  }

  loadCatalog(): void {
    this.api.getServices().subscribe({
      next: (res) => {
        // Filter catalog to services of this department
        this.catalogServices.set(res.filter((s: any) => s.department.code === this.deptCode()));
      },
      error: (err) => console.error('Error fetching catalog services', err)
    });
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.prescriptionText.set('');
    this.serviceLines.set([]);
    
    // Map services belonging to this department
    const lines = v.services
      .filter((s: any) => s.service.department.code === this.deptCode())
      .map((s: any) => {
        const line: ServiceLine = {
          id: s.id,
          serviceId: s.service.id,
          serviceName: s.service.name,
          status: s.status === 'pending' ? 'done' : s.status,
          notDoneReason: s.notDoneReason || '',
          resultValues: {},
          narrativeText: ''
        };

        // Load service result template
        this.api.getServiceTemplate(s.service.id).subscribe({
          next: (res) => {
            if (res && res.layoutJson) {
              try {
                const parsed = typeof res.layoutJson === 'string' ? JSON.parse(res.layoutJson) : res.layoutJson;
                if (parsed && (parsed.columns || parsed.rows)) {
                  line.template = parsed;
                  
                  // Pre-populate values nested structure: rowId -> colKey -> value
                  line.resultValues = {};
                  parsed.rows.forEach((r: any) => {
                    line.resultValues[r.id] = { isAbnormal: false };
                    parsed.columns.forEach((c: any) => {
                      line.resultValues[r.id][c.key] = r.defaultValues?.[c.key] ?? c.defaultValue ?? '';
                    });
                    // Run initial formulas
                    this.recalculateCapturingRowFormulas(line, r.id);
                  });
                } else if (parsed && parsed.fields) {
                  // Fallback to legacy fields layout compatibility
                  line.template = parsed;
                  line.resultValues = {};
                  parsed.fields.forEach((f: any) => {
                    line.resultValues[f.key] = f.type === 'checkbox' ? false : '';
                  });
                }
              } catch (e) {
                console.error('Error parsing service template layout', e);
              }
            }
          }
        });

        return line;
      });

    this.serviceLines.set(lines);
  }

  setLineStatus(s: ServiceLine, status: 'done' | 'not_done'): void {
    this.serviceLines.update(list =>
      list.map(item => (item.id === s.id ? { ...item, status, notDoneReason: status === 'not_done' ? 'Patient uncooperative' : '' } : item))
    );
  }

  // Section divider filter helper for capturing UI
  getRowsForSection(s: ServiceLine, secId: string | null): any[] {
    if (!s.template || !s.template.rows) return [];
    return s.template.rows.filter((r: any) => {
      return secId ? r.sectionId === secId : (!r.sectionId || r.sectionId === '');
    });
  }

  // Capturing Real-time Safe Formula Recalculator
  recalculateCapturingRowFormulas(s: ServiceLine, rowId: string): void {
    if (!s.template || !s.template.columns) return;
    const columns = s.template.columns;
    const rowValues = s.resultValues[rowId] || {};

    const context = { ...rowValues };
    columns.forEach((col: any) => {
      const isFormula = col.dataType === 'computed' || col.dataType === 'formula';
      if (isFormula && col.formula) {
        const val = evaluateFormula(col.formula, context);
        rowValues[col.key] = val;
        context[col.key] = val; // support chain stack calculations
      }
    });

    // Check abnormal bounds
    let isAbnormal = false;
    columns.forEach((col: any) => {
      const valStr = rowValues[col.key];

      // Computed status checker
      if (col.dataType === 'computed' && valStr && (valStr.toString().toLowerCase() === 'high' || valStr.toString().toLowerCase() === 'abnormal' || valStr.toString().toLowerCase() === 'low')) {
        isAbnormal = true;
      }

      // Range numbers boundary checker
      const valNum = parseFloat(valStr);
      if (!isNaN(valNum)) {
        const rowMeta = s.template.rows?.find((r: any) => r.id === rowId);
        const minBound = parseFloat(rowMeta?.defaultValues?.[col.key + '_min'] || col.refRangeMin);
        const maxBound = parseFloat(rowMeta?.defaultValues?.[col.key + '_max'] || col.refRangeMax);
        if (!isNaN(minBound) && valNum < minBound) isAbnormal = true;
        if (!isNaN(maxBound) && valNum > maxBound) isAbnormal = true;
      }
    });
    rowValues.isAbnormal = isAbnormal;
  }

  addExtraService(): void {
    const visit = this.selectedVisit();
    const serviceId = this.selectedExtraServiceId();
    if (!visit || !serviceId || !this.consentApproved()) return;

    this.api.addExtraService(visit.id, serviceId).subscribe({
      next: (res) => {
        // Service successfully added! Let's refresh our lines
        alert('Extra procedure added successfully and patient consent recorded.');
        
        // Find newly added line in return payload and append
        this.api.getVisit(visit.id).subscribe({
          next: (updatedVisit) => {
            this.selectedVisit.set(updatedVisit);
            this.selectVisit(updatedVisit);
            // Reset selectors
            this.selectedExtraServiceId.set('');
            this.consentApproved.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error adding extra service', err);
        alert(err?.error?.message ?? 'Failed to add extra service.');
      }
    });
  }

  isWorkspaceValid(): boolean {
    // Ensure all service lines have chosen status, and if not_done, has reason
    const lines = this.serviceLines();
    if (lines.length === 0) return false;
    
    return lines.every(s => {
      if (s.status === 'not_done') {
        return !!s.notDoneReason && s.notDoneReason.trim() !== '';
      }
      return s.status === 'done';
    });
  }

  finalizeWorkspace(): void {
    const v = this.selectedVisit();
    if (!v || !this.isWorkspaceValid()) return;

    this.isSubmitting.set(true);

    // Save prescriptions if any
    const rxText = this.prescriptionText().trim();

    // Compile result entries for saving
    const resultsPayload = {
      services: this.serviceLines().map(s => ({
        visitServiceId: s.id,
        status: s.status,
        notDoneReason: s.notDoneReason || null,
        resultDataJson: s.status === 'done' ? JSON.stringify(s.resultValues) : null,
        narrativeNotes: s.status === 'done' && s.narrativeText ? s.narrativeText.trim() : null
      }))
    };

    // Chain operations
    const saveResults = () => {
      this.api.saveVisitResult(v.id, resultsPayload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.selectedVisit.set(null);
          this.serviceLines.set([]);
          this.loadQueue();
          alert('Procedure workspace saved and routed successfully.');
        },
        error: (err) => {
          console.error('Error saving result entries', err);
          this.isSubmitting.set(false);
          alert(err?.error?.message ?? 'Failed to save results.');
        }
      });
    };

    if (rxText) {
      this.api.savePrescription(v.id, rxText).subscribe({
        next: () => saveResults(),
        error: (err) => {
          console.error('Error saving prescription', err);
          // Still try saving results
          saveResults();
        }
      });
    } else {
      saveResults();
    }
  }
}
