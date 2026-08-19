import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface PharmacySupplier {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays: number;
  notes?: string;
  isActive: boolean;
  receiptCount: number;
  totalPurchases: number;
  latestDeliveryAt?: string;
  outstandingBalance?: number;
  supplierCredit?: number;
}

interface SupplierDetail extends PharmacySupplier {
  metrics: {
    receiptCount: number;
    totalPurchases: number;
    latestDeliveryAt?: string;
    suppliedMedicineCount: number;
    outstandingBalance?: number;
    supplierCredit?: number;
    paidAmount?: number;
    returnedValue?: number;
  };
  goodsReceipts: Array<{
    id: string;
    receiptNumber: string;
    supplierInvoiceNumber?: string;
    receivedAt: string;
    totalCost: number;
    location: { code: string; name: string };
    lines: unknown[];
  }>;
  suppliedMedicines: Array<{ id: string; productCode?: string; name: string; receiptCount: number }>;
}

@Component({
  selector: 'app-pharmacy-suppliers-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="supplier-page">
      <header class="page-header">
        <div><span class="eyebrow">Procurement directory</span><h1>Pharmacy Suppliers</h1><p>Maintain approved supplier identities, contact details, payment terms, and purchase history across all pharmacy locations.</p></div>
        <button type="button" class="button button--primary" (click)="openCreateForm()">Add supplier</button>
      </header>

      <section class="summary-strip" aria-label="Supplier summary">
        <div><span>Active suppliers</span><strong>{{ activeCount() }}</strong></div>
        <div><span>Recorded deliveries</span><strong>{{ receiptCount() }}</strong></div>
        <div><span>Purchase value</span><strong>GHS {{ purchaseTotal() | number:'1.2-2' }}</strong></div>
      </section>

      <div class="toolbar"><label><span class="sr-only">Search suppliers</span><input type="search" placeholder="Search supplier, contact, phone, email or code" (input)="setSearch($event)" /></label><span>{{ filteredSuppliers().length }} supplier{{ filteredSuppliers().length === 1 ? '' : 's' }}</span></div>

      @if (loading()) {
        <div class="state">Loading suppliers…</div>
      } @else if (loadError()) {
        <div class="state state--error"><strong>Suppliers could not be loaded</strong><p>{{ loadError() }}</p><button type="button" class="button button--secondary" (click)="loadSuppliers()">Try again</button></div>
      } @else {
        <div class="table-wrap">
          <table>
            <colgroup><col class="col-supplier" /><col class="col-contact" /><col class="col-terms" /><col class="col-history" /><col class="col-status" /><col class="col-action" /></colgroup>
            <thead><tr><th>Supplier</th><th>Primary contact</th><th>Payment terms</th><th>Purchase history</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              @for (supplier of filteredSuppliers(); track supplier.id) {
                <tr class="supplier-row" tabindex="0" (click)="openDetails(supplier)" (keydown.enter)="openDetails(supplier)">
                  <td><div class="cell-stack"><strong>{{ supplier.name }}</strong><span>{{ supplier.supplierCode }}{{ supplier.taxId ? ' · ' + supplier.taxId : '' }}</span></div></td>
                  <td><div class="cell-stack"><strong>{{ supplier.contactPerson || 'Not assigned' }}</strong><span>{{ supplier.phone || supplier.email || 'No contact details' }}</span></div></td>
                  <td><strong>{{ termsLabel(supplier.paymentTermsDays) }}</strong></td>
                  <td><div class="history"><span><small>Receipts</small><strong>{{ supplier.receiptCount }}</strong></span><span><small>Value</small><strong>GHS {{ supplier.totalPurchases | number:'1.2-2' }}</strong></span></div></td>
                  <td><span class="status" [class.status--inactive]="!supplier.isActive"><i></i>{{ supplier.isActive ? 'Active' : 'Archived' }}</span></td>
                  <td><button type="button" class="edit-button" (click)="$event.stopPropagation(); openEditForm(supplier)">Edit</button></td>
                </tr>
              } @empty { <tr><td colspan="6" class="empty-cell">No suppliers match this search.</td></tr> }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (detailOpen()) {
      <div class="backdrop" (click)="closeDetails()"></div>
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="supplier-detail-title">
        <header><div><span class="eyebrow">Supplier record</span><h2 id="supplier-detail-title">{{ detail()?.name || selectedName() }}</h2>@if (detail(); as supplier) { <p>{{ supplier.supplierCode }} · {{ termsLabel(supplier.paymentTermsDays) }}</p> }</div><div class="header-actions">@if (detail(); as supplier) { <button type="button" class="button button--secondary" (click)="openEditFromDetail(supplier)">Edit supplier</button> }<button type="button" class="close-button" aria-label="Close supplier details" (click)="closeDetails()">×</button></div></header>
        @if (detailLoading()) { <div class="loading-bars"><span></span><span></span><span></span></div> }
        @else if (detailError()) { <div class="state state--error"><strong>Supplier details could not be loaded</strong><p>{{ detailError() }}</p><button type="button" class="button button--secondary" (click)="reloadDetails()">Try again</button></div> }
        @else if (detail(); as supplier) {
          <div class="detail-content">
            <section class="detail-metrics"><div><span>Deliveries</span><strong>{{ supplier.metrics.receiptCount }}</strong><small>Latest 50 records</small></div><div><span>Purchases</span><strong>GHS {{ supplier.metrics.totalPurchases | number:'1.2-2' }}</strong><small>Posted goods receipts</small></div><div><span>Paid / returned</span><strong>GHS {{ supplier.metrics.paidAmount || 0 | number:'1.2-2' }}</strong><small>Returns GHS {{ supplier.metrics.returnedValue || 0 | number:'1.2-2' }}</small></div><div><span>Outstanding</span><strong>GHS {{ supplier.metrics.outstandingBalance || 0 | number:'1.2-2' }}</strong><small>Supplier credit GHS {{ supplier.metrics.supplierCredit || 0 | number:'1.2-2' }}</small></div></section>
            <section class="profile"><header><span class="section-label">Supplier profile</span><h3>Contact and commercial terms</h3></header><dl><div><dt>Contact person</dt><dd>{{ supplier.contactPerson || 'Not assigned' }}</dd></div><div><dt>Phone</dt><dd>{{ supplier.phone || 'Not recorded' }}</dd></div><div><dt>Email</dt><dd>{{ supplier.email || 'Not recorded' }}</dd></div><div><dt>Tax ID</dt><dd>{{ supplier.taxId || 'Not recorded' }}</dd></div><div><dt>Address</dt><dd>{{ supplier.address || 'Not recorded' }}</dd></div><div><dt>Payment terms</dt><dd>{{ termsLabel(supplier.paymentTermsDays) }}</dd></div></dl></section>
            <section class="detail-section"><header><div><span class="section-label">Delivery history</span><h3>Recent goods receipts</h3></div><span>{{ supplier.goodsReceipts.length }} shown</span></header><div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Receipt</th><th>Supplier invoice</th><th>Location</th><th>Lines</th><th>Received</th><th>Total</th></tr></thead><tbody>@for (receipt of supplier.goodsReceipts; track receipt.id) { <tr><td><strong>{{ receipt.receiptNumber }}</strong></td><td>{{ receipt.supplierInvoiceNumber || '—' }}</td><td>{{ receipt.location.code }} · {{ receipt.location.name }}</td><td>{{ receipt.lines.length }}</td><td>{{ receipt.receivedAt | date:'mediumDate' }}</td><td><strong>GHS {{ receipt.totalCost | number:'1.2-2' }}</strong></td></tr> } @empty { <tr><td colspan="6" class="empty-cell">No deliveries have been received from this supplier.</td></tr> }</tbody></table></div></section>
            <section class="detail-section"><header><div><span class="section-label">Catalogue relationship</span><h3>Medicines supplied</h3></div><span>{{ supplier.suppliedMedicines.length }} items</span></header><div class="medicine-list">@for (medicine of supplier.suppliedMedicines; track medicine.id) { <div><span><strong>{{ medicine.name }}</strong><small>{{ medicine.productCode || 'No product code' }}</small></span><span>{{ medicine.receiptCount }} receipt{{ medicine.receiptCount === 1 ? '' : 's' }}</span></div> } @empty { <div class="empty-cell">No medicine history is available.</div> }</div></section>
            <footer class="archive-footer"><div><strong>{{ supplier.isActive ? 'Archive supplier' : 'Supplier archived' }}</strong><span>{{ supplier.isActive ? 'Archived suppliers remain on historical receipts but cannot be selected for new deliveries.' : 'Reactivate this supplier from the edit form when needed.' }}</span></div>@if (supplier.isActive) { <button type="button" class="archive-button" [class.archive-button--confirm]="archiveConfirm()" [disabled]="archiving()" (click)="archiveSupplier(supplier)">{{ archiving() ? 'Archiving…' : (archiveConfirm() ? 'Confirm archive' : 'Archive') }}</button> }</footer>
          </div>
        }
      </aside>
    }

    @if (formOpen()) {
      <div class="backdrop" (click)="closeForm()"></div>
      <aside class="form-drawer" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title">
        <header><div><span class="eyebrow">{{ editingId() ? 'Update supplier' : 'New supplier' }}</span><h2 id="supplier-form-title">{{ editingId() ? 'Edit supplier record' : 'Register supplier' }}</h2></div><button type="button" class="close-button" aria-label="Close supplier form" (click)="closeForm()">×</button></header>
        <form [formGroup]="supplierForm" (ngSubmit)="saveSupplier()">
          <fieldset><legend>Identity</legend><div class="form-grid"><label class="wide"><span>Supplier name *</span><input formControlName="name" placeholder="Registered supplier or wholesaler name" /></label><label><span>Supplier code</span><input formControlName="supplierCode" placeholder="Generated if empty" /></label><label><span>Tax ID</span><input formControlName="taxId" placeholder="Tax identification number" /></label></div></fieldset>
          <fieldset><legend>Contact</legend><div class="form-grid"><label><span>Contact person</span><input formControlName="contactPerson" placeholder="Primary representative" /></label><label><span>Phone</span><input formControlName="phone" placeholder="Telephone number" /></label><label><span>Email</span><input type="email" formControlName="email" placeholder="orders@supplier.com" /></label><label class="wide"><span>Address</span><textarea rows="2" formControlName="address" placeholder="Business or delivery address"></textarea></label></div></fieldset>
          <fieldset><legend>Commercial terms</legend><div class="form-grid"><label><span>Payment terms in days *</span><input type="number" min="0" max="365" formControlName="paymentTermsDays" /></label><label class="check-field"><input type="checkbox" formControlName="isActive" /><span><strong>Supplier is active</strong><small>Only active suppliers can be used for new stock receipts.</small></span></label><label class="wide"><span>Notes</span><textarea rows="3" formControlName="notes" placeholder="Delivery schedule, ordering instructions, or commercial notes"></textarea></label></div></fieldset>
          <footer><button type="button" class="button button--secondary" (click)="closeForm()">Cancel</button><button type="submit" class="button button--primary" [disabled]="supplierForm.invalid || saving()">{{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Register supplier') }}</button></footer>
        </form>
      </aside>
    }
  `,
  styles: `
    :host{display:block}.supplier-page{display:grid;gap:1.2rem;max-width:1480px;margin:0 auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1.15rem;border-bottom:1px solid var(--app-border-color)}h1,h2,h3,p{margin-top:0}h1{margin-bottom:.4rem;font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.04em}.page-header p{max-width:72ch;margin-bottom:0;color:var(--app-muted-text-color);line-height:1.55}.eyebrow,.section-label{display:block;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.eyebrow{margin-bottom:.35rem}.button{min-height:2.55rem;padding:.6rem .9rem;border-radius:.55rem;font:inherit;font-size:.76rem;font-weight:800;cursor:pointer}.button--primary{border:1px solid var(--app-primary-color);background:var(--app-primary-color);color:white}.button--secondary{border:1px solid var(--app-border-color);background:white;color:var(--app-text-color)}button:disabled{cursor:not-allowed;opacity:.55}.summary-strip{display:grid;grid-template-columns:.7fr .8fr 1.2fr;border-block:1px solid var(--app-border-color)}.summary-strip div{display:grid;gap:.2rem;padding:.8rem 1rem;border-right:1px solid var(--app-border-color)}.summary-strip div:last-child{border-right:0}.summary-strip span,.detail-metrics span{color:var(--app-muted-text-color);font-size:12px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.summary-strip strong{font-size:1.05rem}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem}.toolbar label{width:min(620px,100%)}.toolbar input{width:100%}.toolbar>span{color:var(--app-muted-text-color);font-size:12px;font-weight:750}.table-wrap{overflow-x:auto;border:1px solid var(--app-border-color);border-radius:.75rem;background:white}table{width:100%;min-width:1050px;table-layout:fixed;border-collapse:collapse}.col-supplier{width:23%}.col-contact{width:22%}.col-terms{width:13%}.col-history{width:23%}.col-status{width:11%}.col-action{width:8%}th{padding:.72rem .85rem;background:#f8fafc;color:var(--app-muted-text-color);font-size:12px;letter-spacing:.05em;text-align:left;text-transform:uppercase}td{height:4rem;padding:.62rem .85rem;border-top:1px solid var(--app-border-color);font-size:12px;vertical-align:middle}.supplier-row{cursor:pointer;transition:background .16s ease}.supplier-row:hover{background:#f8fcfb}.supplier-row:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 78%);outline-offset:-3px}.cell-stack{display:grid;gap:.18rem}.cell-stack span,.cell-stack small{color:var(--app-muted-text-color);font-size:12px}.history{display:grid;grid-template-columns:.7fr 1.3fr;gap:.65rem}.history span{display:grid;gap:.12rem}.history small{color:var(--app-muted-text-color);font-size:12px;text-transform:uppercase}.status{display:inline-flex;align-items:center;gap:.4rem;color:var(--app-primary-color);font-size:12px;font-weight:800}.status i{width:.42rem;height:.42rem;border-radius:50%;background:currentColor}.status--inactive{color:#64748b}.edit-button{min-height:2rem;padding:.35rem .65rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 65%);border-radius:.45rem;background:white;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.state,.empty-cell{padding:2rem;text-align:center;color:var(--app-muted-text-color)}.state{border:1px dashed var(--app-border-color);border-radius:.7rem;background:white}.state--error{color:#9f3128}.backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.42);backdrop-filter:blur(2px)}.detail-drawer,.form-drawer{position:fixed;inset:0 0 0 auto;z-index:81;overflow-y:auto;background:white;box-shadow:-18px 0 50px rgba(15,23,42,.16)}.detail-drawer{width:min(920px,100%)}.form-drawer{width:min(680px,100%);padding:1.3rem}.detail-drawer>header,.form-drawer>header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 1.25rem;border-bottom:1px solid var(--app-border-color);background:rgba(255,255,255,.96);backdrop-filter:blur(10px)}.form-drawer>header{margin:-1.3rem -1.3rem 0}.detail-drawer header h2,.form-drawer header h2{margin-bottom:.15rem}.detail-drawer header p{margin:0;color:var(--app-muted-text-color);font-size:12px}.header-actions{display:flex;align-items:center;gap:.6rem}.close-button{width:2.35rem;height:2.35rem;border:1px solid var(--app-border-color);border-radius:50%;background:white;font-size:1.35rem;cursor:pointer}.detail-content{display:grid;gap:1.15rem;padding:1.2rem 1.25rem 2rem}.loading-bars{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;padding:1.2rem}.loading-bars span{height:5rem;border-radius:.6rem;background:#f1f5f4}.detail-metrics{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--app-border-color)}.detail-metrics div{display:grid;gap:.16rem;padding:.8rem .85rem;border-right:1px solid var(--app-border-color)}.detail-metrics div:last-child{border-right:0}.detail-metrics strong{font-size:.95rem}.detail-metrics small{color:var(--app-muted-text-color);font-size:12px}.profile,.detail-section{padding-top:1rem;border-top:1px solid var(--app-border-color)}.profile header,.detail-section>header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:.7rem}.profile h3,.detail-section h3{margin:.12rem 0 0;font-size:.9rem}.detail-section>header>span{color:var(--app-muted-text-color);font-size:12px}.profile dl{display:grid;grid-template-columns:1fr 1fr;margin:0;border:1px solid var(--app-border-color);border-radius:.6rem;overflow:hidden}.profile dl div{display:grid;gap:.18rem;padding:.65rem .75rem;border-bottom:1px solid var(--app-border-color)}.profile dl div:nth-child(odd){border-right:1px solid var(--app-border-color)}.profile dl div:nth-last-child(-n+2){border-bottom:0}dt{color:var(--app-muted-text-color);font-size:12px;font-weight:800;text-transform:uppercase}dd{margin:0;font-size:12px}.detail-table-wrap{overflow-x:auto;border:1px solid var(--app-border-color);border-radius:.6rem}.detail-table{min-width:760px}.detail-table td{height:auto;padding:.6rem .65rem;font-size:12px}.medicine-list{border:1px solid var(--app-border-color);border-radius:.6rem;overflow:hidden}.medicine-list>div{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.58rem .7rem;border-bottom:1px solid var(--app-border-color);font-size:12px}.medicine-list>div:last-child{border-bottom:0}.medicine-list>div>span:first-child{display:grid;gap:.1rem}.medicine-list small{color:var(--app-muted-text-color)}.archive-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;border:1px solid #fed7aa;border-radius:.6rem;background:#fffbeb}.archive-footer div{display:grid;gap:.18rem}.archive-footer strong{font-size:12px}.archive-footer span{color:#785d2c;font-size:12px}.archive-button{min-height:2.3rem;padding:.5rem .8rem;border:1px solid #d97706;border-radius:.5rem;background:white;color:#9a3412;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.archive-button--confirm{background:#9a3412;color:white}form{display:grid;gap:1rem;padding-top:1rem}fieldset{display:grid;gap:.75rem;margin:0;padding:0 0 1rem;border:0;border-bottom:1px solid var(--app-border-color)}legend{padding:0;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem}label{display:grid;gap:.35rem}label.wide{grid-column:1/-1}label>span{font-size:12px;font-weight:780}input,textarea{width:100%;min-height:2.6rem;padding:.6rem .7rem;border:1px solid var(--app-border-color);border-radius:.5rem;background:white;color:var(--app-text-color);font:inherit}.check-field{grid-template-columns:auto 1fr;align-items:start;padding:.55rem .65rem;border:1px solid var(--app-border-color);border-radius:.5rem;background:#fbfdfd}.check-field input{width:1rem;min-height:1rem;margin-top:.1rem;accent-color:var(--app-primary-color)}.check-field>span{display:grid;gap:.1rem}.check-field small{color:var(--app-muted-text-color);font-size:12px;font-weight:500}form footer{display:flex;justify-content:flex-end;gap:.65rem;padding-top:.8rem}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}input:focus,textarea:focus,button:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px;border-color:var(--app-primary-color)}@media(max-width:720px){.page-header,.detail-drawer>header,.archive-footer{align-items:stretch;flex-direction:column}.summary-strip,.detail-metrics,.profile dl,.form-grid{grid-template-columns:1fr}.summary-strip div,.detail-metrics div{border-right:0;border-bottom:1px solid var(--app-border-color)}.profile dl div,.profile dl div:nth-child(odd){border-right:0}.profile dl div:nth-last-child(-n+2){border-bottom:1px solid var(--app-border-color)}.profile dl div:last-child{border-bottom:0}label.wide{grid-column:auto}.toolbar{align-items:stretch;flex-direction:column}.header-actions{justify-content:space-between}}
  `,
})
export class PharmacySuppliersPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly suppliers = signal<PharmacySupplier[]>([]);
  readonly search = signal('');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly formOpen = signal(false);
  readonly editingId = signal('');
  readonly saving = signal(false);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly detail = signal<SupplierDetail | null>(null);
  readonly selectedId = signal('');
  readonly selectedName = signal('');
  readonly archiveConfirm = signal(false);
  readonly archiving = signal(false);
  readonly activeCount = computed(() => this.suppliers().filter((supplier) => supplier.isActive).length);
  readonly receiptCount = computed(() => this.suppliers().reduce((sum, supplier) => sum + supplier.receiptCount, 0));
  readonly purchaseTotal = computed(() => this.suppliers().reduce((sum, supplier) => sum + Number(supplier.totalPurchases || 0), 0));
  readonly filteredSuppliers = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.suppliers();
    return this.suppliers().filter((supplier) => [supplier.name, supplier.supplierCode, supplier.contactPerson, supplier.phone, supplier.email, supplier.taxId].some((value) => value?.toLowerCase().includes(query)));
  });

  readonly supplierForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]], supplierCode: [''], contactPerson: [''], phone: [''], email: ['', Validators.email], address: [''], taxId: [''],
    paymentTermsDays: [0, [Validators.required, Validators.min(0), Validators.max(365)]], notes: [''], isActive: [true],
  });

  ngOnInit(): void { this.loadSuppliers(); }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  termsLabel(days: number): string { return Number(days) === 0 ? 'Due on receipt' : `Net ${days} days`; }

  loadSuppliers(): void {
    this.loading.set(true); this.loadError.set('');
    this.api.getPharmacySuppliers().subscribe({
      next: (suppliers) => { this.suppliers.set(suppliers ?? []); this.loading.set(false); },
      error: (error) => { this.loadError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.loading.set(false); },
    });
  }

  openCreateForm(): void {
    this.editingId.set('');
    this.supplierForm.reset({ name: '', supplierCode: '', contactPerson: '', phone: '', email: '', address: '', taxId: '', paymentTermsDays: 0, notes: '', isActive: true });
    this.formOpen.set(true);
  }

  openEditForm(supplier: PharmacySupplier): void {
    this.editingId.set(supplier.id);
    this.supplierForm.reset({ name: supplier.name, supplierCode: supplier.supplierCode, contactPerson: supplier.contactPerson ?? '', phone: supplier.phone ?? '', email: supplier.email ?? '', address: supplier.address ?? '', taxId: supplier.taxId ?? '', paymentTermsDays: supplier.paymentTermsDays, notes: supplier.notes ?? '', isActive: supplier.isActive });
    this.formOpen.set(true);
  }

  closeForm(): void { if (!this.saving()) this.formOpen.set(false); }
  openEditFromDetail(supplier: SupplierDetail): void { this.closeDetails(); this.openEditForm(supplier); }

  saveSupplier(): void {
    if (this.supplierForm.invalid || this.saving()) { this.supplierForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const request = this.editingId() ? this.api.updatePharmacySupplier(this.editingId(), this.supplierForm.getRawValue()) : this.api.createPharmacySupplier(this.supplierForm.getRawValue());
    request.subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success(this.editingId() ? 'Supplier updated.' : 'Supplier registered.'); this.loadSuppliers(); },
      error: (error) => { this.saving.set(false); this.toast.error(error?.error?.message ?? 'Supplier could not be saved.'); },
    });
  }

  openDetails(supplier: PharmacySupplier): void {
    this.selectedId.set(supplier.id); this.selectedName.set(supplier.name); this.detail.set(null); this.detailOpen.set(true); this.archiveConfirm.set(false); this.loadDetail(supplier.id);
  }
  closeDetails(): void { this.detailOpen.set(false); this.archiveConfirm.set(false); }
  reloadDetails(): void { if (this.selectedId()) this.loadDetail(this.selectedId()); }

  archiveSupplier(supplier: SupplierDetail): void {
    if (!this.archiveConfirm()) { this.archiveConfirm.set(true); return; }
    this.archiving.set(true);
    this.api.updatePharmacySupplier(supplier.id, { isActive: false }).subscribe({
      next: () => { this.archiving.set(false); this.toast.success('Supplier archived.'); this.closeDetails(); this.loadSuppliers(); },
      error: (error) => { this.archiving.set(false); this.toast.error(error?.error?.message ?? 'Supplier could not be archived.'); },
    });
  }

  private loadDetail(supplierId: string): void {
    this.detailLoading.set(true); this.detailError.set('');
    this.api.getPharmacySupplierDetail(supplierId).subscribe({
      next: (detail) => { this.detail.set(detail); this.detailLoading.set(false); },
      error: (error) => { this.detailError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.detailLoading.set(false); },
    });
  }
}
