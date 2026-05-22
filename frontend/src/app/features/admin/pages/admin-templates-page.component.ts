import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AppDropdownComponent } from '../../../shared/ui/app-dropdown/app-dropdown.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

interface ColumnConfig {
  key: string;
  label: string;
  dataType: string;
  width: number;
  isRequired: boolean;
  isReadonly: boolean;
  defaultValue: string;
  refUnit: string;
  validationRules: string;
  formula: string;
  alignment: 'left' | 'center' | 'right';
}

interface SectionConfig {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

interface RowConfig {
  id: string;
  label: string;
  sectionId: string;
  sortOrder: number;
  defaultValues: Record<string, string>;
}

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
  selector: 'app-admin-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AppDropdownComponent, DragDropModule],
  template: `
    <div class="admin-workspace">
      
      <!-- Top Action Navigation Header with Selector Dropdown -->
      <div style="background: #fff; border: 1px solid var(--slate-300); border-radius: 0.5rem; padding: 0.65rem 1.15rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; width: 100%;">
          
          <!-- Dropdown Selector -->
          <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 290px; max-width: 540px;">
            <label style="font-weight: 800; font-size: 0.8rem; color: var(--slate-500); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;">
              Worksheet Template:
            </label>
            <div style="position: relative; flex: 1; display: flex; align-items: center;">
              <app-dropdown
                [items]="dropdownItems()"
                [value]="selectedServiceId()"
                (valueChange)="onServiceSelect($event)"
                placeholder="-- Select Clinical Service --"
                [loading]="loadingList()"
                [serverSearch]="services().length >= 20"
                (onSearch)="onDropdownSearch($event)"
                style="width: 100%;">
              </app-dropdown>
            </div>
          </div>
          
          <!-- Top level quick action buttons -->
          <div class="d-flex gap-2" *ngIf="selectedServiceId()">
            <button class="btn btn-secondary btn-sm" (click)="clearSelection()" title="Clear Selection">
              Close
            </button>
            
            <!-- Operations "..." Menu -->
            <div class="ops-menu-container">
              <button class="btn btn-secondary btn-sm" (click)="showOpsMenu.set(!showOpsMenu())">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
              </button>
              <div class="ops-dropdown-menu" *ngIf="showOpsMenu()">
                <button class="ops-menu-item" (click)="showPrintPreview.set(true); showOpsMenu.set(false)">
                  <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  Preview Report
                </button>
                <div class="ops-menu-divider"></div>
                <button class="ops-menu-item" (click)="exportSchema(); showOpsMenu.set(false)">
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export JSON Schema
                </button>
                <button class="ops-menu-item" (click)="showImportDialog.set(true); showOpsMenu.set(false)">
                  <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Import JSON Schema
                </button>
                <div class="ops-menu-divider"></div>
                <button class="ops-menu-item danger" (click)="clearTemplate(); showOpsMenu.set(false)">
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Reset Template
                </button>
              </div>
            </div>
            
            <button 
              class="btn btn-success btn-sm" 
              [disabled]="isSavingTemplate() || columns().length === 0" 
              (click)="saveTemplate()">
              <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span *ngIf="!isSavingTemplate()">Save Template</span>
              <span *ngIf="isSavingTemplate()">Saving...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Ops menu backdrop -->
      <div class="popover-backdrop" *ngIf="showOpsMenu()" (click)="showOpsMenu.set(false)"></div>

      <!-- Autosave Banner / Draft Recovery -->
      <div *ngIf="selectedServiceId() && availableDraftTimestamp()" style="background-color: var(--teal-50); border: 1px solid var(--teal-200); padding: 0.5rem 1rem; border-radius: 0.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; stroke: var(--teal-500); stroke-width: 2.5; fill: none;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--teal-700);">
              Unsaved draft from {{ availableDraftTimestamp() | date:'mediumTime' }} available.
            </span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-primary btn-sm" (click)="recoverDraft()">Recover</button>
            <button class="btn btn-secondary btn-sm" (click)="clearDraft()">Discard</button>
          </div>
        </div>
      </div>

      <!-- WYSIWYG Table Builder -->
      <ng-container *ngIf="selectedServiceId(); else selectServicePlaceholder">
        
        <div *ngIf="!loadingDetails(); else loadingDetailsSkeleton">
          
          <!-- Action Bar -->
          <div class="wysiwyg-action-bar">
            <button class="btn btn-primary btn-sm" (click)="addColumn()">
              <svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Column
            </button>
            <button class="btn btn-secondary btn-sm" (click)="addSection()">
              <svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Section
            </button>
            <button class="btn btn-secondary btn-sm" (click)="addRow()">
              <svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Row
            </button>
            
            <div style="margin-left: auto; display: flex; align-items: center; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" [disabled]="undoStack().length <= 1" (click)="undo()" title="Undo">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              </button>
              <button class="btn btn-secondary btn-sm" [disabled]="redoStack().length === 0" (click)="redo()" title="Redo">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </button>
              <span style="font-size: 0.7rem; color: var(--slate-400); margin-left: 0.25rem;">
                {{ columns().length }} cols, {{ sortedDisplayRows().length }} rows
              </span>
            </div>
          </div>

          <!-- The WYSIWYG Table -->
          <table class="wysiwyg-table" *ngIf="columns().length > 0; else emptyTablePlaceholder">
            
            <!-- Column Headers -->
            <thead>
              <tr>
                <th class="th-grip"></th>
                <th style="font-weight: 800; min-width: 160px;">Test Name</th>
                <th *ngFor="let col of columns(); let ci = index" style="position: relative;">
                  <div class="th-content">
                    <span class="th-label">{{ col.label }}</span>
                    <span class="th-gear" (click)="toggleColPopover(ci, $event)" title="Column settings">
                      <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </span>
                  </div>
                </th>
                <th class="th-actions"></th>
              </tr>
            </thead>

            <!-- Table Body — sections and rows interleaved -->
            <tbody cdkDropList (cdkDropListDropped)="onTableRowDrop($event)" [cdkDropListData]="sortedDisplayRows()">
              <ng-container *ngFor="let displayRow of sortedDisplayRows(); let ri = index">
                
                <!-- Section Divider Row -->
                <tr *ngIf="displayRow.type === 'section'" class="wysiwyg-section-row" cdkDrag [cdkDragData]="displayRow">
                  <td [attr.colspan]="columns().length + 3">
                    <div class="section-content">
                      <div class="section-left">
                        <div class="section-drag-handle" cdkDragHandle>
                          <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.5;"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                        </div>
                        <input 
                          type="text" 
                          [(ngModel)]="displayRow.section!.name" 
                          (ngModelChange)="autoGenSecCode(displayRow.section!); onSchemaChange()"
                          class="cell-inline-input" 
                          style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-800); background: transparent;" 
                          placeholder="Section Name..." />
                      </div>
                      <div class="d-flex gap-2 align-items-center">
                        <button class="row-delete-btn" title="Move up" (click)="moveSectionUp(displayRow.section!.id)">
                          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                        <button class="row-delete-btn" title="Move down" (click)="moveSectionDown(displayRow.section!.id)">
                          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <button class="row-delete-btn" (click)="removeSectionById(displayRow.section!.id)" title="Delete section">
                          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    </div>
                  </td>
                  <!-- CDK drag preview for section rows -->
                  <div *cdkDragPreview style="background: #e2e8f0; border: 2px solid var(--teal-500); padding: 0.5rem 1rem; border-radius: 0.25rem; font-weight: 800; font-size: 0.775rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-800);">
                    {{ displayRow.section!.name }}
                  </div>
                </tr>

                <!-- Data Row (test parameter) -->
                <tr *ngIf="displayRow.type === 'row'" class="wysiwyg-data-row" cdkDrag [cdkDragData]="displayRow">
                  <!-- Grip Handle -->
                  <td class="row-grip-cell" cdkDragHandle>
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.5;"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                  </td>
                  
                  <!-- Test Name Cell -->
                  <td class="cell-test-name">
                    <input 
                      type="text" 
                      [(ngModel)]="displayRow.row!.label" 
                      (ngModelChange)="onSchemaChange()"
                      class="cell-inline-input" 
                      style="font-weight: 650;"
                      placeholder="Test name..." />
                  </td>
                  
                  <!-- Default Value Cells for each column -->
                  <td *ngFor="let col of columns()" class="cell-default">
                    <ng-container *ngIf="col.dataType !== 'checkbox'; else checkboxCell">
                      <input 
                        type="text" 
                        [ngModel]="displayRow.row!.defaultValues[col.key] || ''" 
                        (ngModelChange)="setCellDefault(displayRow.row!, col.key, $event)"
                        class="cell-inline-input" 
                        [placeholder]="col.refUnit ? col.refUnit : 'default...'" 
                        style="font-style: italic; color: var(--slate-500);" />
                    </ng-container>
                    <ng-template #checkboxCell>
                      <input 
                        type="checkbox" 
                        [checked]="displayRow.row!.defaultValues[col.key] === 'true'" 
                        (change)="setCellDefault(displayRow.row!, col.key, $any($event.target).checked ? 'true' : 'false')"
                        style="width: 16px; height: 16px;" />
                    </ng-template>
                  </td>
                  
                  <!-- Delete Button -->
                  <td class="row-actions-cell">
                    <button class="row-delete-btn" (click)="removeRowById(displayRow.row!.id)" title="Delete row">
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </td>
                  <!-- CDK drag preview for data rows -->
                  <div *cdkDragPreview style="background: #ffffff; border: 2px solid var(--teal-500); padding: 0.5rem 1rem; border-radius: 0.25rem; font-weight: 650; font-size: 0.825rem; color: var(--slate-800);">
                    {{ displayRow.row!.label || 'Untitled row' }}
                  </div>
                </tr>

              </ng-container>
            </tbody>
          </table>

          <!-- Table Footer -->
          <div class="wysiwyg-table-footer" *ngIf="columns().length > 0">
            <button class="btn btn-secondary btn-sm" (click)="addRow()" style="border-style: dashed;">
              <svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Test Row
            </button>
            <span style="font-size: 0.7rem; color: var(--slate-400); margin-left: auto;">
              Drag rows to reorder. Click column headers to configure.
            </span>
          </div>

          <!-- Empty Table Placeholder -->
          <ng-template #emptyTablePlaceholder>
            <div class="select-placeholder" style="padding: 3rem 1.5rem; border: 1px solid var(--slate-200); border-top: none; border-radius: 0 0 0.5rem 0.5rem; background-color: #ffffff;">
              <h3>Start Building Your Report Table</h3>
              <p>Click "Add Column" above to create the first column of your diagnostic worksheet. Then add test rows for each clinical parameter.</p>
            </div>
          </ng-template>
          
          <!-- Footer Save Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.35rem; padding: 0.35rem 0;">
            <span style="font-size: 0.725rem; font-weight: 700; color: var(--slate-500);">
              Draft: {{ undoStack().length }} history steps
            </span>
            <button class="btn btn-success btn-sm" (click)="saveTemplate()" [disabled]="isSavingTemplate() || columns().length === 0">
              <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
              Save Template
            </button>
          </div>
        </div>

      </ng-container>

      <!-- No Service Selected Placeholder -->
      <ng-template #selectServicePlaceholder>
        <div style="background: #fff; border: 1px solid var(--slate-300); border-radius: 0.5rem; min-height: 360px;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--slate-400); padding: 4rem 1.5rem; flex: 1;">
            <div style="background-color: var(--slate-50); border: 1.5px solid var(--slate-200); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
              <svg viewBox="0 0 24 24" style="width: 2.25rem; height: 2.25rem; color: var(--slate-300); stroke: currentColor; fill: none; stroke-width: 2;"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
            <h3 style="color: var(--slate-700); margin: 0 0 0.5rem; font-size: 1.05rem; font-weight: 800;">
              No Workspace Active
            </h3>
            <p style="font-size: 0.85rem; max-width: 320px; line-height: 1.5; margin: 0;">
              Select a clinical service from the dropdown above to design its result report template.
            </p>
          </div>
        </div>
      </ng-template>

      <!-- Loading Skeleton -->
      <ng-template #loadingDetailsSkeleton>
        <div style="background: #fff; border: 1px solid var(--slate-300); border-radius: 0.5rem; min-height: 280px;">
          <div style="padding: 3rem; display: flex; align-items: center; justify-content: center;">
            <div style="text-align: center; color: var(--slate-400); width: 100%;">
              <div class="skeleton-shimmer" style="width: 140px; height: 24px; margin: 0 auto 1.5rem; border-radius: 4px; background: var(--slate-100);"></div>
              <div class="skeleton-shimmer" style="width: 80%; height: 60px; margin: 0 auto 1rem; border-radius: 6px; background: var(--slate-100);"></div>
              <div class="skeleton-shimmer" style="width: 90%; height: 60px; margin: 0 auto; border-radius: 6px; background: var(--slate-100);"></div>
            </div>
          </div>
        </div>
      </ng-template>

      <!-- Popover backdrop + floating popover for column settings -->
      <ng-container *ngIf="activeColPopover() !== null">
        <div class="popover-backdrop" (click)="closeColPopover()"></div>
        <div class="col-settings-popover" [style.top.px]="popoverPos().top" [style.left.px]="popoverPos().left" (click)="$event.stopPropagation()">
          <ng-container *ngIf="columns()[activeColPopover()!] as col">
            <div class="popover-row">
              <label>Column Name</label>
              <input type="text" [(ngModel)]="col.label" (ngModelChange)="autoGenColKey(col); onSchemaChange()" class="form-control form-control-sm" placeholder="e.g. Result" />
            </div>
            <div class="popover-row">
              <label>Field Type</label>
              <select [(ngModel)]="col.dataType" (change)="onColTypeChange(col)" class="form-control form-control-sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="decimal">Decimal</option>
                <option value="select">Choices (Dropdown)</option>
                <option value="readonly">Read-Only Label</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            <div class="popover-row" *ngIf="col.dataType === 'select'">
              <label>Choices (comma-separated)</label>
              <input type="text" [(ngModel)]="col.validationRules" (ngModelChange)="onSchemaChange()" class="form-control form-control-sm" placeholder="e.g. Normal, High, Low" />
            </div>
            <div class="popover-row">
              <label>Unit</label>
              <input type="text" [(ngModel)]="col.refUnit" (ngModelChange)="onSchemaChange()" class="form-control form-control-sm" placeholder="e.g. mg/dL" />
            </div>
            <div class="popover-row">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; text-transform: none;">
                <input type="checkbox" [(ngModel)]="col.isRequired" (ngModelChange)="onSchemaChange()" style="width: 14px; height: 14px;" />
                Required field
              </label>
            </div>
            <div class="popover-actions">
              <button class="btn btn-danger btn-sm" (click)="removeColumnByIndex(activeColPopover()!); closeColPopover()" style="font-size: 0.7rem;">
                Delete Column
              </button>
            </div>
          </ng-container>
        </div>
      </ng-container>

      <!-- Print Preview Modal Overlay -->
      <div class="print-preview-overlay" *ngIf="showPrintPreview()">
        <div class="print-preview-header">
          <h3>Report Preview</h3>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-sm" (click)="triggerPhysicalPrint()" style="background-color: #ffffff; color: var(--slate-700); border-color: var(--slate-300);">
              <svg viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print
            </button>
            <button class="btn btn-secondary btn-sm" (click)="showPrintPreview.set(false)" style="background-color: transparent; color: #ffffff; border-color: rgba(255,255,255,0.3);">
              Close
            </button>
          </div>
        </div>
        <div class="print-preview-body">
          <div class="a4-printable-report" id="a4PrintReport">
            <div class="clinical-watermark">CLINICAL COPY</div>
            <div class="report-letterhead">
              <div class="clinic-logo-box">
                <svg viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" stroke="currentColor" fill="none" stroke-width="2.25"></path></svg>
              </div>
              <div class="clinic-info-box">
                <h2>METROPOLITAN RADIOGRAPHY CLINIC &amp; LABORATORY</h2>
                <p>12 High Street, Accra, Ghana | Tel: +233 (0) 302-123456</p>
              </div>
            </div>
            <div class="patient-info-strip">
              <div class="info-item"><strong>Patient ID:</strong> <span>PAT-10492</span></div>
              <div class="info-item"><strong>Visit No:</strong> <span>LAB-2026-9043</span></div>
              <div class="info-item"><strong>Full Name:</strong> <span>Mensah, Kingsley Kwame</span></div>
              <div class="info-item"><strong>Age / Sex:</strong> <span>42 Yrs / Male</span></div>
              <div class="info-item"><strong>Date Recv:</strong> <span>May 22, 2026</span></div>
              <div class="info-item"><strong>Referrer:</strong> <span>Dr. Sophia Bako, MD</span></div>
            </div>
            <div class="report-title-label">
              {{ selectedService()?.name || 'Diagnostic Laboratory Report' }}
            </div>
            <table class="clinical-print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
              <thead>
                <tr>
                  <th style="border: 1px solid #0f172a; padding: 0.5rem; background-color: #f1f5f9; font-weight: 800; font-size: 0.725rem;">Test Parameter</th>
                  <th *ngFor="let col of columns()" style="border: 1px solid #0f172a; padding: 0.5rem; background-color: #f1f5f9; font-weight: 800; font-size: 0.725rem;">
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <ng-container *ngFor="let displayRow of sortedDisplayRows()">
                  <tr *ngIf="displayRow.type === 'section'" class="section-header-row">
                    <td [attr.colspan]="columns().length + 1" style="border: 1px solid #0f172a; padding: 0.55rem 0.75rem; background-color: #e2e8f0; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">
                      {{ displayRow.section!.name }}
                    </td>
                  </tr>
                  <tr *ngIf="displayRow.type === 'row'">
                    <td style="border: 1px solid #0f172a; padding: 0.5rem 0.75rem; font-weight: 650; font-size: 0.8rem;">
                      {{ displayRow.row!.label }}
                    </td>
                    <td *ngFor="let col of columns()" style="border: 1px solid #0f172a; padding: 0.5rem 0.75rem; font-size: 0.8rem;">
                      {{ displayRow.row!.defaultValues[col.key] || '' }}
                      <span style="font-size: 0.65rem; color: #94a3b8; margin-left: 0.15rem;" *ngIf="col.refUnit && displayRow.row!.defaultValues[col.key]">
                        {{ col.refUnit }}
                      </span>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
            <div class="print-signatures-footer" style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 2rem;">
              <div class="sig-box" style="width: 260px; text-align: center;">
                <p style="font-family: 'Courier New', Courier, monospace; font-size: 0.85rem; margin-bottom: 0.2rem; font-style: italic; color: #94a3b8;">Verified Electronic Signature</p>
                <div class="sig-line" style="border-top: 1.5px solid #0f172a; margin-bottom: 0.4rem;"></div>
                <p class="sig-name" style="font-weight: 750; font-size: 0.8rem; margin: 0; color: #0f172a;">Dr. Sophia Bako, PhD (Pathology)</p>
                <p class="sig-title" style="font-size: 0.7rem; color: #475569; margin: 0.1rem 0 0; font-weight: 500;">Laboratory Medical Director</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Import JSON Dialog -->
      <div class="modal-backdrop" *ngIf="showImportDialog()">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-card-header">
            <h3>Import JSON Schema</h3>
            <button class="modal-close-btn" (click)="showImportDialog.set(false)">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Paste JSON Schema</label>
              <textarea #jsonImportInput rows="8" class="form-control form-control-sm" style="font-family: monospace; font-size: 0.75rem;" placeholder='{"columns": [...], "sections": [...], "rows": [...]}'></textarea>
            </div>
            <button class="btn btn-primary btn-sm btn-block" (click)="importJsonSchema(jsonImportInput.value); showImportDialog.set(false)">
              Import Schema
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styleUrl: './admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTemplatesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Selector Signals
  readonly services = signal<ServiceItem[]>([]);
  readonly serviceTemplatesMap = signal<Record<string, boolean>>({});
  readonly loadingList = signal(false);

  readonly dropdownItems = computed(() => {
    const list = this.services();
    const map = this.serviceTemplatesMap();
    return list.map(s => ({
      id: s.id,
      name: `${s.name} (${s.department.name}) — ${map[s.id] ? 'Configured' : 'Narrative Only'}`
    }));
  });

  // Active Builder Signals
  readonly selectedServiceId = signal<string | null>(null);
  readonly selectedService = signal<ServiceItem | null>(null);
  
  // Dynamic JSON Schema Elements
  readonly columns = signal<ColumnConfig[]>([]);
  readonly sections = signal<SectionConfig[]>([]);
  readonly rows = signal<RowConfig[]>([]);

  // UI State
  readonly activeColPopover = signal<number | null>(null);
  readonly popoverPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });
  readonly showOpsMenu = signal(false);
  readonly showPrintPreview = signal(false);
  readonly showImportDialog = signal(false);

  // Local Storage Draft Signals
  readonly availableDraftTimestamp = signal<number | null>(null);
  readonly availableDraftPayload = signal<any | null>(null);

  // Undo / Redo
  readonly undoStack = signal<string[]>([]);
  readonly redoStack = signal<string[]>([]);

  readonly isSavingTemplate = signal(false);
  readonly loadingDetails = signal(false);

  // Schema Serialization for Export
  readonly exportJsonSchema = computed(() => {
    const data = {
      columns: this.columns(),
      sections: this.sections(),
      rows: this.rows()
    };
    return JSON.stringify(data, null, 2);
  });

  // Compute the interleaved display list: sections and their rows in order
  readonly sortedDisplayRows = computed(() => {
    const secs = this.sections();
    const allRows = this.rows();
    const display: { type: 'section' | 'row'; section?: SectionConfig; row?: RowConfig }[] = [];

    // First: rows grouped by sections in section order
    const sortedSecs = [...secs].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const sec of sortedSecs) {
      display.push({ type: 'section', section: sec });
      const sectionRows = allRows
        .filter(r => r.sectionId === sec.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      for (const row of sectionRows) {
        display.push({ type: 'row', row });
      }
    }

    // Then: unassigned rows (no section)
    const unassigned = allRows
      .filter(r => !r.sectionId || r.sectionId === '')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const row of unassigned) {
      display.push({ type: 'row', row });
    }

    return display;
  });

  ngOnInit(): void {
    this.loadDropdownList();

    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.selectedServiceId.set(id);
        this.loadServiceDetails(id);
        this.loadServiceTemplate(id);
      } else {
        this.selectedServiceId.set(null);
        this.selectedService.set(null);
        this.columns.set([]);
        this.sections.set([]);
        this.rows.set([]);
        this.undoStack.set([]);
        this.redoStack.set([]);
        this.availableDraftTimestamp.set(null);
        this.availableDraftPayload.set(null);
      }
    });
  }

  loadDropdownList(): void {
    this.loadingList.set(true);
    this.api.getServices().subscribe({
      next: (res) => {
        this.loadingList.set(false);
        let list: ServiceItem[] = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && res.data) {
          list = res.data;
        }
        const map: Record<string, boolean> = {};
        list.forEach((s: any) => {
          map[s.id] = s.resultTemplates && s.resultTemplates.length > 0;
        });
        this.serviceTemplatesMap.set(map);
        this.services.set(list);

        const id = this.selectedServiceId();
        if (id) {
          const service = list.find((s: any) => s.id === id);
          if (service) {
            this.selectedService.set(service);
          }
        }
      },
      error: (err) => {
        this.loadingList.set(false);
        console.error('Error loading services', err);
      }
    });
  }

  loadServiceDetails(id: string): void {
    const list = this.services();
    if (list.length > 0) {
      const service = list.find((s: any) => s.id === id);
      if (service) {
        this.selectedService.set(service);
        return;
      }
    }
    this.loadingDetails.set(true);
    this.api.getServices().subscribe({
      next: (res) => {
        let fetchList: ServiceItem[] = [];
        if (Array.isArray(res)) {
          fetchList = res;
        } else if (res && res.data) {
          fetchList = res.data;
        }
        const service = fetchList.find((s: any) => s.id === id);
        if (service) {
          this.selectedService.set(service);
        }
        this.loadingDetails.set(false);
      },
      error: (err) => {
        console.error('Error loading service details', err);
        this.loadingDetails.set(false);
      }
    });
  }

  loadServiceTemplate(id: string): void {
    this.loadingDetails.set(true);
    this.api.getServiceTemplate(id).subscribe({
      next: (res) => {
        this.loadingDetails.set(false);
        let loaded = false;

        if (res && res.layoutJson) {
          try {
            const parsed = typeof res.layoutJson === 'string' ? JSON.parse(res.layoutJson) : res.layoutJson;
            if (parsed && (parsed.columns || parsed.sections || parsed.rows)) {
              this.columns.set(parsed.columns || []);
              this.sections.set(parsed.sections || []);
              this.rows.set(parsed.rows || []);
              loaded = true;
            }
          } catch (e) {
            console.error('Error parsing template layoutJson', e);
          }
        }

        if (!loaded) {
          // Starter template for first-time users
          this.columns.set([
            { key: 'result', label: 'Result', dataType: 'decimal', width: 140, alignment: 'right', isRequired: true, isReadonly: false, defaultValue: '', refUnit: '', validationRules: '', formula: '' },
            { key: 'unit', label: 'Unit', dataType: 'readonly', width: 90, alignment: 'left', isRequired: false, isReadonly: true, defaultValue: '', refUnit: '', validationRules: '', formula: '' },
            { key: 'referenceRange', label: 'Reference Range', dataType: 'readonly', width: 160, alignment: 'left', isRequired: false, isReadonly: true, defaultValue: '', refUnit: '', validationRules: '', formula: '' }
          ]);
          this.sections.set([
            { id: 'sec_default', code: 'default_panel', name: 'Panel', sortOrder: 1 }
          ]);
          this.rows.set([
            { id: 'row_1', label: 'Test 1', sectionId: 'sec_default', sortOrder: 1, defaultValues: {} }
          ]);
        }

        const initialState = JSON.stringify({
          columns: this.columns(),
          sections: this.sections(),
          rows: this.rows()
        });
        this.undoStack.set([initialState]);
        this.redoStack.set([]);
        this.checkDraftRecovery(id);
      },
      error: (err) => {
        this.loadingDetails.set(false);
        console.error('Error fetching template', err);
        this.columns.set([]);
        this.sections.set([]);
        this.rows.set([]);
      }
    });
  }

  // Schema change handler — push state + autosave
  onSchemaChange(): void {
    this.pushState();
    this.saveDraftToLocalStorage();
  }

  // Set a cell default value
  setCellDefault(row: RowConfig, colKey: string, value: string): void {
    row.defaultValues[colKey] = value;
    this.onSchemaChange();
  }

  // Column popover
  toggleColPopover(index: number, event: Event): void {
    event.stopPropagation();
    if (this.activeColPopover() === index) {
      this.activeColPopover.set(null);
      return;
    }
    // Calculate fixed position from the gear icon, clamped to viewport
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const popoverWidth = 260;
    let left = rect.left - 80;
    // Clamp right edge to viewport
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    left = Math.max(8, left);
    this.popoverPos.set({
      top: rect.bottom + 6,
      left
    });
    this.activeColPopover.set(index);
  }

  closeColPopover(): void {
    this.activeColPopover.set(null);
  }

  // Column CRUD
  addColumn(): void {
    const ts = Date.now();
    this.columns.update(list => [...list, {
      key: `col_${ts}`,
      label: 'New Column',
      dataType: 'text',
      width: 130,
      isRequired: false,
      isReadonly: false,
      defaultValue: '',
      refUnit: '',
      validationRules: '',
      formula: '',
      alignment: 'left'
    }]);
    this.onSchemaChange();
  }

  removeColumnByIndex(index: number): void {
    const colKey = this.columns()[index].key;
    this.columns.update(list => list.filter((_, i) => i !== index));
    this.rows.update(list => list.map(r => {
      const updated = { ...r.defaultValues };
      delete updated[colKey];
      return { ...r, defaultValues: updated };
    }));
    this.onSchemaChange();
  }

  autoGenColKey(col: ColumnConfig): void {
    col.key = col.label
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  onColTypeChange(col: ColumnConfig): void {
    if (col.dataType === 'readonly') {
      col.isReadonly = true;
    }
    if (col.dataType === 'number' || col.dataType === 'decimal') {
      col.alignment = 'right';
    } else {
      col.alignment = 'left';
    }
    this.onSchemaChange();
  }

  // Section CRUD
  addSection(): void {
    const ts = Date.now();
    const list = this.sections();
    const sort = list.length > 0 ? Math.max(...list.map(s => s.sortOrder)) + 1 : 1;
    this.sections.update(list => [...list, {
      id: `sec_${ts}`,
      code: `section_${ts}`,
      name: 'New Section',
      sortOrder: sort
    }]);
    this.onSchemaChange();
  }

  removeSectionById(secId: string): void {
    this.sections.update(list => list.filter(s => s.id !== secId));
    // Unassign rows from removed section
    this.rows.update(list => list.map(r => r.sectionId === secId ? { ...r, sectionId: '' } : r));
    this.onSchemaChange();
  }

  moveSectionUp(secId: string): void {
    const secs = [...this.sections()].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = secs.findIndex(s => s.id === secId);
    if (idx <= 0) return;
    // Swap sortOrders
    const tempSort = secs[idx].sortOrder;
    secs[idx].sortOrder = secs[idx - 1].sortOrder;
    secs[idx - 1].sortOrder = tempSort;
    this.sections.set(secs);
    this.onSchemaChange();
  }

  moveSectionDown(secId: string): void {
    const secs = [...this.sections()].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = secs.findIndex(s => s.id === secId);
    if (idx < 0 || idx >= secs.length - 1) return;
    // Swap sortOrders
    const tempSort = secs[idx].sortOrder;
    secs[idx].sortOrder = secs[idx + 1].sortOrder;
    secs[idx + 1].sortOrder = tempSort;
    this.sections.set(secs);
    this.onSchemaChange();
  }

  autoGenSecCode(sec: SectionConfig): void {
    sec.code = sec.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  // Row CRUD
  addRow(): void {
    const ts = Date.now();
    const allRows = this.rows();
    const sort = allRows.length > 0 ? Math.max(...allRows.map(r => r.sortOrder)) + 1 : 1;
    
    // Auto-assign to the last section if sections exist
    const secs = this.sections();
    const lastSection = secs.length > 0 ? secs[secs.length - 1] : null;

    this.rows.update(list => [...list, {
      id: `row_${ts}`,
      label: '',
      sectionId: lastSection ? lastSection.id : '',
      sortOrder: sort,
      defaultValues: {}
    }]);
    this.onSchemaChange();
  }

  removeRowById(rowId: string): void {
    this.rows.update(list => list.filter(r => r.id !== rowId));
    this.onSchemaChange();
  }

  // Drag and drop handler for table rows (sections and data rows interleaved)
  onTableRowDrop(event: CdkDragDrop<any>): void {
    const display = [...this.sortedDisplayRows()];
    const draggedItem = display[event.previousIndex];
    const targetItem = display[event.currentIndex];

    if (draggedItem.type === 'row' && draggedItem.row) {
      // Reorder rows — determine new section assignment based on drop position
      const allRows = [...this.rows()];
      const draggedRow = draggedItem.row;
      
      // Find which section the target position is under
      let newSectionId = '';
      for (let i = event.currentIndex; i >= 0; i--) {
        if (display[i]?.type === 'section' && display[i].section) {
          newSectionId = display[i].section!.id;
          break;
        }
      }
      
      // Update section assignment
      const rowIndex = allRows.findIndex(r => r.id === draggedRow.id);
      if (rowIndex > -1) {
        allRows[rowIndex] = { ...allRows[rowIndex], sectionId: newSectionId };
      }
      
      // Recalculate sort orders based on new visual positions
      const newDisplay = [...display];
      moveItemInArray(newDisplay, event.previousIndex, event.currentIndex);
      
      let sortCounter = 0;
      newDisplay.forEach(item => {
        if (item.type === 'row' && item.row) {
          sortCounter++;
          const rIdx = allRows.findIndex(r => r.id === item.row!.id);
          if (rIdx > -1) {
            allRows[rIdx] = { ...allRows[rIdx], sortOrder: sortCounter };
          }
        }
      });
      
      this.rows.set(allRows);
    } else if (draggedItem.type === 'section' && draggedItem.section) {
      // Reorder sections
      const allSecs = [...this.sections()];
      const draggedSecId = draggedItem.section.id;
      const draggedSecIdx = allSecs.findIndex(s => s.id === draggedSecId);
      
      // Determine new position among sections
      let targetSecIdx = draggedSecIdx;
      if (targetItem?.type === 'section' && targetItem.section) {
        targetSecIdx = allSecs.findIndex(s => s.id === targetItem.section!.id);
      }
      
      if (draggedSecIdx > -1 && targetSecIdx > -1) {
        moveItemInArray(allSecs, draggedSecIdx, targetSecIdx);
        allSecs.forEach((sec, idx) => sec.sortOrder = idx + 1);
        this.sections.set(allSecs);
      }
    }
    
    this.pushState();
    this.saveDraftToLocalStorage();
  }

  // Undo / Redo Engine
  pushState(): void {
    const stateStr = JSON.stringify({
      columns: this.columns(),
      sections: this.sections(),
      rows: this.rows()
    });
    const stack = this.undoStack();
    if (stack.length === 0 || stack[stack.length - 1] !== stateStr) {
      this.undoStack.update(u => [...u, stateStr]);
      this.redoStack.set([]);
    }
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length <= 1) return;
    const current = stack[stack.length - 1];
    const previous = stack[stack.length - 2];
    this.undoStack.update(u => u.slice(0, -1));
    this.redoStack.update(r => [...r, current]);
    this.applyStateString(previous);
  }

  redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;
    const nextState = stack[stack.length - 1];
    this.redoStack.update(r => r.slice(0, -1));
    this.undoStack.update(u => [...u, nextState]);
    this.applyStateString(nextState);
  }

  applyStateString(stateStr: string): void {
    try {
      const parsed = JSON.parse(stateStr);
      this.columns.set(parsed.columns || []);
      this.sections.set(parsed.sections || []);
      this.rows.set(parsed.rows || []);
      this.saveDraftToLocalStorage();
    } catch (e) {
      console.error(e);
    }
  }

  // LocalStorage draft hooks
  saveDraftToLocalStorage(): void {
    const sId = this.selectedServiceId();
    if (!sId) return;
    const draft = {
      columns: this.columns(),
      sections: this.sections(),
      rows: this.rows(),
      timestamp: Date.now()
    };
    localStorage.setItem(`pharma_draft_${sId}`, JSON.stringify(draft));
  }

  checkDraftRecovery(sId: string): void {
    const raw = localStorage.getItem(`pharma_draft_${sId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.availableDraftTimestamp.set(parsed.timestamp);
          this.availableDraftPayload.set(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      this.availableDraftTimestamp.set(null);
      this.availableDraftPayload.set(null);
    }
  }

