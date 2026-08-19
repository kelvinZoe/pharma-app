import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-pharmacy-medicines-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="medicine-library">
      <header class="page-header">
        <div><span class="eyebrow">Clinical catalogue</span><h1>Medicine Library</h1><p>Define a medicine once, then create its brands, packages, and barcodes in Product Catalogue.</p></div>
        <button type="button" class="button primary" (click)="openCreate()">Add medicine definition</button>
      </header>

      <section class="summary-strip">
        <div><span>Medicine definitions</span><strong>{{ medicines().length }}</strong></div>
        <div><span>Active definitions</span><strong>{{ activeCount() }}</strong></div>
        <div><span>Commercial products</span><strong>{{ productCount() }}</strong></div>
      </section>

      <section class="library-panel">
        <header><label class="search"><span class="sr-only">Search medicines</span><input type="search" placeholder="Search generic name, strength, form, or class" (input)="search.set($any($event.target).value)" /></label><button type="button" class="button" (click)="load()">Refresh</button></header>
        @if (loading()) { <div class="state">Loading medicine definitions…</div> }
        @else if (loadError()) { <div class="state error"><strong>Medicine library could not be loaded</strong><p>{{ loadError() }}</p></div> }
        @else {
          <div class="medicine-grid">
            @for (medicine of filteredMedicines(); track medicine.id) {
              <article>
                <header><span class="form-token">{{ formAbbreviation(medicine.dosageForm) }}</span><span class="status" [class.inactive]="medicine.lifecycleStatus !== 'active'">{{ medicine.lifecycleStatus }}</span></header>
                <div class="identity"><h2>{{ medicine.genericName }}</h2><strong>{{ medicine.strengthDisplay }}</strong><p>{{ medicine.dosageForm }}{{ medicine.routeOfAdministration ? ' · ' + medicine.routeOfAdministration : '' }}</p></div>
                <dl><div><dt>Category</dt><dd>{{ medicine.prescriptionCategory }}</dd></div><div><dt>Class</dt><dd>{{ medicine.therapeuticClass || 'Not classified' }}</dd></div><div><dt>Products</dt><dd>{{ medicine.products?.length || 0 }}</dd></div></dl>
                <footer><button type="button" (click)="openEdit(medicine)">Edit definition</button></footer>
              </article>
            } @empty { <div class="state empty"><strong>No medicine definitions found</strong><p>Create the clinical identity before adding packaged products.</p></div> }
          </div>
        }
      </section>

      @if (formOpen()) {
        <div class="backdrop" (click)="closeForm()"></div>
        <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="medicine-form-title">
          <header><div><span class="eyebrow">{{ editingId() ? 'Update definition' : 'New definition' }}</span><h2 id="medicine-form-title">{{ editingId() ? 'Edit medicine' : 'Add medicine' }}</h2><p>Strength is structured so staff never need to type combinations such as 120mg/5mL manually.</p></div><button type="button" class="close" aria-label="Close" (click)="closeForm()">×</button></header>
          <form [formGroup]="medicineForm" (ngSubmit)="save()">
            <fieldset><legend>Basic information</legend><div class="form-grid">
              <label class="wide"><span>Generic name *</span><input formControlName="genericName" placeholder="Paracetamol" /></label>
              <label><span>Dosage form *</span><select formControlName="dosageForm"><option value="">Select form</option>@for(form of dosageForms;track form){<option [value]="form">{{form}}</option>}</select></label>
              <label><span>Supply category *</span><select formControlName="prescriptionCategory"><option value="OTC">OTC</option><option value="P">Pharmacy medicine</option><option value="POM">Prescription only</option></select></label>
            </div></fieldset>
            <fieldset><legend>Structured strength</legend><div class="strength-grid">
              <label><span>Strength *</span><input type="number" min="0.000001" step="any" formControlName="strengthValue" placeholder="500" /></label>
              <label><span>Unit *</span><select formControlName="strengthUnit"><option value="">Select unit</option>@for(unit of strengthUnits;track unit){<option [value]="unit">{{unit}}</option>}</select></label>
              <span class="per">per</span>
              <label><span>Quantity</span><input type="number" min="0.000001" step="any" formControlName="strengthPerValue" placeholder="1" /></label>
              <label><span>Dosage unit</span><select formControlName="strengthPerUnit"><option value="">Not applicable</option>@for(unit of perUnits;track unit){<option [value]="unit">{{unit}}</option>}</select></label>
            </div><div class="strength-preview"><span>Generated display</span><strong>{{ strengthPreview() }}</strong></div></fieldset>
            <fieldset><legend>Additional information</legend><div class="form-grid">
              <label><span>Administration route</span><select formControlName="routeOfAdministration"><option value="">Not specified</option>@for(route of routes;track route){<option [value]="route">{{route}}</option>}</select></label>
              <label><span>Therapeutic class</span><input formControlName="therapeuticClass" placeholder="Analgesic" /></label>
              <label><span>Lifecycle status</span><select formControlName="lifecycleStatus"><option value="active">Active</option><option value="archived">Archived</option><option value="discontinued">Discontinued</option></select></label>
              <label class="wide"><span>Description</span><textarea rows="3" formControlName="description" placeholder="Optional clinical or catalogue notes"></textarea></label>
            </div></fieldset>
            <footer><button type="button" class="button" (click)="closeForm()">Cancel</button><button type="submit" class="button primary" [disabled]="medicineForm.invalid || saving()">{{ saving() ? 'Saving…' : (editingId() ? 'Save definition' : 'Create definition') }}</button></footer>
          </form>
        </aside>
      }
    </main>
  `,
  styleUrl: './pharmacy-medicines-page.component.scss',
})
export class PharmacyMedicinesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);

  readonly dosageForms = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Suppository', 'Other'];
  readonly strengthUnits = ['mcg', 'mg', 'g', 'mL', 'IU', '%'];
  readonly perUnits = ['tablet', 'capsule', 'mL', 'dose', 'actuation', 'vial', 'ampoule', 'sachet', 'g'];
  readonly routes = ['Oral', 'Topical', 'Intravenous', 'Intramuscular', 'Subcutaneous', 'Inhalation', 'Ophthalmic', 'Otic', 'Rectal', 'Nasal', 'Other'];
  readonly medicines = signal<any[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly search = signal('');
  readonly formOpen = signal(false);
  readonly editingId = signal('');
  readonly saving = signal(false);
  readonly activeCount = computed(() => this.medicines().filter((medicine) => medicine.lifecycleStatus === 'active').length);
  readonly productCount = computed(() => this.medicines().reduce((sum, medicine) => sum + Number(medicine.products?.length ?? 0), 0));
  readonly filteredMedicines = computed(() => { const query = this.search().trim().toLowerCase(); return !query ? this.medicines() : this.medicines().filter((medicine) => [medicine.genericName, medicine.strengthDisplay, medicine.dosageForm, medicine.therapeuticClass].some((value) => String(value ?? '').toLowerCase().includes(query))); });
  readonly medicineForm = this.formBuilder.group({ genericName: ['', [Validators.required, Validators.minLength(2)]], dosageForm: ['', Validators.required], strengthValue: [null as number | null, [Validators.required, Validators.min(0.000001)]], strengthUnit: ['', Validators.required], strengthPerValue: [null as number | null, Validators.min(0.000001)], strengthPerUnit: [''], routeOfAdministration: [''], therapeuticClass: [''], prescriptionCategory: ['OTC', Validators.required], lifecycleStatus: ['active', Validators.required], description: [''] });

  ngOnInit(): void { this.load(); }
  load(): void { this.loading.set(true); this.loadError.set(''); this.api.getPharmacyMedicines().subscribe({ next: (medicines) => { this.medicines.set(medicines ?? []); this.loading.set(false); }, error: (error) => { this.loadError.set(error?.error?.message ?? 'Please check the active pharmacy and try again.'); this.loading.set(false); } }); }
  openCreate(): void { this.editingId.set(''); this.medicineForm.reset({ genericName: '', dosageForm: '', strengthValue: null, strengthUnit: '', strengthPerValue: null, strengthPerUnit: '', routeOfAdministration: '', therapeuticClass: '', prescriptionCategory: 'OTC', lifecycleStatus: 'active', description: '' }); this.formOpen.set(true); }
  openEdit(medicine: any): void { this.editingId.set(medicine.id); this.medicineForm.reset({ genericName: medicine.genericName, dosageForm: medicine.dosageForm, strengthValue: Number(medicine.strengthValue), strengthUnit: medicine.strengthUnit, strengthPerValue: medicine.strengthPerValue === null ? null : Number(medicine.strengthPerValue), strengthPerUnit: medicine.strengthPerUnit ?? '', routeOfAdministration: medicine.routeOfAdministration ?? '', therapeuticClass: medicine.therapeuticClass ?? '', prescriptionCategory: medicine.prescriptionCategory, lifecycleStatus: medicine.lifecycleStatus, description: medicine.description ?? '' }); this.formOpen.set(true); }
  closeForm(): void { if (!this.saving()) this.formOpen.set(false); }
  strengthPreview(): string { const value = this.medicineForm.controls.strengthValue.value; const unit = this.medicineForm.controls.strengthUnit.value; const perValue = this.medicineForm.controls.strengthPerValue.value; const perUnit = this.medicineForm.controls.strengthPerUnit.value; if (!value || !unit) return 'Complete the strength fields'; if (unit === '%') return `${value}%`; return perValue && perUnit ? `${value} ${unit} per ${perValue} ${perUnit}` : `${value} ${unit}`; }
  save(): void { if (this.medicineForm.invalid || this.saving()) return; this.saving.set(true); const request = this.editingId() ? this.api.updatePharmacyMedicine(this.editingId(), this.medicineForm.getRawValue()) : this.api.createPharmacyMedicine(this.medicineForm.getRawValue()); request.subscribe({ next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success(this.editingId() ? 'Medicine definition updated.' : 'Medicine definition created.'); this.load(); }, error: (error) => { this.saving.set(false); this.toast.error(error?.error?.message ?? 'Medicine definition could not be saved.'); } }); }
  formAbbreviation(form: string): string { return String(form ?? 'MD').slice(0, 2).toUpperCase(); }
}
