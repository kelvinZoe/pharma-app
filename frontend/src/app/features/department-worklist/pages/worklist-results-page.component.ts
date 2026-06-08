import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface ServiceHistoryLine {
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
  selector: 'app-worklist-results-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  template: `
    <!-- Clinical History Page Header -->
    <div class="modern-page-header">
      <div class="header-content">
        <h2>{{ deptName() }} History & Archives</h2>
        <p>Review past patient visits, audit clinical result sheets, and print diagnostic reports.</p>
      </div>
      <div class="header-decoration">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
    </div>

    <!-- Clinical Workspace (Full Width) -->
    <div class="clinical-workspace" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
      <div class="panel full-width">
        <div class="table-header-filters">
          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <h2>Dossier Ledger</h2>
            
            <!-- Segmented Control Button Toggle Group -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.8rem; font-weight: 700; height: 32px; align-items: center;">
              <button 
                type="button"
                [style.background]="activeTab() === 'today' ? '#ffffff' : 'transparent'"
                [style.color]="activeTab() === 'today' ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="activeTab() === 'today' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="setTab('today')"
              >
                Visits Today
              </button>
              <button 
                type="button"
                [style.background]="activeTab() === 'search' ? '#ffffff' : 'transparent'"
                [style.color]="activeTab() === 'search' ? 'var(--app-primary-color)' : 'var(--app-muted-text-color)'"
                [style.boxShadow]="activeTab() === 'search' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'"
                style="border: none; padding: 0 0.8rem; height: 26px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; font-weight: 700; font-size: 0.78rem;"
                (click)="setTab('search')"
              >
                Patient Lookup
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <!-- Search bar inside the header when search tab is active -->
            <div class="filter-search-group" *ngIf="activeTab() === 'search'" style="position: relative; width: 240px; margin-bottom: 0;">
              <input
                type="text"
                placeholder="Type name or code..."
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                class="search-input-control"
                style="padding-top: 0.35rem; padding-bottom: 0.35rem; font-size: 0.8rem; border-radius: 0.375rem;"
              />
              <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; left: 0.65rem;">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            <button class="btn btn-secondary btn-sm" (click)="refreshActiveQueue()" style="display: inline-flex; align-items: center; gap: 0.25rem;">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        <p class="section-desc" style="margin-bottom: 1.25rem;">
          {{ activeTab() === 'today' ? 'Recent patient check-ins currently in procedure or completed today. Select a patient to inspect their results.' : 'Lookup historical clients and retrieve their lifelong clinical dossiers.' }}
        </p>

        <!-- Table displaying Ledger Today -->
        <div class="frontdesk-table-card" *ngIf="activeTab() === 'today'">
          <div class="frontdesk-table-responsive">
            <table class="frontdesk-premium-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Sex/Age</th>
                  <th>Check-in Time</th>
                  <th>Requested Procedures</th>
                  <th>Status</th>
                  <th style="width: 180px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Shimmer skeletons while loading today visits -->
                <ng-container *ngIf="isLoadingToday()">
                  <tr *ngFor="let dummy of [1, 2, 3, 4]">
                    <td><div class="skeleton-shimmer" style="height: 1.5rem; width: 80px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.2rem; width: 140px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 90px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 70px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 180px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.3rem; width: 80px; border-radius: 99px;"></div></td>
                    <td style="text-align: right;"><div class="skeleton-shimmer" style="height: 1.8rem; width: 100px; border-radius: 0.5rem; margin-left: auto;"></div></td>
                  </tr>
                </ng-container>

                <ng-container *ngIf="!isLoadingToday()">
                  <tr *ngFor="let v of todayVisits()" (click)="selectVisitAndOpen(v)">
                    <td>
                      <code class="tag code" style="font-weight: 700; font-family: monospace;">
                        {{ v.patient.patientCode }}
                      </code>
                    </td>
                    <td><strong style="color: var(--slate-800); font-weight: 600;">{{ v.patient.surname }}, {{ v.patient.firstName }}</strong></td>
                    <td>{{ v.patient.sex | uppercase }} • {{ v.patient.age }} Yrs</td>
                    <td>{{ v.createdAt | date:'shortTime' }}</td>
                    <td>
                      <div style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;" [title]="getVisitDeptServicesLabel(v)">
                        {{ getVisitDeptServicesLabel(v) }}
                      </div>
                    </td>
                    <td>
                      <span class="status-pill" [class]="v.status">{{ getStatusLabel(v.status) }}</span>
                    </td>
                    <td style="text-align: right;" (click)="$event.stopPropagation()">
                      <button class="btn btn-secondary btn-sm" (click)="selectVisitAndOpen(v)" style="font-weight: 700;">
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="todayVisits().length === 0">
                    <td colspan="7" style="text-align: center; padding: 4rem 2rem; color: var(--slate-400);">
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--slate-300);">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 500;">No visits found for the {{ deptName() }} department today.</p>
                      </div>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Table displaying Patient Lookup Finder -->
        <div class="frontdesk-table-card" *ngIf="activeTab() === 'search'">
          <div class="frontdesk-table-responsive">
            <table class="frontdesk-premium-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Sex/Age</th>
                  <th>Phone Number</th>
                  <th>Emergency Contact</th>
                  <th style="width: 180px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Shimmer skeletons while searching patient lookup -->
                <ng-container *ngIf="loadingSearch()">
                  <tr *ngFor="let dummy of [1, 2, 3]">
                    <td><div class="skeleton-shimmer" style="height: 1.5rem; width: 80px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.2rem; width: 140px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 90px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 100px;"></div></td>
                    <td><div class="skeleton-shimmer" style="height: 1.1rem; width: 120px;"></div></td>
                    <td style="text-align: right;"><div class="skeleton-shimmer" style="height: 1.8rem; width: 100px; border-radius: 0.5rem; margin-left: auto;"></div></td>
                  </tr>
                </ng-container>

                <ng-container *ngIf="!loadingSearch()">
                  <tr *ngFor="let p of searchResults()" (click)="selectPatientAndOpen(p)">
                    <td>
                      <code class="tag code" style="font-weight: 700; font-family: monospace;">
                        {{ p.patientCode }}
                      </code>
                    </td>
                    <td><strong style="color: var(--slate-800); font-weight: 600;">{{ p.surname }}, {{ p.firstName }}</strong></td>
                    <td>{{ p.sex | uppercase }} • {{ p.age }} Yrs</td>
                    <td>{{ p.phone }}</td>
                    <td>{{ p.emergencyContactName || 'N/A' }}</td>
                    <td style="text-align: right;" (click)="$event.stopPropagation()">
                      <button class="btn btn-secondary btn-sm" (click)="selectPatientAndOpen(p)" style="font-weight: 700;">
                        Dossier Archives
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="searchResults().length === 0">
                    <td colspan="6" style="text-align: center; padding: 4rem 2rem; color: var(--slate-400);">
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--slate-300);">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 500;" *ngIf="searchQuery().length < 3">Enter at least 3 characters to search.</p>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 500;" *ngIf="searchQuery().length >= 3">No patients match your search.</p>
                      </div>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- Dossier Timeline & Completed Outcomes Overlay Modal -->
    <div class="modal-backdrop" *ngIf="selectedPatient() !== null" (click)="closeModal()">
      <div class="modal-card wide-modal" (click)="$event.stopPropagation()" style="max-width: 90vw; width: 1100px;">
        
        <div class="modal-card-header">
          <h3>Pathology & Radiology Dossier Archives</h3>
          <button class="modal-close-btn" (click)="closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body" style="padding: 1.25rem;" *ngIf="selectedPatient() as p">
          
          <!-- Demographics Card -->
          <div class="demographics-card modern-glass-panel" style="padding: 1rem !important; margin-bottom: 1.25rem;">
            <div class="patient-info-content">
              <h3>{{ p.surname }}, {{ p.firstName }} {{ p.middleName || '' }}</h3>
              <div class="modern-meta-tags">
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Code: <strong>{{ p.patientCode }}</strong></span>
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> {{ p.sex | uppercase }}</span>
                <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> {{ p.age }} Yrs</span>
              </div>
            </div>
          </div>

          <!-- Split layout inside modal -->
          <div class="actions-grid" style="grid-template-columns: 320px 1fr; gap: 1.25rem; align-items: stretch;">
            
            <!-- Left side: Dossier Visits Timeline list -->
            <div class="sub-panel history-section" style="max-height: 520px; display: flex; flex-direction: column;">
              <h4 class="timeline-title" style="margin-bottom: 0.75rem; font-size: 0.95rem; font-weight: 700;">Lifelong Dossier Visits</h4>
              <!-- Timeline Loading Shimmers -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem;" *ngIf="loadingHistory()">
                <div *ngFor="let dummy of [1, 2, 3]" style="display: flex; gap: 0.75rem; padding: 0.5rem; border: 1px solid var(--app-border-color); border-radius: 0.5rem;">
                  <div class="timeline-dot" style="background-color: var(--app-border-color); margin-top: 4px;"></div>
                  <div class="history-content" style="flex: 1; display: flex; flex-direction: column; gap: 0.35rem;">
                    <div class="skeleton-shimmer" style="width: 50%; height: 12px;"></div>
                    <div class="skeleton-shimmer" style="width: 80%; height: 10px;"></div>
                  </div>
                </div>
              </div>

              <div class="history-timeline" style="flex: 1; max-height: 440px;" *ngIf="!loadingHistory() && patientHistory().length > 0; else noTimeline">
                <div 
                  *ngFor="let h of patientHistory()" 
                  class="history-item"
                  style="cursor: pointer; padding: 0.5rem; border: 1px solid var(--slate-200); border-radius: 0.5rem; margin-bottom: 0.5rem; transition: all 0.2s;"
                  [class.active]="selectedVisit()?.id === h.id"
                  (click)="selectVisitFromHistory(h)"
                >
                  <div class="timeline-dot" [class.completed]="h.status === 'completed' || h.status === 'paid'"></div>
                  <div class="history-content" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.15rem;">
                      <span style="color: var(--teal-600);">VIS-{{ h.id.slice(-6).toUpperCase() }}</span>
                      <span style="color: var(--slate-400);">{{ h.createdAt | date:'mediumDate' }}</span>
                    </div>
                    <div style="font-size: 0.725rem; color: var(--slate-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ getVisitDeptServicesLabel(h) }}
                    </div>
                  </div>
                </div>
              </div>
              <ng-template #noTimeline>
                <div class="sub-empty" style="text-align: center; padding: 3rem 1rem; color: var(--slate-400); font-size: 0.85rem;" *ngIf="!loadingHistory()">
                  <p>No past visits belonging to {{ deptName() }} recorded.</p>
                </div>
              </ng-template>
            </div>

            <!-- Right side: Selected Visit Outcomes sheet -->
            <div class="sub-panel" style="max-height: 520px; display: flex; flex-direction: column; padding: 1rem;">
              <div *ngIf="selectedVisit() as v; else selectVisitPlaceholder" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid var(--slate-200); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                  <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700;">Diagnostic Outcomes Summary</h4>
                  <span class="status-pill" [class]="v.status" style="font-size: 0.65rem; padding: 0.15rem 0.45rem;">
                    {{ getStatusLabel(v.status) }}
                  </span>
                </div>

                <div style="flex: 1; overflow-y: auto; max-height: 380px; padding-right: 0.25rem;">
                  <!-- Loop Through Service Lines -->
                  <div *ngFor="let s of serviceLines()" class="visit-service-line done-only" style="margin-bottom: 1rem;">
                    
                    <!-- Service Summary Header -->
                    <div class="line-header" style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 0.5rem 0.75rem; border-radius: 0.35rem 0.35rem 0 0; display: flex; align-items: center; justify-content: space-between;">
                      <span class="service-name" style="font-size: 0.8rem; font-weight: 700; color: var(--slate-700);">{{ s.serviceName }}</span>
                      <span class="badge-status-outcome" [class.done]="s.status === 'done'" [class.not-done]="s.status === 'not_done'" style="font-size: 0.7rem; padding: 0.1rem 0.35rem;">
                        {{ s.status === 'done' ? '✓ DONE' : '✗ NOT DONE' }}
                      </span>
                    </div>

                    <!-- Structured Results View -->
                    <div *ngIf="s.status === 'done'" class="result-template-form" style="border: 1px solid var(--slate-200); border-top: none; border-radius: 0 0 0.35rem 0.35rem; padding: 0.75rem; background: #fff;">
                      
                      <!-- If Columns/Rows Form Template Layout Is Loaded -->
                      <div *ngIf="s.template; else noTemplateFallbacks">
                        <div *ngIf="s.template.columns && s.template.columns.length > 0; else narrativeOnly" style="overflow-x: auto; width: 100%;">
                          <table style="width: 100%; border-collapse: collapse; margin-top: 0.25rem; font-family: 'Courier New', Courier, monospace; font-size: 0.75rem;">
                            <thead>
                              <tr>
                                <th style="border: 1px solid var(--slate-300); padding: 0.35rem; background-color: var(--slate-100); font-weight: 800; text-align: left; color: var(--slate-600); min-width: 120px; font-family: 'Inter', sans-serif;">
                                  Parameter
                                </th>
                                <th *ngFor="let col of s.template.columns" style="border: 1px solid var(--slate-300); padding: 0.35rem; background-color: var(--slate-100); font-weight: 800; color: var(--slate-600); min-width: 80px; font-family: 'Inter', sans-serif;" [style.textAlign]="col.alignment">
                                  {{ col.label }}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <!-- Group by Sections -->
                              <ng-container *ngFor="let sec of s.template.sections">
                                <tr style="background-color: var(--slate-50);">
                                  <td [attr.colspan]="s.template.columns.length + 1" style="border: 1px solid var(--slate-300); padding: 0.3rem 0.45rem; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; color: var(--slate-700); font-family: 'Inter', sans-serif;">
                                    {{ sec.name }}
                                  </td>
                                </tr>
                                <tr *ngFor="let row of getRowsForSection(s, sec.id)" [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? '#fee2e2' : 'transparent'">
                                  <td style="border: 1px solid var(--slate-300); padding: 0.35rem 0.45rem; font-weight: 700; color: var(--slate-800); font-family: 'Inter', sans-serif;">
                                    {{ row.label }}
                                  </td>
                                  <td *ngFor="let col of s.template.columns" style="border: 1px solid var(--slate-300); padding: 0.25rem 0.35rem;" [style.textAlign]="col.alignment">
                                    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 0.2rem;">
                                      <span 
                                        [style.fontWeight]="'700'"
                                        [style.color]="s.resultValues[row.id]?.[col.key] === 'HIGH' || s.resultValues[row.id]?.[col.key] === 'ABNORMAL' || s.resultValues[row.id]?.[col.key] === 'LOW' || s.resultValues[row.id]?.isAbnormal ? '#dc2626' : '#1e293b'"
                                      >
                                        {{ s.resultValues[row.id]?.[col.key] }}
                                      </span>
                                      <span style="font-size: 0.6rem; color: var(--slate-400); font-family: 'Inter', sans-serif;" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">
                                        {{ col.refUnit }}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              </ng-container>

                              <!-- General parameters outside sections -->
                              <ng-container *ngIf="getRowsForSection(s, null).length > 0">
                                <tr style="background-color: var(--slate-100);" *ngIf="s.template.sections?.length > 0">
                                  <td [attr.colspan]="s.template.columns.length + 1" style="border: 1px solid var(--slate-300); padding: 0.3rem 0.45rem; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; color: var(--slate-700);">
                                    General Observations
                                  </td>
                                </tr>
                                <tr *ngFor="let row of getRowsForSection(s, null)" [style.backgroundColor]="s.resultValues[row.id]?.isAbnormal ? '#fee2e2' : 'transparent'">
                                  <td style="border: 1px solid var(--slate-300); padding: 0.35rem 0.45rem; font-weight: 700; color: var(--slate-800);">
                                    {{ row.label }}
                                  </td>
                                  <td *ngFor="let col of s.template.columns" style="border: 1px solid var(--slate-300); padding: 0.25rem 0.35rem;" [style.textAlign]="col.alignment">
                                    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 0.2rem;">
                                      <span 
                                        [style.fontWeight]="'700'"
                                        [style.color]="s.resultValues[row.id]?.[col.key] === 'HIGH' || s.resultValues[row.id]?.[col.key] === 'ABNORMAL' || s.resultValues[row.id]?.[col.key] === 'LOW' || s.resultValues[row.id]?.isAbnormal ? '#dc2626' : '#1e293b'"
                                      >
                                        {{ s.resultValues[row.id]?.[col.key] }}
                                      </span>
                                      <span style="font-size: 0.6rem; color: var(--slate-400); font-family: 'Inter', sans-serif;" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">
                                        {{ col.refUnit }}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              </ng-container>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <ng-template #noTemplateFallbacks>
                        <div class="narrative-findings" style="font-size: 0.8rem;">
                          <h5 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">Procedure Findings</h5>
                          <p style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 0.5rem; border-radius: 0.25rem; font-style: italic;">
                            {{ s.narrativeText || 'Remarks: Diagnostic procedure completed with normal clinical findings.' }}
                          </p>
                        </div>
                      </ng-template>

                      <ng-template #narrativeOnly>
                        <div class="narrative-findings" style="font-size: 0.8rem;">
                          <h5 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">Procedure Findings</h5>
                          <p style="background: var(--slate-50); border: 1px solid var(--slate-200); padding: 0.5rem; border-radius: 0.25rem; font-style: italic;">
                            {{ s.narrativeText || 'Remarks: Diagnostic procedure completed with normal clinical findings.' }}
                          </p>
                        </div>
                      </ng-template>
                    </div>

                    <!-- Cancelled procedure summary -->
                    <div *ngIf="s.status === 'not_done'" class="result-template-form" style="border: 1px solid var(--slate-200); border-top: none; border-radius: 0 0 0.35rem 0.35rem; padding: 0.75rem; background: var(--slate-50); font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.1rem;">⚠️</span>
                      <div>
                        <strong style="color: var(--slate-700);">Procedure Cancelled</strong>
                        <div style="font-size: 0.725rem; color: var(--slate-500);">Reason: "{{ s.notDoneReason || 'Not stated' }}"</div>
                      </div>
                    </div>
                  </div>

                  <!-- Prescription notepad -->
                  <div class="prescription-history-notepad" *ngIf="hasPrescription()" style="border: 1px dashed var(--slate-300); padding: 0.75rem; border-radius: 0.5rem; background: #fff; margin-top: 0.5rem;">
                    <div class="notepad-header" style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; color: var(--slate-700); margin-bottom: 0.35rem;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                      <span>Prescriptions Hand-off Note</span>
                    </div>
                    <p style="font-size: 0.8rem; font-family: monospace; white-space: pre-line; background: var(--slate-50); padding: 0.5rem; border-radius: 0.25rem; margin: 0;">
                      {{ selectedVisit()?.prescriptions?.[0]?.medicationNotes || selectedVisit()?.prescriptionNotes }}
                    </p>
                  </div>
                </div>

                <!-- Print Diagnostic Outcomes Report -->
                <div style="border-top: 1px solid var(--slate-200); padding-top: 0.75rem; margin-top: 0.5rem;">
                  <button class="btn btn-primary" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700; padding: 0.65rem 1rem;" (click)="triggerBrowserPrint()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    <span>Print Diagnostic Report Sheet</span>
                  </button>
                </div>

              </div>
              
              <ng-template #selectVisitPlaceholder>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; color: var(--slate-400); padding: 4rem 1rem;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--slate-300); margin-bottom: 0.75rem;">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <strong style="font-size: 0.95rem; color: var(--slate-600); margin-bottom: 0.25rem;">No Visit Selected</strong>
                  <p style="font-size: 0.8rem; max-width: 260px; margin: 0; line-height: 1.4;">Select a historical visit from the patient history timeline on the left to inspect outcomes and print reports.</p>
                </div>
              </ng-template>
            </div>

          </div>

        </div>

      </div>
    </div>

    <!-- Hidden Print Container -->
    <div style="display: none;" *ngIf="selectedVisit()">
      <!-- Simulated A4 Clinical Page -->
      <div class="clinical-a4-sheet" id="print-sheet-content">
        <!-- Letterhead Banner -->
        <div class="a4-letterhead" *ngIf="settings() as s">
          <div class="letterhead-brand-block">
            <img *ngIf="s.logo" [src]="s.logo" alt="Clinic Logo" class="clinic-logo-img" style="max-height: 48px; max-width: 150px; object-fit: contain; margin-right: 0.75rem;" />
            <svg *ngIf="!s.logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <div class="brand-text-block">
              <h2>{{ s.clinicName }}</h2>
              <span>{{ s.tagline }}</span>
            </div>
          </div>
          <div class="letterhead-contacts-row">
            <span>Phone: <strong>{{ s.phone }}</strong></span>
            <span>Email: <strong>{{ s.labEmail }}</strong></span>
            <span>Location: <strong>{{ s.location }}</strong></span>
          </div>
        </div>

        <!-- Report Metadata strip -->
        <div class="a4-patient-grid" *ngIf="selectedVisit() as v">
          <div class="meta-col">
            <span>Patient Name: <strong>{{ v.patient.surname }}, {{ v.patient.firstName }}</strong></span><br>
            <span>Patient Code: <strong>{{ v.patient.patientCode }}</strong></span><br>
            <span>Age / Sex: <strong>{{ v.patient.age }} Years / {{ v.patient.sex }}</strong></span>
          </div>
          <div class="meta-col text-right">
            <span>Visit Code: <strong>VIS-{{ v.id.slice(-6).toUpperCase() }}</strong></span><br>
            <span>Date Processed: <strong>{{ v.createdAt | date:'mediumDate' }}</strong></span><br>
            <span>Assigned Dept: <strong>{{ deptName() }} Room</strong></span>
          </div>
        </div>

        <hr class="divider-single" />

        <!-- Clinical results table -->
        <div class="a4-results-container">
          <div *ngFor="let s of serviceLines()" class="a4-service-wrapper">
            <div *ngIf="s.status === 'done'" class="a4-service-entry">
              <h4 class="a4-service-title">{{ s.serviceName }}</h4>
              
              <table *ngIf="s.template && s.template.columns && s.template.columns.length > 0; else a4Narrative" class="a4-result-table">
                <thead>
                  <tr>
                    <th class="text-left">Parameter</th>
                    <th *ngFor="let col of s.template.columns" [style.textAlign]="col.alignment">{{ col.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let sec of s.template.sections">
                    <tr class="a4-sec-header">
                      <td [attr.colspan]="s.template.columns.length + 1">{{ sec.name }}</td>
                    </tr>
                    <tr *ngFor="let row of getRowsForSection(s, sec.id)" [class.abnormal]="s.resultValues[row.id]?.isAbnormal">
                      <td class="row-label">{{ row.label }}</td>
                      <td *ngFor="let col of s.template.columns" [style.textAlign]="col.alignment">
                        <span class="cell-val">{{ s.resultValues[row.id]?.[col.key] }}</span>
                        <span class="cell-unit" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">&nbsp;{{ col.refUnit }}</span>
                      </td>
                    </tr>
                  </ng-container>
                  <ng-container *ngIf="getRowsForSection(s, null).length > 0">
                    <tr class="a4-sec-header" *ngIf="s.template.sections?.length > 0">
                      <td [attr.colspan]="s.template.columns.length + 1">General parameters</td>
                    </tr>
                    <tr *ngFor="let row of getRowsForSection(s, null)" [class.abnormal]="s.resultValues[row.id]?.isAbnormal">
                      <td class="row-label">{{ row.label }}</td>
                      <td *ngFor="let col of s.template.columns" [style.textAlign]="col.alignment">
                        <span class="cell-val">{{ s.resultValues[row.id]?.[col.key] }}</span>
                        <span class="cell-unit" *ngIf="col.refUnit && s.resultValues[row.id]?.[col.key]">&nbsp;{{ col.refUnit }}</span>
                      </td>
                    </tr>
                  </ng-container>
                </tbody>
              </table>

              <ng-template #a4Narrative>
                <div class="a4-narrative-box">
                  <p>{{ s.narrativeText || 'Remarks: Diagnostic procedure completed with normal clinical findings.' }}</p>
                </div>
              </ng-template>
            </div>

            <!-- Cancelled services -->
            <div *ngIf="s.status === 'not_done'" class="a4-service-entry cancelled">
              <h4 class="a4-service-title">{{ s.serviceName }}</h4>
              <p class="a4-cancelled-reason">Procedure Cancelled. Reason: <strong>"{{ s.notDoneReason || 'Not stated' }}"</strong></p>
            </div>
          </div>
        </div>

        <!-- Prescriptions pad in report -->
        <div class="a4-prescription-section" *ngIf="hasPrescription()">
          <h4 class="a4-section-hdr">Issued Prescriptions (Medication Guidelines)</h4>
          <div class="a4-rx-notepad">
            <p>{{ selectedVisit()?.prescriptions?.[0]?.medicationNotes || selectedVisit()?.prescriptionNotes }}</p>
          </div>
        </div>

        <!-- Signature block -->
        <div class="a4-footer-signature">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span>{{ deptCode() === 'SCAN' ? 'Medical Diagnostic Sonographer (MDS)' : 'Medical Lab Scientist' }}</span><br>
            <span class="sig-sub">Compiled Date: {{ today | date:'medium' }}</span>
          </div>
        </div>

      </div>
    </div>
  `,
  styleUrl: './department-worklist-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorklistResultsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

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

  readonly deptCode = signal<'LAB' | 'SCAN'>('LAB');
  
  // Segmented control tabs: 'today' | 'search'
  readonly activeTab = signal<'today' | 'search'>('today');

  // Ledger lists
  readonly todayVisits = signal<any[]>([]);
  readonly searchResults = signal<any[]>([]);
  readonly loadingSearch = signal(false);
  readonly isLoadingToday = signal(false);
  readonly searchQuery = signal('');

  // Timeline view dossier fields
  readonly selectedPatient = signal<any | null>(null);
  readonly patientHistory = signal<any[]>([]);
  readonly loadingHistory = signal(false);

  // Detailed clinical dossier fields
  readonly selectedVisit = signal<any | null>(null);
  readonly serviceLines = signal<ServiceHistoryLine[]>([]);

  // Print previews
  readonly today = new Date();

  readonly deptName = computed(() => this.deptCode() === 'LAB' ? 'Laboratory' : 'Scanning');

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('scanning')) {
      this.deptCode.set('SCAN');
    } else {
      this.deptCode.set('LAB');
    }

    this.loadTodayVisits();
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

  setTab(tab: 'today' | 'search'): void {
    this.activeTab.set(tab);
    // Reset selections on tab switch
    this.selectedVisit.set(null);
    this.selectedPatient.set(null);
    this.searchResults.set([]);
    this.searchQuery.set('');
    this.serviceLines.set([]);
    
    if (tab === 'today') {
      this.loadTodayVisits();
    }
  }

  loadTodayVisits(): void {
    this.isLoadingToday.set(true);
    this.api.getActiveVisits(this.deptCode(), true).subscribe({
      next: (res) => {
        this.todayVisits.set(res);
        this.isLoadingToday.set(false);
      },
      error: (err) => {
        console.error('Error loading history log queue', err);
        this.isLoadingToday.set(false);
      }
    });
  }

  refreshActiveQueue(): void {
    this.selectedVisit.set(null);
    this.selectedPatient.set(null);
    this.searchResults.set([]);
    this.searchQuery.set('');
    this.serviceLines.set([]);
    this.loadTodayVisits();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    if (!query || query.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }

    this.loadingSearch.set(true);
    this.api.searchPatients(query).subscribe({
      next: (res) => {
        this.searchResults.set(res);
        this.loadingSearch.set(false);
      },
      error: (err) => {
        console.error('Error searching patient ledger', err);
        this.loadingSearch.set(false);
      }
    });
  }

  selectPatient(p: any): void {
    this.selectedPatient.set(p);
    this.selectedVisit.set(null);
    this.serviceLines.set([]);
    this.patientHistory.set([]);
    this.loadingHistory.set(true);
 
    this.api.getPatientHistory(p.id).subscribe({
      next: (res) => {
        // Exclude visits that do not have any services belonging to our active department
        const filteredHistory = res.filter(v => {
          const svcs = v.services || v.visitServices || [];
          return svcs.some((s: any) => s.service?.department?.code === this.deptCode());
        });
        this.patientHistory.set(filteredHistory);
        this.loadingHistory.set(false);
      },
      error: (err) => {
        console.error('Error loading patient visit history', err);
        this.loadingHistory.set(false);
      }
    });
  }

  selectPatientAndOpen(p: any): void {
    this.selectPatient(p);
  }

  selectVisit(v: any): void {
    this.selectedVisit.set(v);
    this.serviceLines.set([]);

    // Map service lines for our department
    const rawServices = v.services || v.visitServices || [];
    const lines = rawServices
      .filter((s: any) => s.service.department.code === this.deptCode())
      .map((s: any) => {
        const line: ServiceHistoryLine = {
          id: s.id,
          serviceId: s.service.id,
          serviceName: s.service.name,
          status: s.status,
          notDoneReason: s.notDoneReason || '',
          narrativeText: s.results?.[0]?.narrativeNotes || s.narrativeNotes || '',
          resultValues: {}
        };

        // Parse result values from JSON
        const dbResultJson = s.results?.[0]?.resultDataJson || s.resultDataJson;
        if (dbResultJson) {
          try {
            line.resultValues = typeof dbResultJson === 'string' ? JSON.parse(dbResultJson) : dbResultJson;
          } catch (e) {
            console.error('Error parsing resultDataJson', e);
          }
        }

        // Pull template and trigger signal update
        this.loadLineTemplate(line);

        return line;
      });

    this.serviceLines.set(lines);
  }

  selectVisitAndOpen(v: any): void {
    this.selectedPatient.set(v.patient);
    this.selectedVisit.set(v);
    
    // Also load history list for completeness
    this.api.getPatientHistory(v.patient.id).subscribe({
      next: (res) => {
        const filteredHistory = res.filter(x => {
          const svcs = x.services || x.visitServices || [];
          return svcs.some((s: any) => s.service?.department?.code === this.deptCode());
        });
        this.patientHistory.set(filteredHistory);
      },
      error: (err) => console.error('Error loading patient history', err)
    });

    this.selectVisit(v);
  }

  selectVisitFromHistory(h: any): void {
    // Inject selected patient reference since getPatientHistory return nodes might lack deep nesting
    const patientObj = this.selectedPatient();
    const completeVisitObj = {
      ...h,
      patient: patientObj
    };
    this.selectVisit(completeVisitObj);
  }

  closeModal(): void {
    this.selectedPatient.set(null);
    this.selectedVisit.set(null);
    this.patientHistory.set([]);
    this.loadingHistory.set(false);
    this.searchResults.set([]);
    this.searchQuery.set('');
    this.serviceLines.set([]);
  }

  loadLineTemplate(line: ServiceHistoryLine): void {
    this.api.getServiceTemplate(line.serviceId).subscribe({
      next: (res) => {
        if (res && res.layoutJson) {
          try {
            const parsed = typeof res.layoutJson === 'string' ? JSON.parse(res.layoutJson) : res.layoutJson;
            if (parsed && (parsed.columns || parsed.rows)) {
              line.template = parsed;
              this.serviceLines.set([...this.serviceLines()]);
            }
          } catch (e) {
            console.error('Error parsing template layout JSON', e);
          }
        }
      }
    });
  }

  getVisitDeptServicesLabel(v: any): string {
    const rawServices = v.services || v.visitServices || [];
    return rawServices
      .filter((s: any) => s.service?.department?.code === this.deptCode())
      .map((s: any) => s.service?.name)
      .join(', ') || 'Department Consultation';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'registered': return 'Checked In';
      case 'sent_to_department': return 'In Queue';
      case 'in_progress': return 'In Procedure';
      case 'completed': return 'Finalized';
      case 'awaiting_payment': return 'Awaiting Invoice';
      case 'paid': return 'Paid & Closed';
      default: return (status || 'unknown').replace('_', ' ').toUpperCase();
    }
  }

  getRowsForSection(s: ServiceHistoryLine, secId: string | null): any[] {
    if (!s.template || !s.template.rows) return [];
    return s.template.rows.filter((r: any) => {
      return secId ? r.sectionId === secId : (!r.sectionId || r.sectionId === '');
    });
  }

  hasPrescription(): boolean {
    const v = this.selectedVisit();
    if (!v) return false;
    return !!(v.prescriptionNotes || (v.prescriptions && v.prescriptions.length > 0 && v.prescriptions[0].medicationNotes));
  }

  triggerBrowserPrint(): void {
    const printContent = document.getElementById('print-sheet-content');
    if (!printContent) return;

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
              body { padding: 15px; }
              @page { size: A4 portrait; margin: 20mm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
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