  recoverDraft(): void {
    const draft = this.availableDraftPayload();
    if (draft) {
      this.columns.set(draft.columns || []);
      this.sections.set(draft.sections || []);
      this.rows.set(draft.rows || []);
      this.pushState();
      this.availableDraftTimestamp.set(null);
      this.availableDraftPayload.set(null);
      alert('Draft recovered successfully.');
    }
  }

  clearDraft(): void {
    const sId = this.selectedServiceId();
    if (sId) {
      localStorage.removeItem(`pharma_draft_${sId}`);
    }
    this.availableDraftTimestamp.set(null);
    this.availableDraftPayload.set(null);
  }

  // Import / Export
  importJsonSchema(jsonStr: string): void {
    if (!jsonStr.trim()) return;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.columns || parsed.sections || parsed.rows) {
        this.columns.set(parsed.columns || []);
        this.sections.set(parsed.sections || []);
        this.rows.set(parsed.rows || []);
        this.onSchemaChange();
        alert('Schema imported successfully.');
      } else {
        alert('Invalid JSON format. Missing columns/sections/rows.');
      }
    } catch (e) {
      alert('Failed to parse JSON. Check formatting.');
    }
  }

  exportSchema(): void {
    const json = this.exportJsonSchema();
    navigator.clipboard.writeText(json).then(() => {
      alert('JSON schema copied to clipboard.');
    }).catch(err => {
      console.error('Copy failed: ', err);
      alert('Failed to copy. Please copy manually from the browser console.');
    });
  }

  // Save template to backend
  saveTemplate(): void {
    const sId = this.selectedServiceId();
    if (!sId) return;

    this.isSavingTemplate.set(true);
    const layoutPayload = {
      layoutJson: JSON.stringify({
        columns: this.columns(),
        sections: this.sections(),
        rows: this.rows()
      })
    };

    this.api.saveServiceTemplate(sId, layoutPayload).subscribe({
      next: () => {
        alert('Template saved successfully.');
        this.isSavingTemplate.set(false);
        this.loadDropdownList();
        this.clearDraft();
      },
      error: (err) => {
        console.error(err);
        this.isSavingTemplate.set(false);
        alert('Failed to save template.');
      }
    });
  }

  clearTemplate(): void {
    if (confirm('Reset this template? All columns, sections and rows will be deleted.')) {
      const sId = this.selectedServiceId();
      if (!sId) return;

      this.isSavingTemplate.set(true);
      const layoutPayload = {
        layoutJson: JSON.stringify({ columns: [], sections: [], rows: [] })
      };

      this.api.saveServiceTemplate(sId, layoutPayload).subscribe({
        next: () => {
          alert('Template reset to Narrative Only.');
          this.isSavingTemplate.set(false);
          this.columns.set([]);
          this.sections.set([]);
          this.rows.set([]);
          this.loadDropdownList();
          this.clearDraft();
        },
        error: (err) => {
          console.error(err);
          this.isSavingTemplate.set(false);
          alert('Failed to reset template.');
        }
      });
    }
  }

  // Navigation
  onServiceSelect(id: string): void {
    if (id) {
      this.router.navigate([], { queryParams: { id } });
    } else {
      this.clearSelection();
    }
  }

  onDropdownSearch(query: string): void {
    this.loadingList.set(true);
    this.api.getServices(undefined, undefined, query).subscribe({
      next: (res) => {
        this.loadingList.set(false);
        let list: ServiceItem[] = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && res.data) {
          list = res.data;
        }
        this.services.set(list);
      },
      error: (err) => {
        this.loadingList.set(false);
        console.error('Error searching services', err);
      }
    });
  }

  clearSelection(): void {
    this.router.navigate([], { queryParams: { id: null } });
  }

  triggerPhysicalPrint(): void {
    window.print();
  }
}
