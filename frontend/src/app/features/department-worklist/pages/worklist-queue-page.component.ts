import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { evaluateFormula } from '../../../shared/utils/formula-parser';
import { ToastService } from '../../../core/services/toast.service';
import { AppDropdownComponent } from '../../../shared/ui/app-dropdown/app-dropdown.component';

interface ServiceLine {
  id: string;
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'done' | 'not_done';
  notDoneReason?: string;
  template?: any;
  resultValues: Record<string, any>;
  narrativeText?: string;
  source?: 'frontdesk' | 'department_added';
}

@Component({
  selector: 'app-worklist-queue-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppDropdownComponent],
  template: `
    <!-- Modern Workspace Header -->
    <div class="modern-page-header">
      <div class="header-content">
        <h2>{{ deptName() }} Workflow</h2>
        <p>Manage {{ deptName() }} requests, capture results, and issue prescriptions.</p>
      </div>
      <div class="header-decoration">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
      </div>
    </div>

    <div class="clinical-workspace">
      <!-- Requests Queue Panel -->
      <div class="panel list-panel modern-glass-panel">
        <div class="panel-header">
          <h2>{{ deptName() }} Queue</h2>
          <button class="modern-btn-icon" (click)="loadQueue()" title="Refresh Queue">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>

        <p class="section-desc">Select a patient below to start executing procedures, capturing results, or prescribing drugs.</p>

        <div class="queue-list" *ngIf="visits().length > 0; else emptyQueue">
          <div
            *ngFor="let v of visits()"
            class="queue-card premium-stat-card"
            [class.active]="selectedVisit()?.id === v.id"
            (click)="selectVisit(v)"
          >
            <div class="queue-info">
              <div class="patient-name">{{ v.patient.surname }}, {{ v.patient.firstName }}</div>
              <div class="queue-meta">
                <span class="bold-monospaced">{{ v.patient.patientCode }}</span> • 
                <span>{{ v.patient.age }} Yrs</span> • 
                <span>{{ v.createdAt | date:'shortTime' }}</span>
              </div>
            </div>
            <div class="arrow-indicator">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>
          </div>
        </div>

        <ng-template #emptyQueue>
          <div class="empty-clinical-state">
            <div class="state-icon-wrapper pulse-soft">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3>No Queued Patients</h3>
            <p>There are currently no active requests routed to the {{ deptName() }} department.</p>
          </div>
        </ng-template>
      </div>

      <!-- Procedure Workspace Panel -->
      <div class="panel detail-panel premium-border" [class.visible]="selectedVisit() !== null">
        <div *ngIf="selectedVisit() as v; else selectPlaceholder" class="clinical-details">
          
          <!-- Demographics Strip -->
          <div class="demographics-card modern-glass-panel">
            <div class="patient-info-content">
              <h3>{{ v.patient.surname }}, {{ v.patient.firstName }} {{ v.patient.middleName || '' }}</h3>
              <div class="modern-meta-tags">
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Code: <strong>{{ v.patient.patientCode }}</strong></span>
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> {{ v.patient.sex }}</span>
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> {{ v.patient.age }} Yrs</span>
              </div>
            </div>
            <div class="referral-badge" *ngIf="v.patient.referralCenter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Ref: {{ v.patient.referralCenter }}</span>
            </div>
          </div>

          <!-- Main Workspace split -->
          <!-- Helper Tools Row (Procedure addition & Prescriptions Notepad) -->
          <div class="helper-tools-grid">
            
            <!-- Add Extra Procedure -->
            <div class="extra-services-card premium-border" style="padding: 1.25rem; background: #fff;">
              <h4 style="margin: 0 0 0.5rem; display: flex; align-items: center; gap: 0.35rem; font-weight: 800; color: var(--slate-800);">
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Extra Procedure
              </h4>
              <p class="section-desc" style="color: var(--slate-500); margin-bottom: 1rem;">Add supplementary scans or laboratory tests directly during this session.</p>
              
              <div class="extra-selector">
                <div class="form-group mb-2">
                  <app-dropdown
                    [items]="catalogServices()"
                    labelKey="displayLabel"
                    valueKey="id"
                    [(value)]="selectedExtraServiceId"
                    placeholder="Select Scan/Test Catalog">
                  </app-dropdown>
                </div>
                
                <label class="consent-checkbox mb-2" [class.active]="consentApproved()">
                  <input type="checkbox" [ngModel]="consentApproved()" (ngModelChange)="consentApproved.set($event)" style="width: 16px; height: 16px;" />
                  <span>Patient has approved and consented to billing</span>
                </label>

                <button
                  class="btn btn-primary btn-sm btn-block"
                  [disabled]="!selectedExtraServiceId() || !consentApproved()"
                  (click)="addExtraService()"
                >
                  Add to Session
                </button>
              </div>
            </div>

            <!-- Prescriber Notepad -->
            <div class="prescriptions-card premium-border" style="padding: 1.25rem; background: #fff;">
              <h4 style="margin: 0 0 0.5rem; display: flex; align-items: center; gap: 0.35rem; font-weight: 800; color: var(--slate-800);">
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Prescriber Notepad
              </h4>
              <p style="color: var(--slate-500); font-size: 0.8rem; margin-bottom: 1rem;">Prescribe medications or follow-up pharmacy treatments below.</p>
              
              <textarea
                placeholder="e.g. Amoxicillin 500mg - 3 times daily for 5 days. Paracetamol 500mg - PRN for pain."
                [ngModel]="prescriptionText()"
                (ngModelChange)="prescriptionText.set($event)"
                class="form-control"
                style="height: 90px; font-size: 0.825rem;"
              ></textarea>
            </div>

          </div>

          <!-- Main Workspace (Full Width) -->
          <div class="procedure-sub-panel modern-glass-panel">
            <h3 class="panel-section-title">Requested Clinical Services</h3>
            <p class="section-desc">Record results and mark status for each service line item.</p>

            <!-- Empty state for services -->
            <div class="empty-services-state" *ngIf="serviceLines().length === 0">
              <div class="icon-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              </div>
              <p>No initial clinical services were requested.<br>You can add extra procedures using the catalog above.</p>
            </div>

            <div *ngFor="let s of serviceLines()" class="visit-service-line" [class.done]="s.status === 'done'" [class.not-done]="s.status === 'not_done'">
              <div class="line-header" style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 0.75rem 1rem; border-radius: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
                <span class="service-name" style="font-weight: 700; color: var(--slate-700);">{{ s.serviceName }}</span>
                
                <div class="line-status-actions" style="display: flex; gap: 0.5rem; align-items: center;">
                  
                  <!-- Remove Button (Only for department-added procedures, not for user-requested ones) -->
                  <button
                    *ngIf="s.source === 'department_added'"
                    class="btn-remove-line"
                    (click)="removeServiceLine(s)"
                    title="Remove Procedure"
                  >
                    <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.5;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    REMOVE
                  </button>

                  <div *ngIf="s.source === 'department_added'" style="width: 1px; height: 16px; background-color: var(--slate-200); margin: 0 0.25rem;"></div>

                  <button
                    class="btn-done-toggle"
                    [class.active]="s.status === 'done'"
                    (click)="setLineStatus(s, 'done')"
                    style="display: flex; align-items: center; gap: 0.25rem;"
                  >
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    DONE
                  </button>
                  <button
                    class="btn-notdone-toggle"
                    [class.active]="s.status === 'not_done'"
                    (click)="setLineStatus(s, 'not_done')"
                    style="display: flex; align-items: center; gap: 0.25rem;"
                  >
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    NOT DONE
                  </button>
                </div>
              </div>

              <!-- DONE state form results -->
              <div *ngIf="s.status === 'done'" class="result-template-form mt-2" style="border: 1px solid var(--slate-200); border-top: none; border-radius: 0 0 0.35rem 0.35rem; padding: 1rem; background: #fff;">
                <div *ngIf="s.template; else loadingTemplate">
                  
                  <!-- IF NEW DYNAMIC SCHEMA FORMAT -->
                  <div *ngIf="s.template.columns && s.template.columns.length > 0; else narrativeOnly">
                    <div style="overflow-x: auto; width: 100%;">
                      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-family: 'Courier New', Courier, monospace;">
                        <thead>
                          <tr>
                            <th style="border: 1px solid var(--slate-300); padding: 0.5rem 0.65rem; background-color: var(--slate-100); font-weight: 800; font-size: 0.725rem; text-align: left; color: var(--slate-600); text-transform: uppercase; font-family: 'Inter', sans-serif; min-width: 180px; white-space: nowrap;">
                              Test Parameter
                            </th>
                            <th *ngFor="let col of s.template.columns" style="border: 1px solid var(--slate-300); padding: 0.5rem 0.65rem; background-color: var(--slate-100); font-weight: 800; font-size: 0.725rem; color: var(--slate-600); text-transform: uppercase; font-family: 'Inter', sans-serif; min-width: 120px; white-space: nowrap;" [style.textAlign]="col.alignment">
                              {{ col.label }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          
                          <!-- Grouped by custom configured sections -->
                          <ng-container *ngFor="let sec of s.template.sections">
                            <tr style="background-color: var(--slate-50);">
                              <td [attr.colspan]="s.template.columns.length + 1" style="border: 1px solid var(--slate-300); padding: 0.4rem 0.65rem; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--slate-700); font-family: 'Inter', sans-serif;">
                                {{ sec.name }}
                              </td>
                            </tr>
                            
                            <tr *ngFor="let row of getRowsForSection(s, sec.id)" [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--red-50)' : 'transparent'">
                              <td style="border: 1px solid var(--slate-300); padding: 0.45rem 0.65rem; font-weight: 700; font-size: 0.8rem; color: var(--slate-800); font-family: 'Inter', sans-serif;">
                                {{ row.label }}
                              </td>
                              
                              <td *ngFor="let col of s.template.columns" style="border: 1px solid var(--slate-300); padding: 0.35rem 0.5rem;" [style.textAlign]="col.alignment">
                                
                                <!-- Read-only or formula computed values -->
                                <div *ngIf="(col.isReadonly && col.dataType === 'readonly') || col.dataType === 'computed' || col.dataType === 'formula'; else inputCell" style="font-size: 0.8rem; display: flex; align-items: center; justify-content: flex-start; gap: 0.25rem;">
                                  <span [style.fontWeight]="col.key === 'observed_value' || col.key === 'status' ? '700' : '400'"
                                        [style.color]="s.resultValues[row.id]?.[col.key] === 'HIGH' || s.resultValues[row.id]?.[col.key] === 'ABNORMAL' || s.resultValues[row.id]?.[col.key] === 'LOW' || s.resultValues[row.id]?.isAbnormal ? 'var(--red-600)' : 'var(--slate-800)'">
                                    {{ s.resultValues[row.id]?.[col.key] }}
                                  </span>
                                  <span style="font-size: 0.65rem; color: var(--slate-400); font-family: 'Inter', sans-serif;" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">
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
                                    style="padding: 0.25rem 0.45rem; font-size: 0.8rem; text-align: right; font-family: 'Courier New', Courier, monospace; color: var(--slate-800) !important; background-color: #fff !important;"
                                    [style.borderColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--red-500)' : 'var(--slate-300)'"
                                    [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--red-50)' : '#fff'"
                                    [required]="col.isRequired"
                                  />

                                  <!-- Choice option selects -->
                                  <select
                                    *ngIf="col.dataType === 'select'"
                                    [(ngModel)]="s.resultValues[row.id][col.key]"
                                    (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                    class="form-control form-control-sm"
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
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
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
                                  />

                                  <!-- Standard clinical Text input fallbacks -->
                                  <input
                                    *ngIf="col.dataType !== 'decimal' && col.dataType !== 'number' && col.dataType !== 'select' && col.dataType !== 'checkbox' && col.dataType !== 'date'"
                                    type="text"
                                    [(ngModel)]="s.resultValues[row.id][col.key]"
                                    (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                    class="form-control form-control-sm"
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
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
                                <div *ngIf="(col.isReadonly && col.dataType === 'readonly') || col.dataType === 'computed' || col.dataType === 'formula'; else inputCell" style="font-size: 0.8rem; display: flex; align-items: center; justify-content: flex-start; gap: 0.25rem;">
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
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; text-align: right; color: var(--slate-800) !important; background-color: #fff !important;"
                                    [style.borderColor]="s.resultValues[row.id]?.isAbnormal ? 'var(--app-danger-color)' : 'var(--app-border-color)'"
                                    [required]="col.isRequired"
                                  />
                                  <select
                                    *ngIf="col.dataType === 'select'"
                                    [(ngModel)]="s.resultValues[row.id][col.key]"
                                    (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                    class="form-control form-control-sm"
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
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
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
                                  />
                                  <input
                                    *ngIf="col.dataType !== 'decimal' && col.dataType !== 'number' && col.dataType !== 'select' && col.dataType !== 'checkbox' && col.dataType !== 'date'"
                                    type="text"
                                    [(ngModel)]="s.resultValues[row.id][col.key]"
                                    (ngModelChange)="recalculateCapturingRowFormulas(s, row.id)"
                                    class="form-control form-control-sm"
                                    style="padding: 0.25rem 0.45rem; font-size: 0.775rem; color: var(--slate-800) !important; background-color: #fff !important;"
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
                  <div style="padding: 1.5rem; text-align: center; color: var(--slate-400);">
                    <div class="pulse-icon" style="display: inline-block; animation: pulse 2s infinite; margin-bottom: 0.5rem;">
                      <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2;"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>
                    </div>
                    <p style="font-size: 0.8rem; font-weight: 600;">Loading dynamic template layout...</p>
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

            <!-- Final Submit actions at the bottom of the workspace -->
            <div class="workspace-submit-block" style="display: flex; justify-content: flex-end; margin-top: 2rem;">
              <button
                class="modern-btn-primary"
                style="min-width: 280px;"
                [disabled]="isSubmitting() || !isWorkspaceValid()"
                (click)="finalizeWorkspace()"
              >
                <span class="btn-content" *ngIf="!isSubmitting()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; margin-right: 0.35rem;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  Finalize & Route Patient
                </span>
                <span class="btn-content" *ngIf="isSubmitting()">
                  <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width: 16px; height: 16px; margin-right: 0.35rem;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                  Saving results...
                </span>
              </button>
            </div>

          </div>

        </div>
        
        <ng-template #selectPlaceholder>
          <div class="empty-clinical-state select-placeholder">
            <div class="state-icon-wrapper pulse-ring" [style.color]="deptCode() === 'LAB' ? '#0d9488' : '#3b82f6'">
              <svg *ngIf="deptCode() === 'LAB'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v7.31L4.65 19.3A1.5 1.5 0 0 0 6 21.5h12a1.5 1.5 0 0 0 1.35-2.2L14 9.3V2"></path><path d="M8.5 2h7"></path><path d="M5.52 16h12.96"></path></svg>
              <svg *ngIf="deptCode() === 'SCAN'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"></path></svg>
            </div>
            <h3>{{ deptName() }} Procedure Room</h3>
            <p>Select a queued patient from the list on the left to begin clinical diagnostics execution, results entry, and prescribing treatments.</p>
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
  private readonly toast = inject(ToastService);

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
        const departmentServices = res
          .filter((s: any) => s.department.code === this.deptCode())
          .map((s: any) => ({ ...s, displayLabel: `${s.name} (₵${Number(s.price).toFixed(2)})` }));
        this.catalogServices.set(departmentServices);
      },
      error: (err) => console.error('Error fetching catalog services', err)
    });
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.prescriptionText.set('');
    this.serviceLines.set([]);
    
    // Map services belonging to this department
    const rawServices = v.services || v.visitServices || [];
    const lines = rawServices
      .filter((s: any) => s.service?.department?.code === this.deptCode())
      .map((s: any) => {
        const line: ServiceLine = {
          id: s.id,
          serviceId: s.service.id,
          serviceName: s.service.name,
          status: s.status === 'pending' ? 'done' : s.status,
          notDoneReason: s.notDoneReason || '',
          resultValues: {},
          narrativeText: s.results?.[0]?.narrativeNotes || s.narrativeNotes || '',
          source: s.source || 'frontdesk'
        };

        // Load service result template
        this.api.getServiceTemplate(s.service.id).subscribe({
          next: (res) => {
            if (res && res.layoutJson) {
              try {
                const parsed = typeof res.layoutJson === 'string' ? JSON.parse(res.layoutJson) : res.layoutJson;
                if (parsed && (parsed.columns || parsed.rows)) {
                  this.serviceLines.update(list => {
                    return list.map(item => {
                      if (item.id === s.id) {
                        const updatedValues: Record<string, any> = {};
                        
                        // Parse existing saved result values
                        const dbResult = s.results?.[0]?.resultDataJson;
                        let savedValues: Record<string, any> = {};
                        if (dbResult) {
                          try {
                            savedValues = typeof dbResult === 'string' ? JSON.parse(dbResult) : dbResult;
                          } catch (e) {
                            console.error('Error parsing saved resultDataJson', e);
                          }
                        }

                        parsed.rows.forEach((r: any) => {
                          updatedValues[r.id] = savedValues[r.id] || { isAbnormal: false };
                          parsed.columns.forEach((c: any) => {
                            if (updatedValues[r.id][c.key] === undefined) {
                              updatedValues[r.id][c.key] = r.defaultValues?.[c.key] ?? c.defaultValue ?? '';
                            }
                          });
                        });
                        
                        const tempLine: ServiceLine = {
                          ...item,
                          template: parsed,
                          resultValues: updatedValues,
                          narrativeText: s.results?.[0]?.narrativeNotes || item.narrativeText || ''
                        };
                        
                        parsed.rows.forEach((r: any) => {
                          this.recalculateCapturingRowFormulas(tempLine, r.id);
                        });
                        
                        return tempLine;
                      }
                      return item;
                    });
                  });
                } else if (parsed && parsed.fields) {
                  this.serviceLines.update(list => {
                    return list.map(item => {
                      if (item.id === s.id) {
                        const updatedValues: Record<string, any> = {};
                        
                        // Parse existing saved result values for legacy fields
                        const dbResult = s.results?.[0]?.resultDataJson;
                        let savedValues: Record<string, any> = {};
                        if (dbResult) {
                          try {
                            savedValues = typeof dbResult === 'string' ? JSON.parse(dbResult) : dbResult;
                          } catch (e) {
                            console.error('Error parsing saved legacy resultDataJson', e);
                          }
                        }

                        parsed.fields.forEach((f: any) => {
                          updatedValues[f.key] = savedValues[f.key] !== undefined ? savedValues[f.key] : (f.type === 'checkbox' ? false : '');
                        });
                        
                        return {
                          ...item,
                          template: parsed,
                          resultValues: updatedValues,
                          narrativeText: s.results?.[0]?.narrativeNotes || item.narrativeText || ''
                        };
                      }
                      return item;
                    });
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

  removeServiceLine(s: ServiceLine): void {
    const visit = this.selectedVisit();
    if (!visit) return;
    
    if (confirm(`Are you sure you want to remove "${s.serviceName}" from this session?`)) {
      this.api.removeExtraService(visit.id, s.id).subscribe({
        next: () => {
          this.toast.success(`"${s.serviceName}" removed successfully.`);
          
          // Re-fetch visit to update all fields and totals
          this.api.getVisit(visit.id).subscribe({
            next: (updatedVisit) => {
              this.selectedVisit.set(updatedVisit);
              this.selectVisit(updatedVisit);
            }
          });
        },
        error: (err) => {
          console.error('Error removing service line', err);
          this.toast.error(err?.error?.message ?? 'Failed to remove service line.');
        }
      });
    }
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
        this.toast.success('Extra procedure added successfully and patient consent recorded.');
        
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
        this.toast.error(err?.error?.message ?? 'Failed to add extra service.');
      }
    });
  }

  isWorkspaceValid(): boolean {
    const lines = this.serviceLines();
    if (lines.length === 0) return true; // Allowed to finalize if they just came for prescription or consult
    
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
          this.toast.success('Procedure workspace saved and routed successfully.');
        },
        error: (err) => {
          console.error('Error saving result entries', err);
          this.isSubmitting.set(false);
          this.toast.error(err?.error?.message ?? 'Failed to save results.');
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
