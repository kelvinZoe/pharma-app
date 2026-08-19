import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface ReceivingMedicine {
  id: string;
  name: string;
  productCode: string;
  unitOfMeasure: string;
  defaultSellingPrice?: number;
  defaultPurchaseUnit?: string;
  defaultUnitsPerPack?: number;
  packageType?: string;
  packageQuantity?: number;
  packageUnit?: string;
  sellingUnit?: string;
  isActive: boolean;
}

interface ReceivingSupplier {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  isActive: boolean;
}

interface ReceivingPurchaseOrder {
  id: string;
  orderNumber: string;
  status: string;
  supplier: { id: string; name: string };
  outstandingUnits: number;
}

@Component({
  selector: 'app-pharmacy-stock-receiving-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="receiving-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Goods receipt</span>
          <h1>Receive Stock</h1>
          <p>Record an entire supplier delivery in one posting. Pack quantities are converted automatically into dispensing units.</p>
        </div>
        <div class="posting-rule"><span>Posting rule</span><strong>Receipt + batches + stock ledger</strong></div>
      </header>

      <form [formGroup]="receiptForm" (ngSubmit)="postReceipt()">
        <section class="receipt-card">
          <header><span>01</span><div><h2>Delivery details</h2><p>Identify the source document before entering medicine lines.</p></div></header>
          <div class="header-grid">
            <label><span>Purchase order</span><select formControlName="purchaseOrderId" (change)="onPurchaseOrderSelected($event)"><option value="">Administrator direct-receipt override</option>@for (order of receivableOrders(); track order.id) { <option [value]="order.id">{{ order.orderNumber }} · {{ order.supplier.name }} · {{ order.outstandingUnits }} outstanding</option> }</select></label>
            <label class="supplier-field"><span>Supplier *</span><input type="hidden" formControlName="supplierId" /><div class="supplier-picker"><input type="search" placeholder="Search approved suppliers" [value]="supplierQuery()" [readOnly]="!!receiptForm.controls.purchaseOrderId.value" (focus)="!receiptForm.controls.purchaseOrderId.value && supplierPickerOpen.set(true)" (blur)="supplierPickerOpen.set(false)" (input)="setSupplierQuery($event)" autocomplete="off" />@if (supplierPickerOpen()) { <div class="supplier-options" (mousedown)="$event.preventDefault()">@for (supplier of filteredSuppliers(); track supplier.id) { <button type="button" (click)="chooseSupplier(supplier)"><strong>{{ supplier.name }}</strong><span>{{ supplier.supplierCode }}{{ supplier.contactPerson ? ' · ' + supplier.contactPerson : '' }}</span></button> } @empty { <div><strong>No active supplier found</strong><span>Register the supplier before posting this receipt.</span><button type="button" class="inline-link" (click)="goToSuppliers()">Open suppliers</button></div> }</div> }</div></label>
            <label><span>Supplier invoice number</span><input formControlName="supplierInvoiceNumber" placeholder="INV-000123" /></label>
            <label><span>Invoice date</span><div class="input-shell input-shell--icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><input type="date" formControlName="invoiceDate" /></div></label>
            <label><span>Payment due date</span><div class="input-shell input-shell--icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><input type="date" formControlName="dueDate" /></div></label>
            <label><span>Date received *</span><div class="input-shell input-shell--icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><input type="date" formControlName="receivedAt" /></div></label>
            @if (!receiptForm.controls.purchaseOrderId.value) { <label class="wide"><span>Administrator direct-receipt reason *</span><input formControlName="directReceiptReason" placeholder="Explain why this delivery has no approved purchase order" /></label> }
            <label class="wide"><span>Notes</span><input formControlName="notes" placeholder="Delivery notes, discrepancies or receiving remarks" /></label>
          </div>
        </section>

        <section class="receipt-card">
          <header class="line-header">
            <span>02</span>
            <div><h2>Medicine lines</h2><p>One line creates one traceable batch at the active pharmacy location.</p></div>
            <button type="button" class="button button--secondary" [disabled]="!!receiptForm.controls.purchaseOrderId.value" (click)="addLine()">Add line</button>
          </header>

          <div formArrayName="lines" class="receipt-lines">
            @for (line of lineControls; track $index; let index = $index) {
              <article class="receipt-line" [formGroupName]="index">
                <header class="receipt-line__header">
                  <div><span class="line-number">{{ String(index + 1).padStart(2, '0') }}</span><strong>Batch line {{ index + 1 }}</strong></div>
                  <button type="button" class="remove-line" aria-label="Remove this receipt line" [disabled]="lineControls.length === 1" (click)="removeLine(index)">Remove line</button>
                </header>

                <div class="line-fields">
                  <label class="medicine-field"><span>Medicine *</span><select formControlName="productId" (change)="onMedicineSelected(index)"><option value="">Select catalogue medicine</option>@for (medicine of medicines(); track medicine.id) {<option [value]="medicine.id">{{ medicine.name }} · {{ medicine.productCode }}</option>}</select></label>
                  <label><span>Batch number *</span><input formControlName="batchNumber" placeholder="B-10029" /></label>
                  <label><span>Expiry date *</span><div class="input-shell input-shell--icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><input type="date" [min]="minimumExpiryDate" formControlName="expiryDate" /></div></label>
                  <label><span>Purchase package *</span><input formControlName="purchaseUnit" readonly /></label>
                  <label><span>Number of packages *</span><input type="number" min="0.01" step="0.01" formControlName="packQuantity" /></label>
                  <label><span>Units per package *</span><input type="number" min="0.01" step="0.01" formControlName="unitsPerPack" readonly /></label>
                  <label><span>Cost per pack *</span><div class="input-shell input-shell--currency"><span>GHS</span><input type="number" min="0" step="0.01" placeholder="0.00" formControlName="purchasePricePerPack" /></div></label>
                  <div class="selling-field current-price"><span>Current shop selling price</span><strong>GHS {{ shopPrice(index) | number:'1.2-2' }}</strong><small>Retail prices are controlled from the medicine catalogue.</small></div>
                </div>

                <div class="line-result">
                  <div><span>Stock added</span><strong>{{ lineQuantity(index) }} {{ medicineUnit(index) }}</strong></div>
                  <div><span>Calculated unit cost</span><strong>GHS {{ unitCost(index) | number:'1.2-4' }}</strong></div>
                  <div><span>Line purchase value</span><strong>GHS {{ lineTotal(index) | number:'1.2-2' }}</strong></div>
                </div>
              </article>
            }
          </div>
        </section>

        <footer class="receipt-footer">
          <div><span>Receipt total</span><strong>GHS {{ receiptTotal() | number:'1.2-2' }}</strong><small>{{ lineControls.length }} batch line{{ lineControls.length === 1 ? '' : 's' }} will be posted</small></div>
          <div><button type="button" class="button button--secondary" (click)="goToInventory()">Cancel</button><button type="submit" class="button button--primary" [disabled]="receiptForm.invalid || posting()">{{ posting() ? 'Posting receipt…' : 'Post stock receipt' }}</button></div>
        </footer>
      </form>

      @if (recentReceipts().length) {
        <section class="recent-receipts">
          <header><div><span class="eyebrow">Audit trail</span><h2>Recent receipts</h2></div></header>
          @for (receipt of recentReceipts().slice(0, 5); track receipt.id) {
            <div class="receipt-history-row"><div><strong>{{ receipt.receiptNumber }}</strong><span>{{ receipt.supplierName || 'Supplier not recorded' }}{{ receipt.purchaseOrder?.orderNumber ? ' · ' + receipt.purchaseOrder.orderNumber : '' }}</span></div><span>{{ receipt.lines?.length || 0 }} lines</span><strong>GHS {{ receipt.totalCost | number:'1.2-2' }}</strong><time>{{ receipt.receivedAt | date:'mediumDate' }}</time></div>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .current-price{display:grid;align-content:center;gap:.35rem;padding:.7rem .8rem;border:1px solid var(--app-border-color);border-radius:.55rem;background:#fbfdfd}.current-price>span{font-size:12px;font-weight:800;color:#475569}.current-price>strong{color:var(--app-primary-color);font-size:1rem}.current-price>small{color:var(--app-muted-text-color);font-size:12px}
    :host{display:block}.receiving-page{display:grid;gap:1.25rem;max-width:1500px;margin:0 auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1.2rem;border-bottom:1px solid var(--app-border-color)}h1,h2,p{margin-top:0}h1{margin-bottom:.4rem;font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.04em}h2{margin-bottom:.25rem;font-size:1.1rem}.page-header p,.receipt-card header p{max-width:74ch;margin-bottom:0;color:var(--app-muted-text-color);line-height:1.55}.eyebrow{display:block;margin-bottom:.35rem;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.posting-rule{display:grid;gap:.2rem;min-width:250px;padding:.8rem 1rem;border-left:3px solid var(--app-primary-color);background:var(--app-primary-soft-color)}.posting-rule span{color:var(--app-muted-text-color);font-size:12px;font-weight:800;text-transform:uppercase}.posting-rule strong{font-size:.78rem}form{display:grid;gap:1rem}.receipt-card{border:1px solid var(--app-border-color);border-radius:.85rem;background:white;overflow:visible}.receipt-card>header{display:flex;align-items:flex-start;gap:.8rem;padding:1rem 1.1rem;border-bottom:1px solid var(--app-border-color);background:#fbfdfd}.receipt-card>header>span{display:grid;place-items:center;width:2rem;height:2rem;border-radius:50%;background:var(--app-primary-color);color:white;font-size:12px;font-weight:850}.line-header .button{margin-left:auto}.header-grid{display:grid;grid-template-columns:1.2fr 1fr .7fr;gap:1rem;padding:1.1rem}.header-grid .wide{grid-column:1/-1}label{display:grid;gap:.4rem}label>span,.line-result span{font-size:12px;font-weight:800;color:#475569}input,select{width:100%;min-width:0;min-height:2.75rem;padding:.6rem .72rem;border:1px solid var(--app-border-color);border-radius:.55rem;background:white;color:var(--app-text-color);font:inherit}.supplier-picker{position:relative}.supplier-options{position:absolute;inset:auto 0 0;z-index:8;translate:0 calc(100% + .35rem);overflow:hidden;border:1px solid var(--app-border-color);border-radius:.6rem;background:white;box-shadow:0 15px 35px rgba(15,23,42,.14)}.supplier-options>button{display:grid;gap:.12rem;width:100%;padding:.62rem .72rem;border:0;border-bottom:1px solid var(--app-border-color);background:white;color:var(--app-text-color);font:inherit;text-align:left;cursor:pointer}.supplier-options>button:hover{background:var(--app-primary-soft-color)}.supplier-options>button span,.supplier-options>div>span{color:var(--app-muted-text-color);font-size:12px}.supplier-options>div{display:grid;gap:.2rem;padding:.8rem}.inline-link{width:fit-content;padding:0;border:0;background:transparent;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.receipt-lines{display:grid}.receipt-line{display:grid;gap:1rem;padding:1rem 1.1rem 1.1rem;border-bottom:1px solid var(--app-border-color)}.receipt-line:last-child{border-bottom:0}.receipt-line__header{display:flex;align-items:center;justify-content:space-between;gap:1rem}.receipt-line__header>div{display:flex;align-items:center;gap:.65rem}.receipt-line__header strong{font-size:.75rem}.line-number{display:grid;place-items:center;width:2rem;height:1.55rem;border-radius:999px;background:var(--app-primary-soft-color);color:var(--app-primary-color);font-family:ui-monospace,monospace;font-size:12px;font-weight:850}.line-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.85rem}.medicine-field{grid-column:span 2}.selling-field{grid-column:span 2}.input-shell{position:relative;display:flex;align-items:center}.input-shell input{padding-left:3.2rem}.input-shell--icon input{padding-left:2.5rem}.input-shell svg{position:absolute;left:.78rem;z-index:1;width:1rem;height:1rem;fill:none;stroke:var(--app-primary-color);stroke-width:1.8;pointer-events:none}.input-shell>span{position:absolute;left:.7rem;z-index:1;padding-right:.55rem;border-right:1px solid var(--app-border-color);color:var(--app-primary-color);font-size:12px;font-weight:850;pointer-events:none}.line-result{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid color-mix(in srgb,var(--app-primary-color),white 72%);border-radius:.6rem;background:var(--app-primary-soft-color);overflow:hidden}.line-result>div{display:grid;gap:.22rem;padding:.68rem .8rem;border-right:1px solid color-mix(in srgb,var(--app-primary-color),white 78%)}.line-result>div:last-child{border-right:0}.line-result strong{color:var(--app-primary-color);font-size:.82rem}.remove-line{border:0;background:transparent;color:#b42318;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.remove-line:disabled{opacity:.3;cursor:not-allowed}.button{min-height:2.55rem;padding:.6rem .9rem;border-radius:.55rem;font:inherit;font-size:.78rem;font-weight:800;cursor:pointer}.button--primary{border:1px solid var(--app-primary-color);background:var(--app-primary-color);color:white}.button--secondary{border:1px solid var(--app-border-color);background:white;color:var(--app-text-color)}.button:disabled{opacity:.55;cursor:not-allowed}.receipt-footer{position:sticky;bottom:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:2rem;padding:1rem 1.2rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 65%);border-radius:.8rem;background:rgba(255,255,255,.96);box-shadow:0 -10px 35px rgba(15,23,42,.08);backdrop-filter:blur(12px)}.receipt-footer>div:first-child{display:grid;gap:.15rem}.receipt-footer span,.receipt-footer small{color:var(--app-muted-text-color);font-size:12px}.receipt-footer strong{font-size:1.25rem}.receipt-footer>div:last-child{display:flex;gap:.65rem}.recent-receipts{border:1px solid var(--app-border-color);border-radius:.8rem;background:white;overflow:hidden}.recent-receipts>header{padding:1rem;border-bottom:1px solid var(--app-border-color)}.receipt-history-row{display:grid;grid-template-columns:1.5fr .5fr .6fr .6fr;gap:1rem;padding:.85rem 1rem;border-bottom:1px solid var(--app-border-color);font-size:.76rem;align-items:center}.receipt-history-row:last-child{border-bottom:0}.receipt-history-row>div{display:grid;gap:.18rem}.receipt-history-row span,.receipt-history-row time{color:var(--app-muted-text-color)}input:focus,select:focus,button:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px;border-color:var(--app-primary-color)}@media(max-width:900px){.line-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.medicine-field,.selling-field{grid-column:span 2}}@media(max-width:720px){.page-header,.receipt-footer{align-items:stretch;flex-direction:column}.posting-rule{min-width:0}.header-grid,.line-fields,.line-result{grid-template-columns:1fr}.header-grid .wide,.medicine-field,.selling-field{grid-column:auto}.line-result>div{border-right:0;border-bottom:1px solid color-mix(in srgb,var(--app-primary-color),white 78%)}.line-result>div:last-child{border-bottom:0}.receipt-footer>div:last-child{display:grid}.receipt-history-row{grid-template-columns:1fr 1fr}.line-header{flex-wrap:wrap}.line-header .button{width:100%;margin-left:2.8rem}}
  `,
})
export class PharmacyStockReceivingPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly medicines = signal<ReceivingMedicine[]>([]);
  readonly suppliers = signal<ReceivingSupplier[]>([]);
  readonly purchaseOrders = signal<ReceivingPurchaseOrder[]>([]);
  readonly supplierQuery = signal('');
  readonly supplierPickerOpen = signal(false);
  readonly recentReceipts = signal<any[]>([]);
  readonly posting = signal(false);
  readonly minimumExpiryDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  readonly String = String;
  readonly filteredSuppliers = computed(() => {
    const query = this.supplierQuery().trim().toLowerCase();
    const activeSuppliers = this.suppliers().filter((supplier) => supplier.isActive);
    if (!query) return activeSuppliers.slice(0, 8);
    return activeSuppliers.filter((supplier) => [supplier.name, supplier.supplierCode, supplier.contactPerson, supplier.phone].some((value) => value?.toLowerCase().includes(query))).slice(0, 8);
  });
  readonly receivableOrders = computed(() => this.purchaseOrders().filter((order) => ['approved', 'partially_received'].includes(order.status) && Number(order.outstandingUnits) > 0));

  readonly receiptForm = this.formBuilder.group({
    purchaseOrderId: [''], supplierId: ['', Validators.required], supplierInvoiceNumber: [''], invoiceDate: [new Date().toISOString().slice(0, 10)], dueDate: [''], receivedAt: [new Date().toISOString().slice(0, 10), Validators.required], directReceiptReason: [''], notes: [''],
    lines: this.formBuilder.array([this.createLine()]),
  });

  get lines(): FormArray { return this.receiptForm.controls.lines; }
  get lineControls() { return this.lines.controls; }

  ngOnInit(): void {
    forkJoin({ medicines: this.api.getPharmacyProducts(), suppliers: this.api.getPharmacySuppliers(), orders: this.api.getPharmacyPurchaseOrders() }).subscribe({
      next: ({ medicines, suppliers, orders }) => {
        this.medicines.set((medicines ?? []).filter((medicine: ReceivingMedicine) => medicine.isActive !== false));
        this.suppliers.set((suppliers ?? []).filter((supplier: ReceivingSupplier) => supplier.isActive));
        this.purchaseOrders.set(orders ?? []);
        const requestedOrderId = this.route.snapshot.queryParamMap.get('purchaseOrderId');
        if (requestedOrderId) this.loadPurchaseOrder(requestedOrderId);
      },
      error: () => this.toast.error('Receiving references could not be loaded.'),
    });
    this.loadReceipts();
  }

  onPurchaseOrderSelected(event: Event): void {
    const orderId = (event.target as HTMLSelectElement).value;
    if (!orderId) {
      this.receiptForm.controls.purchaseOrderId.setValue('');
      this.receiptForm.controls.supplierId.setValue('');
      this.supplierQuery.set('');
      this.lines.clear();
      this.addLine();
      return;
    }
    this.loadPurchaseOrder(orderId);
  }

  setSupplierQuery(event: Event): void {
    this.supplierQuery.set((event.target as HTMLInputElement).value);
    this.receiptForm.controls.supplierId.setValue('');
    this.supplierPickerOpen.set(true);
  }

  chooseSupplier(supplier: ReceivingSupplier): void {
    this.receiptForm.controls.supplierId.setValue(supplier.id);
    this.supplierQuery.set(supplier.name);
    this.supplierPickerOpen.set(false);
  }

  createLine(initial: any = {}) {
    return this.formBuilder.group({
      purchaseOrderLineId: [initial.purchaseOrderLineId ?? ''], productId: [initial.productId ?? '', Validators.required], batchNumber: [initial.batchNumber ?? '', Validators.required], expiryDate: [initial.expiryDate ?? '', Validators.required], purchaseUnit: [initial.purchaseUnit ?? 'box', Validators.required],
      packQuantity: [initial.packQuantity ?? 1, [Validators.required, Validators.min(.01)]], unitsPerPack: [initial.unitsPerPack ?? 1, [Validators.required, Validators.min(.01)]],
      purchasePricePerPack: [initial.purchasePricePerPack ?? null as number | null, [Validators.required, Validators.min(.01)]],
    });
  }

  addLine(): void { this.lines.push(this.createLine()); }
  removeLine(index: number): void { if (this.lines.length > 1) this.lines.removeAt(index); }
  onMedicineSelected(index: number): void {
    const control = this.lines.at(index);
    const medicine = this.medicines().find((item) => item.id === control.get('productId')?.value);
    if (!medicine) return;
    control.get('purchaseUnit')?.setValue(medicine.packageType ?? medicine.defaultPurchaseUnit ?? 'unit');
    const packageQuantity = Number(medicine.packageQuantity ?? medicine.defaultUnitsPerPack ?? 1);
    control.get('unitsPerPack')?.setValue(packageQuantity > 0 ? packageQuantity : 1);
  }
  lineQuantity(index: number): number { const value = this.lines.at(index).value; return Number(value.packQuantity || 0) * Number(value.unitsPerPack || 0); }
  unitCost(index: number): number { const value = this.lines.at(index).value; const units = Number(value.unitsPerPack || 0); return units > 0 ? Number(value.purchasePricePerPack || 0) / units : 0; }
  lineTotal(index: number): number { const value = this.lines.at(index).value; return Number(value.packQuantity || 0) * Number(value.purchasePricePerPack || 0); }
  medicineUnit(index: number): string { const productId = this.lines.at(index).get('productId')?.value; return this.medicines().find((medicine) => medicine.id === productId)?.unitOfMeasure ?? 'units'; }
  shopPrice(index: number): number { const productId = this.lines.at(index).get('productId')?.value; return Number(this.medicines().find((medicine) => medicine.id === productId)?.defaultSellingPrice ?? 0); }
  receiptTotal(): number { return this.lineControls.reduce((sum, _, index) => { const value = this.lines.at(index).value; return sum + Number(value.packQuantity || 0) * Number(value.purchasePricePerPack || 0); }, 0); }

  postReceipt(): void {
    if (this.receiptForm.invalid || this.posting()) { this.receiptForm.markAllAsTouched(); return; }
    if (!this.receiptForm.controls.purchaseOrderId.value && String(this.receiptForm.controls.directReceiptReason.value ?? '').trim().length < 10) {
      this.toast.error('Administrator direct receipts require a detailed override reason.');
      return;
    }
    this.posting.set(true);
    this.api.receivePharmacyStock(this.receiptForm.getRawValue()).subscribe({
      next: (receipt) => {
        this.posting.set(false); this.toast.success(`${receipt.receiptNumber} posted successfully.`);
        this.receiptForm.reset({ purchaseOrderId: '', supplierId: '', supplierInvoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '', receivedAt: new Date().toISOString().slice(0, 10), directReceiptReason: '', notes: '', lines: [] as any });
        this.supplierQuery.set('');
        this.lines.clear(); this.addLine(); this.loadReceipts();
      },
      error: (error) => { this.posting.set(false); this.toast.error(error?.error?.message ?? 'Stock receipt could not be posted.'); },
    });
  }

  goToInventory(): void { this.router.navigateByUrl('/pharmacy/inventory'); }
  goToSuppliers(): void { this.router.navigateByUrl('/pharmacy/suppliers'); }
  private loadReceipts(): void { this.api.getPharmacyGoodsReceipts().subscribe({ next: (receipts) => this.recentReceipts.set(receipts ?? []) }); }
  private loadPurchaseOrder(orderId: string): void {
    this.api.getPharmacyPurchaseOrderDetail(orderId).subscribe({
      next: (order) => {
        if (!['approved', 'partially_received'].includes(order.status)) { this.toast.error('This purchase order is not available for receiving.'); return; }
        this.receiptForm.controls.purchaseOrderId.setValue(order.id);
        this.receiptForm.controls.supplierId.setValue(order.supplier.id);
        this.supplierQuery.set(order.supplier.name);
        this.lines.clear();
        for (const line of order.lines) {
          const outstandingUnits = Math.max(0, Number(line.orderedUnits) - Number(line.receivedUnits));
          if (outstandingUnits <= 0) continue;
          this.lines.push(this.createLine({ purchaseOrderLineId: line.id, productId: line.productId, purchaseUnit: line.purchaseUnit, packQuantity: outstandingUnits / Number(line.unitsPerPack), unitsPerPack: Number(line.unitsPerPack), purchasePricePerPack: Number(line.unitCostPerPack) }));
        }
        if (this.lines.length === 0) { this.addLine(); this.toast.error('This purchase order has no outstanding medicine lines.'); }
      },
      error: (error) => this.toast.error(error?.error?.message ?? 'Purchase order could not be loaded.'),
    });
  }
}
