import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { evaluateFormula } from '../../../shared/utils/formula-parser';
import { ToastService } from '../../../core/services/toast.service';
import { AppDropdownComponent } from '../../../shared/ui/app-dropdown/app-dropdown.component';
import { getInternetDate } from '../../../core/utils/clock';
import { SessionService } from '../../../core/auth/session.service';

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
          <h2>{{ deptName() }} Queue <span class="queue-badge-count" [style.background-color]="deptCode() === 'LAB' ? 'var(--teal-500)' : 'var(--app-primary-color)'">{{ visits().length }}</span></h2>
          <button class="modern-btn-icon" (click)="loadQueue()" title="Refresh Queue">
            <svg class="refresh-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>

        <p class="section-desc">Select a patient below to start executing procedures, capturing results, or prescribing drugs.</p>

        <!-- Realtime Queue Search Input -->
        <div class="queue-search-bar">
          <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search patient or code..." 
            [ngModel]="searchQuery()" 
            (ngModelChange)="searchQuery.set($event)"
            class="queue-search-input"
          />
          <button *ngIf="searchQuery()" class="clear-search-btn" (click)="searchQuery.set('')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="queue-list" *ngIf="isLoadingQueue() || visits().length > 0; else emptyQueue">
          <!-- Loading Preloader Skeletons -->
          <ng-container *ngIf="isLoadingQueue()">
            <div *ngFor="let dummy of [1, 2, 3, 4]" class="skeleton-queue-card">
              <div class="avatar-skeleton skeleton-shimmer"></div>
              <div class="info-skeleton">
                <div class="skeleton-shimmer" style="height: 0.95rem; width: 70%;"></div>
                <div class="skeleton-shimmer" style="height: 0.75rem; width: 50%;"></div>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="!isLoadingQueue()">
            <div
              *ngFor="let v of filteredVisits()"
              class="queue-card premium-stat-card"
              [class.active]="selectedVisit()?.id === v.id"
              [class.lab-active]="selectedVisit()?.id === v.id && deptCode() === 'LAB'"
              [class.scan-active]="selectedVisit()?.id === v.id && deptCode() === 'SCAN'"
              (click)="selectVisit(v)"
            >
              <div class="avatar" [style.background-color]="deptCode() === 'LAB' ? '#f0fdf4' : '#eff6ff'" [style.color]="deptCode() === 'LAB' ? '#0d9488' : '#2563eb'" [style.border]="'1px solid ' + (deptCode() === 'LAB' ? '#bcf0da' : '#bfdbfe')" style="font-family: inherit; font-weight: 800; border-radius: 50%; min-width: 2.75rem; height: 2.75rem; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                {{ v.patient.surname.slice(0, 1) }}{{ v.patient.firstName.slice(0, 1) }}
              </div>
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
            
            <div *ngIf="filteredVisits().length === 0" class="search-empty-state">
              <svg class="search-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <p>No patients match your search filter.</p>
            </div>
          </ng-container>
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
        <!-- Preloader Skeleton for details workspace -->
        <div class="skeleton-details-workspace" *ngIf="isLoadingDetails()">
          <div class="banner-skeleton skeleton-shimmer"></div>
          <div class="grid-skeleton">
            <div class="skeleton-shimmer" style="height: 120px; border-radius: 0.75rem;"></div>
            <div class="skeleton-shimmer" style="height: 120px; border-radius: 0.75rem;"></div>
          </div>
          <div class="table-skeleton skeleton-shimmer" style="margin-top: 1.5rem;"></div>
        </div>

        <ng-container *ngIf="!isLoadingDetails()">
          <div *ngIf="selectedVisit() as v; else selectPlaceholder" class="clinical-details">
            
            <!-- Demographics Strip -->
            <div class="demographics-card modern-glass-panel">
              <div class="patient-avatar-large" 
                   [style.background]="deptCode() === 'LAB' ? 'linear-gradient(135deg, #0d9488, #0f766e)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)'">
                {{ v.patient.surname.slice(0, 1) }}{{ v.patient.firstName.slice(0, 1) }}
              </div>
              
              <div class="patient-info-content">
                <h3>{{ v.patient.surname }}, {{ v.patient.firstName }} {{ v.patient.middleName || '' }}</h3>
                <div class="modern-meta-tags">
                  <span class="tag tag-code">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Code: <strong class="monospaced-code">{{ v.patient.patientCode }}</strong>
                  </span>
                  
                  <span class="tag tag-gender" [class.male]="v.patient.sex?.toLowerCase() === 'male' || v.patient.sex?.toLowerCase() === 'm'" [class.female]="v.patient.sex?.toLowerCase() === 'female' || v.patient.sex?.toLowerCase() === 'f'">
                    <svg *ngIf="v.patient.sex?.toLowerCase() === 'male' || v.patient.sex?.toLowerCase() === 'm'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="14" r="6"></circle><path d="M18 6l-6 6M14 6h4v4"></path></svg>
                    <svg *ngIf="v.patient.sex?.toLowerCase() === 'female' || v.patient.sex?.toLowerCase() === 'f'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"></circle><path d="M12 14v8M9 18h6"></path></svg>
                    <span>{{ v.patient.sex }}</span>
                  </span>
                  
                  <span class="tag tag-age">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {{ v.patient.age }} Yrs
                  </span>
                  
                  <span class="tag tag-referral" *ngIf="v.patient.referralCenter">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    Ref: {{ v.patient.referralCenter }}
                  </span>
                </div>
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
                
                <div class="consent-switch-container mb-2" (click)="consentApproved.set(!consentApproved())">
                  <div class="switch-toggle" [class.switch-active]="consentApproved()">
                    <div class="switch-handle"></div>
                  </div>
                  <span class="switch-label">Patient has approved and consented to billing</span>
                </div>

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
              <p style="color: var(--slate-500); font-size: 0.8rem; margin-bottom: 0.5rem;">Prescribe medications or follow-up pharmacy treatments below.</p>
              
              <div class="notepad-paper-container">
                <textarea
                  placeholder="e.g. Amoxicillin 500mg - 3 times daily for 5 days. Paracetamol 500mg - PRN for pain."
                  [ngModel]="prescriptionText()"
                  (ngModelChange)="prescriptionText.set($event)"
                  class="clinical-notepad"
                ></textarea>
              </div>
              <div class="notepad-quick-tags">
                <span class="quick-tag-badge" (click)="insertNotepadText('Amoxicillin 500mg - 3x daily for 5 days')">+ Amox</span>
                <span class="quick-tag-badge" (click)="insertNotepadText('Paracetamol 500mg - PRN for pain')">+ Para</span>
                <span class="quick-tag-badge" (click)="insertNotepadText('1x Daily')">+ 1x</span>
                <span class="quick-tag-badge" (click)="insertNotepadText('2x Daily')">+ 2x</span>
                <span class="quick-tag-badge" (click)="insertNotepadText('3x Daily')">+ 3x</span>
                <span class="quick-tag-badge" (click)="insertNotepadText('PRN')">+ PRN</span>
              </div>
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
      </ng-container>
        
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

      <!-- Success / Post-Finalize Print Dialog Modal -->
      <div class="modal-backdrop" *ngIf="showPostFinalize() && finalizedVisit() as fv" (click)="closePostFinalize()">
        <div class="modal-card" (click)="$event.stopPropagation()" style="max-width: 480px; text-align: center; padding: 2.5rem 2rem; border-radius: 1.25rem;">
          <div style="color: #10b981; margin-bottom: 1.25rem; display: flex; justify-content: center; transform: scale(1.1);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 64px; height: 64px;">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--slate-800); margin: 0 0 0.5rem 0; letter-spacing: -0.5px;">Workspace Finalized!</h3>
          <p style="font-size: 0.875rem; color: var(--slate-500); margin: 0 0 2rem 0; line-height: 1.5;">
            Clinical results for <strong>{{ fv.patient.surname }}, {{ fv.patient.firstName }}</strong> have been successfully finalized and routed to the billing desk.
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%;">
            <button class="btn btn-primary" (click)="printFinalizedReport(fv)" style="font-weight: 700; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.95rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>Print Diagnostic Report</span>
            </button>
            
            <button class="btn btn-secondary" (click)="closePostFinalize()" style="font-weight: 700; width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.95rem;">
              Close & Go Back to Queue
            </button>
          </div>
        </div>
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
  private readonly session = inject(SessionService);

  readonly deptCode = signal<'LAB' | 'SCAN'>('LAB');
  readonly visits = signal<any[]>([]);
  readonly searchQuery = signal('');
  readonly filteredVisits = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.visits();
    if (!query) return list;
    return list.filter(v => 
      v.patient?.surname?.toLowerCase().includes(query) ||
      v.patient?.firstName?.toLowerCase().includes(query) ||
      v.patient?.patientCode?.toLowerCase().includes(query)
    );
  });
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

  // Success dialog and printable cache
  readonly showPostFinalize = signal(false);
  readonly finalizedVisit = signal<any | null>(null);
  readonly finalizedServiceLines = signal<ServiceLine[]>([]);
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

  readonly deptName = computed(() => this.deptCode() === 'LAB' ? 'Laboratory' : 'Scanning');
  readonly deptColor = computed(() => this.deptCode() === 'LAB' ? '#0d9488' : '#3b82f6');

  // Preloading state indicators
  readonly isLoadingQueue = signal(false);
  readonly isLoadingDetails = signal(false);
  private loadedTemplatesCount = 0;

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
    this.loadSettings();
  }

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: (res) => {
        if (res) this.settings.set(res);
      },
      error: (err) => console.error('Error fetching settings', err)
    });
  }

  insertNotepadText(text: string): void {
    const current = this.prescriptionText() || '';
    const addition = text.trim();
    if (current) {
      this.prescriptionText.set(current + '\n' + addition);
    } else {
      this.prescriptionText.set(addition);
    }
  }

  loadQueue(): void {
    this.isLoadingQueue.set(true);
    this.api.getActiveVisits(this.deptCode()).subscribe({
      next: (res) => {
        // Exclude completely finalized visits that are paid or fully completed
        this.visits.set(res.filter(v => v.status === 'registered' || v.status === 'sent_to_department' || v.status === 'in_progress'));
        this.isLoadingQueue.set(false);
      },
      error: (err) => {
        console.error('Error loading request queue', err);
        this.isLoadingQueue.set(false);
      }
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

  private checkDetailsLoadingProgress(totalLinesCount: number): void {
    this.loadedTemplatesCount++;
    if (this.loadedTemplatesCount >= totalLinesCount) {
      this.isLoadingDetails.set(false);
    }
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.prescriptionText.set('');
    this.serviceLines.set([]);
    this.isLoadingDetails.set(true);
    this.loadedTemplatesCount = 0;
    
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
            this.checkDetailsLoadingProgress(lines.length);
          },
          error: (err) => {
            console.error('Error loading dynamic template', err);
            this.checkDetailsLoadingProgress(lines.length);
          }
        });

        return line;
      });

    this.serviceLines.set(lines);
    if (lines.length === 0) {
      this.isLoadingDetails.set(false);
    }
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
          this.toast.success('Procedure workspace saved and routed successfully.');
          
          this.finalizedVisit.set(v);
          this.finalizedServiceLines.set(this.serviceLines());
          this.showPostFinalize.set(true);

          this.selectedVisit.set(null);
          this.serviceLines.set([]);
          this.loadQueue();
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

  closePostFinalize(): void {
    this.showPostFinalize.set(false);
    this.finalizedVisit.set(null);
    this.finalizedServiceLines.set([]);
    this.prescriptionText.set('');
  }

  printFinalizedReport(v: any): void {
    const s = this.settings();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const lines = this.finalizedServiceLines();
    let servicesHtml = '';
    lines.forEach(line => {
      if (line.status === 'done') {
        let rowsHtml = '';
        if (line.template && line.template.columns && line.template.columns.length > 0) {
          let headers = `<th class="text-left">Parameter</th>`;
          line.template.columns.forEach((c: any) => {
            headers += `<th style="text-align:${c.alignment}">${c.label}</th>`;
          });
          
          let tableBody = '';
          line.template.sections?.forEach((sec: any) => {
            tableBody += `
              <tr class="a4-sec-header">
                <td colspan="${line.template.columns.length + 1}">${sec.name}</td>
              </tr>
            `;
            const sectionRows = line.template.rows.filter((r: any) => r.sectionId === sec.id);
            sectionRows.forEach((row: any) => {
              const abnormalClass = line.resultValues[row.id]?.isAbnormal ? 'class="abnormal"' : '';
              let colsHtml = `<td class="row-label">${row.label}</td>`;
              line.template.columns.forEach((col: any) => {
                const val = line.resultValues[row.id]?.[col.key] || '';
                const unit = col.refUnit ? `&nbsp;${col.refUnit}` : '';
                colsHtml += `<td><span class="cell-val">${val}</span><span class="cell-unit">${unit}</span></td>`;
              });
              tableBody += `<tr ${abnormalClass}>${colsHtml}</tr>`;
            });
          });

          const generalRows = line.template.rows?.filter((r: any) => !r.sectionId || r.sectionId === '');
          if (generalRows && generalRows.length > 0) {
            if (line.template.sections?.length > 0) {
              tableBody += `
                <tr class="a4-sec-header">
                  <td colspan="${line.template.columns.length + 1}">General parameters</td>
                </tr>
              `;
            }
            generalRows.forEach((row: any) => {
              const abnormalClass = line.resultValues[row.id]?.isAbnormal ? 'class="abnormal"' : '';
              let colsHtml = `<td class="row-label">${row.label}</td>`;
              line.template.columns.forEach((col: any) => {
                const val = line.resultValues[row.id]?.[col.key] || '';
                const unit = col.refUnit ? `&nbsp;${col.refUnit}` : '';
                colsHtml += `<td><span class="cell-val">${val}</span><span class="cell-unit">${unit}</span></td>`;
              });
              tableBody += `<tr ${abnormalClass}>${colsHtml}</tr>`;
            });
          }

          rowsHtml = `
            <table class="a4-result-table">
              <thead><tr>${headers}</tr></thead>
              <tbody>${tableBody}</tbody>
            </table>
          `;
        } else {
          rowsHtml = `
            <div class="a4-narrative-box">
              <p>${line.narrativeText || 'Remarks: Diagnostic procedure completed with normal clinical findings.'}</p>
            </div>
          `;
        }

        servicesHtml += `
          <div class="a4-service-entry">
            <h4 class="a4-service-title">${line.serviceName}</h4>
            ${rowsHtml}
          </div>
        `;
      } else if (line.status === 'not_done') {
        servicesHtml += `
          <div class="a4-service-entry cancelled">
            <h4 class="a4-service-title">${line.serviceName}</h4>
            <p class="a4-cancelled-reason">Procedure Cancelled. Reason: <strong>"${line.notDoneReason || 'Not stated'}"</strong></p>
          </div>
        `;
      }
    });

    const rxText = this.prescriptionText().trim();
    const rxHtml = rxText ? `
      <div class="a4-prescription-section">
        <h4 class="a4-section-hdr">Issued Prescriptions (Medication Guidelines)</h4>
        <div class="a4-rx-notepad">
          <p>${rxText}</p>
        </div>
      </div>
    ` : '';

    const todayStr = getInternetDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    doc.write(`
      <html>
        <head>
          <title>Clinical Outcomes Report - ${s.clinicName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #000; background: #fff; line-height: 1.5; font-size: 13px; }
            h2, h3, h4 { margin: 0 0 5px 0; font-weight: 800; color: #000; }
            span { font-size: 11px; color: #000; }
            .a4-letterhead { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 12px; width: 100%; }
            .letterhead-brand-block { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 8px; }
            .letterhead-brand-block img { max-height: 48px; max-width: 150px; object-fit: contain; margin-right: 0.75rem; }
            .letterhead-brand-block svg { width: 32px; height: 32px; stroke: #000; fill: none; flex-shrink: 0; }
            .brand-text-block { display: flex; flex-direction: column; justify-content: center; }
            .brand-text-block h2 { font-size: 18px; letter-spacing: 0.5px; color: #000; margin: 0; line-height: 1.2; }
            .brand-text-block span { font-size: 10px; color: #000; font-weight: 700; text-transform: uppercase; margin-top: 2px; line-height: 1.2; }
            .letterhead-contacts-row { display: flex; gap: 20px; font-size: 11px; color: #000; width: 100%; flex-wrap: wrap; margin-top: 6px; }
            .a4-patient-grid { display: flex; justify-content: space-between; margin: 15px 0; font-size: 12px; color: #000; }
            .meta-col strong { color: #000; }
            .text-right { text-align: right; }
            .divider-single { border: solid #000 1px; margin: 10px 0; }
            .a4-service-entry { margin-bottom: 25px; page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            .a4-service-title { font-size: 12px; color: #000; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
            .a4-result-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
            .a4-result-table th { border: 1px solid #000; padding: 6px 8px; background-color: #f1f5f9; font-weight: 700; text-align: left; color: #000; }
            .a4-result-table td { border: 1px solid #000; padding: 5px 8px; color: #000; }
            .a4-sec-header td { font-weight: 700; background-color: #f8fafc; font-family: 'Helvetica Neue', Arial; font-size: 11px; text-transform: uppercase; color: #000; }
            .row-label { font-weight: 600; font-family: 'Helvetica Neue', Arial; color: #000; }
            .abnormal { background-color: #fef2f2 !important; color: #dc2626 !important; }
            .abnormal .cell-val { font-weight: 700; }
            .a4-narrative-box { border: 1px solid #000; border-radius: 4px; padding: 10px; background-color: #f8fafc; font-style: italic; color: #000; }
            .a4-cancelled-reason { color: #ef4444; font-size: 11px; margin: 5px 0 0 0; }
            .a4-prescription-section { margin-top: 30px; border: 1.5px dashed #000; border-radius: 4px; padding: 12px; page-break-inside: avoid; }
            .a4-section-hdr { font-size: 11px; text-transform: uppercase; margin: 0 0 8px 0; color: #000; }
            .a4-rx-notepad { font-family: 'Courier New', monospace; white-space: pre-line; font-size: 12px; color: #000; }
            .a4-footer-signature { display: flex; justify-content: flex-end; margin-top: 60px; page-break-inside: avoid; color: #000; }
            .sig-col { width: 250px; text-align: right; }
            .sig-line { width: 100%; border-bottom: 1.5px solid #000; margin-bottom: 6px; height: 75px; }
            .sig-sub { font-size: 10px; color: #000; }
            @media print {
              body { margin: 20mm; padding: 0; }
              @page { size: A4 portrait; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="a4-letterhead">
            <div class="letterhead-brand-block">
              ${s.logo ? `<img src="${s.logo}" alt="Clinic Logo" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`}
              <div class="brand-text-block">
                <h2>${s.clinicName}</h2>
                <span>${s.tagline}</span>
              </div>
            </div>
            <div class="letterhead-contacts-row">
              <span>Phone: <strong>${s.phone}</strong></span>
              <span>Email: <strong>${s.labEmail}</strong></span>
              <span>Location: <strong>${s.location}</strong></span>
            </div>
          </div>

          <div class="a4-patient-grid">
            <div class="meta-col">
              <span>Patient Name: <strong>${v.patient.surname}, ${v.patient.firstName}</strong></span><br>
              <span>Patient Code: <strong>${v.patient.patientCode}</strong></span><br>
              <span>Age / Sex: <strong>${v.patient.age} Years / ${v.patient.sex}</strong></span>
            </div>
            <div class="meta-col text-right">
              <span>Visit Code: <strong>VIS-${v.id.slice(-6).toUpperCase()}</strong></span><br>
              <span>Date Processed: <strong>${todayStr}</strong></span><br>
              <span>Assigned Dept: <strong>${this.deptName()} Room</strong></span>
            </div>
          </div>

          <hr class="divider-single" />

          <div class="a4-results-container">
            ${servicesHtml}
          </div>

          ${rxHtml}

          <div class="a4-footer-signature">
            <div class="sig-col">
              <div class="sig-line"></div>
              <strong>${this.session.currentUser()?.name || ''}</strong><br>
              <span>${this.deptCode() === 'SCAN' ? 'Medical Diagnostic Sonographer (MDS)' : 'Medical Lab Scientist'}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 200);
  }
}
