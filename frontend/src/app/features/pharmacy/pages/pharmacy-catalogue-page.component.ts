import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface CatalogueMedicine {
  id: string;
  medicineId?: string;
  medicine?: MedicineDefinition;
  productCode: string;
  name: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  routeOfAdministration?: string;
  therapeuticClass?: string;
  controlledClassification: string;
  taxCategory: string;
  isTaxExempt: boolean;
  storageInstructions?: string;
  lifecycleStatus: string;
  defaultPurchaseUnit?: string;
  defaultUnitsPerPack: number;
  packageType?: string;
  packageQuantity?: number;
  packageUnit?: string;
  packageSizeValue?: number;
  packageSizeUnit?: string;
  sellingUnit?: string;
  allowLooseSale?: boolean;
  minimumSaleQuantity?: number;
  manufacturer?: string;
  barcode?: string;
  description?: string;
  unitOfMeasure: string;
  reorderLevel: number;
  shelfLocation?: string;
  defaultSellingPrice?: number;
  isActive: boolean;
  isLocationActive?: boolean;
  isAvailableForSale?: boolean;
  stockOnHand: number;
  batches?: CatalogueBatch[];
}

interface MedicineDefinition {
  id: string;
  genericName: string;
  strengthDisplay: string;
  dosageForm: string;
  lifecycleStatus: string;
}

interface CatalogueBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantityReceived: number;
  quantityRemaining: number;
}

interface MedicineDetail extends CatalogueMedicine {
  metrics: {
    stockOnHand: number;
    availableStock: number;
    expiredStock: number;
    stockValue: number;
    averageCost: number;
    lastPurchaseCost?: number;
    nearestExpiry?: string;
    activeBatchCount: number;
    nearExpiryBatchCount: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  };
  stockMovements: Array<{
    id: string;
    movementType: string;
    quantity: number;
    unitCost?: number;
    createdAt: string;
    batch?: { batchNumber: string };
    createdByUser?: { fullName?: string; username?: string };
  }>;
}

@Component({
  selector: 'app-pharmacy-catalogue-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="catalogue-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Commercial product master</span>
          <h1>Product Catalogue</h1>
          <p>Turn clinical medicine definitions into purchasable and saleable packages. Branch price, shelf and reorder controls remain location-specific.</p>
        </div>
        <button type="button" class="button button--primary" (click)="openCreateForm()">Add packaged product</button>
      </header>

      <div class="summary-strip">
        <div><span>Packaged products</span><strong>{{ medicines().length }}</strong></div>
        <div><span>Active at this shop</span><strong>{{ activeCount() }}</strong></div>
        <div><span>Missing barcode</span><strong>{{ missingBarcodeCount() }}</strong></div>
      </div>

      <div class="catalogue-toolbar">
        <label class="search-field">
          <span class="sr-only">Search product catalogue</span>
          <input type="search" placeholder="Search name, generic, brand, code or barcode" (input)="setSearch($event)" />
        </label>
        <span>{{ filteredMedicines().length }} product{{ filteredMedicines().length === 1 ? '' : 's' }}</span>
      </div>

      @if (loading()) {
        <div class="state-card">Loading product catalogue…</div>
      } @else if (loadError()) {
        <div class="state-card state-card--error">
          <strong>Catalogue could not be loaded</strong>
          <p>{{ loadError() }}</p>
          <button type="button" class="button button--secondary" (click)="loadMedicines()">Try again</button>
        </div>
      } @else {
        <div class="catalogue-table-wrap">
          <table class="catalogue-table">
            <colgroup>
              <col class="column-medicine" />
              <col class="column-profile" />
              <col class="column-packaging" />
              <col class="column-shop" />
              <col class="column-status" />
              <col class="column-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Product</th>
                <th>Clinical profile</th>
                <th>Packaging</th>
                <th>Shop defaults</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (medicine of filteredMedicines(); track medicine.id) {
                <tr class="medicine-row" tabindex="0" role="button" [attr.aria-label]="'View details for ' + medicine.name" (click)="openDetails(medicine)" (keydown.enter)="openDetails(medicine)" (keydown.space)="$event.preventDefault(); openDetails(medicine)">
                  <td>
                    <div class="cell-stack medicine-name">
                      <strong>{{ medicine.name }}</strong>
                      <span>{{ medicine.genericName || medicine.brandName || 'Generic name not recorded' }}</span>
                    </div>
                    <code>{{ medicine.productCode }}</code>
                  </td>
                  <td>
                    <div class="meta-pills">
                      @if (medicine.dosageForm) { <span class="meta-pill">{{ medicine.dosageForm }}</span> }
                      @if (medicine.strength) { <span class="meta-pill">{{ medicine.strength }}</span> }
                      @if (medicine.routeOfAdministration) { <span class="meta-pill meta-pill--soft">{{ medicine.routeOfAdministration }}</span> }
                    </div>
                    <small>{{ medicine.therapeuticClass || 'Classification not recorded' }}</small>
                  </td>
                  <td>
                    <div class="cell-stack"><strong>{{ packageLabel(medicine) }}</strong><small>Sold by {{ medicine.sellingUnit || medicine.unitOfMeasure }}{{ medicine.allowLooseSale ? ' · loose sale allowed' : '' }}</small></div>
                  </td>
                  <td>
                    <div class="shop-defaults"><span><small>On hand</small><strong>{{ medicine.stockOnHand || 0 }}</strong></span><span><small>Reorder</small><strong>{{ medicine.reorderLevel }}</strong></span></div>
                    <small>{{ medicine.shelfLocation ? 'Shelf ' + medicine.shelfLocation : 'Shelf not assigned' }}</small>
                  </td>
                  <td>
                    <div class="status-stack">
                      <span class="lifecycle" [class.lifecycle--active]="medicine.lifecycleStatus === 'active'" [class.lifecycle--warning]="medicine.lifecycleStatus === 'discontinued'"><i></i>{{ lifecycleLabel(medicine.lifecycleStatus) }}</span>
                      @if (stockRisk(medicine); as risk) { <span class="meta-pill" [class.meta-pill--danger]="risk === 'Out of stock'" [class.meta-pill--alert]="risk === 'Low stock'">{{ risk }}</span> }
                      @if (hasNearExpiryBatch(medicine)) { <span class="meta-pill meta-pill--alert">Near expiry</span> }
                      @if (medicine.controlledClassification && medicine.controlledClassification !== 'none') { <span class="meta-pill meta-pill--controlled">Controlled</span> }
                    </div>
                  </td>
                  <td><button type="button" class="edit-button" (click)="$event.stopPropagation(); openEditForm(medicine)">Edit</button></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-cell">No packaged products match this search.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (detailOpen()) {
      <div class="drawer-backdrop" (click)="closeDetails()"></div>
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="medicine-detail-title">
        <header class="detail-header">
          <div>
            <span class="eyebrow">Medicine operations</span>
            <h2 id="medicine-detail-title">{{ selectedDetail()?.name || selectedMedicineName() }}</h2>
            @if (selectedDetail(); as detail) { <p>{{ detail.productCode }} · {{ detail.genericName || detail.brandName || detail.unitOfMeasure }}</p> }
          </div>
          <div class="detail-header__actions">
            @if (selectedDetail(); as detail) { <button type="button" class="button button--secondary" (click)="editFromDetails(detail)">Edit medicine</button> }
            <button type="button" class="close-button" aria-label="Close medicine details" (click)="closeDetails()">×</button>
          </div>
        </header>

        @if (detailLoading()) {
          <div class="detail-loading" aria-live="polite"><span></span><span></span><span></span><span></span></div>
        } @else if (detailError()) {
          <div class="state-card state-card--error"><strong>Medicine details could not be loaded</strong><p>{{ detailError() }}</p><button type="button" class="button button--secondary" (click)="reloadDetails()">Try again</button></div>
        } @else if (selectedDetail(); as detail) {
          <div class="detail-content">
            <section class="detail-metrics" aria-label="Medicine stock summary">
              <div><span>On hand</span><strong>{{ detail.metrics.stockOnHand | number:'1.0-2' }}</strong><small>{{ detail.unitOfMeasure }}</small></div>
              <div><span>Available</span><strong>{{ detail.metrics.availableStock | number:'1.0-2' }}</strong><small>{{ detail.metrics.activeBatchCount }} active batches</small></div>
              <div><span>Stock value</span><strong>GHS {{ detail.metrics.stockValue | number:'1.2-2' }}</strong><small>Current acquisition value</small></div>
              <div><span>Average cost</span><strong>GHS {{ detail.metrics.averageCost | number:'1.2-4' }}</strong><small>Weighted by available units</small></div>
            </section>

            @if (detail.metrics.isOutOfStock || detail.metrics.isLowStock || detail.metrics.nearExpiryBatchCount || detail.metrics.expiredStock) {
              <section class="risk-strip" aria-label="Stock alerts">
                @if (detail.metrics.isOutOfStock) { <span class="risk-item risk-item--danger"><strong>Out of stock</strong><small>No saleable units at this shop.</small></span> }
                @else if (detail.metrics.isLowStock) { <span class="risk-item risk-item--warning"><strong>Low stock</strong><small>Available quantity is at or below {{ detail.reorderLevel }}.</small></span> }
                @if (detail.metrics.nearExpiryBatchCount) { <span class="risk-item risk-item--warning"><strong>{{ detail.metrics.nearExpiryBatchCount }} near expiry</strong><small>Batch expires within 90 days.</small></span> }
                @if (detail.metrics.expiredStock) { <span class="risk-item risk-item--danger"><strong>{{ detail.metrics.expiredStock | number:'1.0-2' }} expired units</strong><small>Exclude these units from dispensing.</small></span> }
              </section>
            }

            <section class="detail-profile">
              <header><div><span class="section-kicker">Clinical and stock profile</span><h3>Medicine controls</h3></div></header>
              <dl>
                <div><dt>Clinical identity</dt><dd>{{ detail.genericName || 'Not recorded' }}{{ detail.strength ? ' · ' + detail.strength : '' }}{{ detail.dosageForm ? ' · ' + detail.dosageForm : '' }}</dd></div>
                <div><dt>Classification</dt><dd>{{ detail.therapeuticClass || 'Not classified' }}{{ detail.routeOfAdministration ? ' · ' + detail.routeOfAdministration : '' }}</dd></div>
                <div><dt>Dispensing</dt><dd>{{ detail.unitOfMeasure }}</dd></div>
                <div><dt>Storage</dt><dd>{{ detail.storageInstructions || 'No special instructions' }}</dd></div>
                <div><dt>Shop placement</dt><dd>{{ detail.shelfLocation || 'Shelf not assigned' }} · Reorder at {{ detail.reorderLevel }}</dd></div>
                <div><dt>Last purchase cost</dt><dd>{{ detail.metrics.lastPurchaseCost !== null && detail.metrics.lastPurchaseCost !== undefined ? ('GHS ' + (detail.metrics.lastPurchaseCost | number:'1.2-4')) : 'No purchases recorded' }}</dd></div>
              </dl>
            </section>

            <section class="detail-section">
              <header><div><span class="section-kicker">Batch ledger</span><h3>Stock by batch</h3></div><span>{{ detail.batches?.length || 0 }} recorded</span></header>
              <div class="detail-table-wrap">
                <table class="detail-table">
                  <thead><tr><th>Batch</th><th>Expiry</th><th>Remaining</th><th>Purchase cost</th><th>Selling price</th><th>State</th></tr></thead>
                  <tbody>
                    @for (batch of detail.batches || []; track batch.id) {
                      <tr><td><strong>{{ batch.batchNumber }}</strong></td><td>{{ batch.expiryDate | date:'mediumDate' }}</td><td>{{ batch.quantityRemaining | number:'1.0-2' }} / {{ batch.quantityReceived | number:'1.0-2' }}</td><td>GHS {{ batch.purchasePrice | number:'1.2-4' }}</td><td>GHS {{ batch.sellingPrice | number:'1.2-2' }}</td><td><span class="batch-state" [class.batch-state--danger]="isExpired(batch)" [class.batch-state--warning]="isBatchNearExpiry(batch)">{{ batchState(batch) }}</span></td></tr>
                    } @empty {
                      <tr><td colspan="6" class="detail-empty">No stock has been received for this medicine at the active shop.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="detail-section">
              <header><div><span class="section-kicker">Immutable history</span><h3>Recent stock movements</h3></div><span>Latest 30</span></header>
              <div class="movement-list">
                @for (movement of detail.stockMovements; track movement.id) {
                  <article><span class="movement-icon" [class.movement-icon--out]="movement.quantity < 0">{{ movement.quantity < 0 ? '−' : '+' }}</span><div><strong>{{ movementLabel(movement.movementType) }}</strong><small>{{ movement.batch?.batchNumber || 'No batch reference' }} · {{ movement.createdByUser?.fullName || movement.createdByUser?.username || 'System user' }}</small></div><strong [class.quantity-out]="movement.quantity < 0">{{ movement.quantity > 0 ? '+' : '' }}{{ movement.quantity | number:'1.0-2' }}</strong><time>{{ movement.createdAt | date:'medium' }}</time></article>
                } @empty {
                  <div class="detail-empty">No stock movements have been recorded yet.</div>
                }
              </div>
            </section>
          </div>
        }
      </aside>
    }

    @if (formOpen()) {
      <div class="drawer-backdrop" (click)="closeForm()"></div>
      <aside class="medicine-drawer" role="dialog" aria-modal="true" aria-labelledby="medicine-form-title">
        <header>
          <div>
            <span class="eyebrow">{{ editingId() ? 'Update product' : 'New packaged product' }}</span>
            <h2 id="medicine-form-title">{{ editingId() ? 'Edit product' : 'Add product' }}</h2>
          </div>
          <button type="button" class="close-button" aria-label="Close medicine form" (click)="closeForm()">×</button>
        </header>

        <form [formGroup]="medicineForm" (ngSubmit)="saveMedicine()">
          <fieldset>
            <legend><span>01</span><div><strong>Medicine and brand</strong><small>Select the clinical definition, then record the commercial brand sold by this product.</small></div></legend>
            <div class="form-grid">
              <label class="wide"><span>Medicine definition *</span><select formControlName="medicineId"><option value="">Select from Medicine Library</option>@for (medicine of medicineDefinitions(); track medicine.id) { <option [value]="medicine.id">{{ medicine.genericName }} · {{ medicine.strengthDisplay }} · {{ medicine.dosageForm }}</option> }</select></label>
              <label><span>Brand name</span><input formControlName="brandName" placeholder="Optional brand" /></label>
              <label><span>Manufacturer</span><input formControlName="manufacturer" placeholder="Manufacturer" /></label>
              <label><span>Barcode</span><input formControlName="barcode" placeholder="Scan or type barcode" /></label>
              <label><span>Product code</span><input formControlName="productCode" placeholder="Generated automatically" readonly /></label>
              <div class="generated-name wide"><span>Generated product name</span><strong>{{ productPreviewName() }}</strong></div>
            </div>
          </fieldset>

          <fieldset>
            <legend><span>02</span><div><strong>Package and selling unit</strong><small>Define exactly what suppliers deliver and the smallest unit the pharmacy sells.</small></div></legend>
            <div class="form-grid">
              <label><span>Package type *</span><select formControlName="packageType"><option value="">Select package</option><option value="box">Box</option><option value="pack">Pack</option><option value="carton">Carton</option><option value="bottle">Bottle</option><option value="tube">Tube</option><option value="vial">Vial</option><option value="sachet">Sachet</option><option value="unit">Single unit</option></select></label>
              <label><span>Units in package *</span><input type="number" min="1" step="1" formControlName="unitsPerPurchaseUnit" /></label>
              <label><span>Package content unit *</span><select formControlName="packageUnit"><option value="">Select unit</option>@for (unit of sellingUnits; track unit) { <option [value]="unit">{{ unit }}</option> }</select></label>
              <label><span>Selling unit *</span><select formControlName="sellingUnit"><option value="">Select unit</option>@for (unit of sellingUnits; track unit) { <option [value]="unit">{{ unit }}</option> }</select></label>
              <label><span>Package size</span><input type="number" min="0.01" step="any" formControlName="packageSizeValue" placeholder="e.g. 100" /></label>
              <label><span>Package size unit</span><select formControlName="packageSizeUnit"><option value="">Not applicable</option><option value="mL">mL</option><option value="L">L</option><option value="g">g</option><option value="kg">kg</option></select></label>
              <label><span>Minimum sale quantity *</span><input type="number" min="1" step="1" formControlName="minimumSaleQuantity" /></label>
              <label class="check-field"><input type="checkbox" formControlName="allowLooseSale" /><span><strong>Allow loose sale</strong><small>Staff may sell individual units from an opened package.</small></span></label>
            </div>
          </fieldset>

          <fieldset>
            <legend><span>03</span><div><strong>Branch setup and governance</strong><small>Configure how this product behaves at the active pharmacy shop.</small></div></legend>
            <div class="form-grid">
              <label><span>Reorder level *</span><input type="number" min="0" formControlName="reorderLevel" /></label>
              <label><span>Shelf / bin</span><input formControlName="shelfLocation" placeholder="A-04" /></label>
              <label><span>Default selling price</span><input type="number" min="0.01" step="0.01" formControlName="defaultSellingPrice" /></label>
              @if (editingId()) { <label class="wide"><span>Price change reason</span><input formControlName="priceChangeReason" placeholder="Required when the current shop price changes" /></label> }
              <label><span>Controlled classification</span><select formControlName="controlledClassification"><option value="none">Not controlled</option><option value="controlled">Controlled medicine</option><option value="narcotic">Narcotic</option><option value="psychotropic">Psychotropic</option></select></label>
              <label><span>Tax category</span><select formControlName="taxCategory"><option value="standard">Standard</option><option value="zero-rated">Zero-rated</option><option value="exempt">Exempt</option></select></label>
              <label><span>Lifecycle status</span><select formControlName="lifecycleStatus"><option value="active">Active</option><option value="archived">Archived</option><option value="discontinued">Discontinued</option></select></label>
              <label class="check-field"><input type="checkbox" formControlName="isAvailableForSale" /><span><strong>Available for sale</strong><small>Show this product at the active branch POS.</small></span></label>
              <label class="check-field"><input type="checkbox" formControlName="isTaxExempt" /><span><strong>Tax exempt</strong><small>Exclude this item from medicine tax calculations.</small></span></label>
              <label class="wide"><span>Storage instructions</span><textarea rows="2" formControlName="storageInstructions" placeholder="e.g. Store below 25°C and protect from light"></textarea></label>
              <label class="wide"><span>Description</span><textarea rows="3" formControlName="description" placeholder="Clinical or inventory notes"></textarea></label>
            </div>
          </fieldset>
          <footer>
            <button type="button" class="button button--secondary" (click)="closeForm()">Cancel</button>
            <button type="submit" class="button button--primary" [disabled]="medicineForm.invalid || saving()">{{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create product') }}</button>
          </footer>
        </form>
      </aside>
    }
  `,
  styles: `
    :host { display: block; }
    .catalogue-page { display: grid; gap: 1.25rem; max-width: 1480px; margin: 0 auto; }
    .page-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding-bottom: 1.2rem; border-bottom: 1px solid var(--app-border-color); }
    h1, h2, p { margin-top: 0; } h1 { margin-bottom: .4rem; font-size: clamp(1.8rem,3vw,2.5rem); letter-spacing: -.04em; } h2 { margin-bottom: 0; }
    .page-header p { max-width: 72ch; margin-bottom: 0; color: var(--app-muted-text-color); line-height: 1.6; }
    .eyebrow { display: block; margin-bottom: .35rem; color: var(--app-primary-color); font-size: 12px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
    .button { min-height: 2.65rem; padding: .65rem 1rem; border-radius: .6rem; font: inherit; font-size: .82rem; font-weight: 800; cursor: pointer; }
    .button--primary { border: 1px solid var(--app-primary-color); background: var(--app-primary-color); color: white; }
    .button--secondary { border: 1px solid var(--app-border-color); background: white; color: var(--app-text-color); }
    .button:disabled { cursor: not-allowed; opacity: .55; }
    .summary-strip { display: grid; grid-template-columns: repeat(3,1fr); border-block: 1px solid var(--app-border-color); }
    .summary-strip div { display: grid; gap: .25rem; padding: .9rem 1rem; border-right: 1px solid var(--app-border-color); } .summary-strip div:last-child { border-right: 0; }
    .summary-strip span { color: var(--app-muted-text-color); font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .summary-strip strong { font-size: 1.15rem; }
    .catalogue-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .catalogue-toolbar > span { color: var(--app-muted-text-color); font-size: .78rem; font-weight: 700; }
    .search-field { flex: 1; max-width: 620px; } .search-field input { width: 100%; min-height: 2.75rem; padding: 0 .85rem; border: 1px solid var(--app-border-color); border-radius: .6rem; background: white; }
    .catalogue-table-wrap { overflow-x: auto; border: 1px solid var(--app-border-color); border-radius: .8rem; background: white; }
    .catalogue-table { width: 100%; min-width: 1040px; table-layout: fixed; border-collapse: collapse; }
    .column-medicine { width: 25%; } .column-profile { width: 20%; } .column-packaging { width: 15%; } .column-shop { width: 18%; } .column-status { width: 14%; } .column-action { width: 8%; }
    th { padding: .8rem 1rem; background: #f8fafc; color: var(--app-muted-text-color); font-size: 12px; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
    td { height: 4.35rem; padding: .65rem 1rem; border-top: 1px solid var(--app-border-color); font-size: .78rem; line-height: 1.3; vertical-align: middle; }
    td:first-child { position: relative; padding-right: 4.8rem; } td small, .medicine-name span { color: var(--app-muted-text-color); font-size: 12px; }
    .cell-stack, .status-stack { display: grid; gap: .22rem; align-content: center; } .medicine-name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    code { position: absolute; top: 50%; right: 1rem; translate: 0 -50%; color: var(--app-primary-color); font-size: 12px; }
    .meta-pills { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .26rem; }
    .meta-pill { display: inline-flex; align-items: center; width: fit-content; min-height: 1.35rem; padding: .16rem .42rem; border: 1px solid #dbe5e3; border-radius: 999px; background: #f8fbfa; color: #334155; font-size: 12px; font-weight: 760; line-height: 1; }
    .meta-pill--soft { border-color: color-mix(in srgb,var(--app-primary-color),white 78%); background: var(--app-primary-soft-color); color: var(--app-primary-color); }
    .meta-pill--alert { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
    .meta-pill--danger { border-color: #fecaca; background: #fef2f2; color: #b42318; }
    .meta-pill--controlled { border-color: #cbd5e1; background: #f1f5f9; color: #334155; }
    .shop-defaults { display: grid; grid-template-columns: .8fr 1fr; gap: .7rem; } .shop-defaults span { display: grid; gap: .16rem; } .shop-defaults small { text-transform: uppercase; letter-spacing: .04em; } .shop-defaults strong { font-size: .75rem; }
    .lifecycle { display: inline-flex; align-items: center; gap: .42rem; color: #64748b; font-size: 12px; font-weight: 800; text-transform: capitalize; }
    .lifecycle i { width: .42rem; height: .42rem; border-radius: 50%; background: currentColor; }
    .lifecycle--active { color: var(--app-primary-color); } .lifecycle--warning { color: #b45309; }
    .edit-button { min-height: 2rem; padding: .35rem .65rem; border: 1px solid color-mix(in srgb,var(--app-primary-color),white 65%); border-radius: .45rem; background: white; color: var(--app-primary-color); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; transition: background .18s ease, transform .18s ease; } .edit-button:hover { background: var(--app-primary-soft-color); } .edit-button:active { transform: translateY(1px); }
    .medicine-row { cursor: pointer; transition: background .16s ease; } .medicine-row:hover { background: #f8fcfb; } .medicine-row:focus-visible { outline: 3px solid color-mix(in srgb,var(--app-primary-color),transparent 78%); outline-offset: -3px; }
    .state-card, .empty-cell { padding: 2rem; border: 1px dashed var(--app-border-color); border-radius: .8rem; background: white; text-align: center; color: var(--app-muted-text-color); }
    .state-card--error { color: #9f3128; }
    .drawer-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.42); backdrop-filter: blur(2px); }
    .medicine-drawer { position: fixed; inset: 0 0 0 auto; z-index: 81; width: min(720px,100%); overflow-y: auto; padding: 1.4rem; background: white; box-shadow: -18px 0 50px rgba(15,23,42,.16); }
    .detail-drawer { position: fixed; inset: 0 0 0 auto; z-index: 81; width: min(940px,100%); overflow-y: auto; background: #fff; box-shadow: -18px 0 50px rgba(15,23,42,.16); }
    .detail-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.15rem 1.35rem; border-bottom: 1px solid var(--app-border-color); background: rgba(255,255,255,.96); backdrop-filter: blur(12px); } .detail-header h2 { margin-bottom: .18rem; } .detail-header p { margin: 0; color: var(--app-muted-text-color); font-size: 12px; } .detail-header__actions { display: flex; align-items: center; gap: .65rem; }
    .detail-content { display: grid; gap: 1.15rem; padding: 1.25rem 1.35rem 2rem; }
    .detail-loading { display: grid; grid-template-columns: repeat(4,1fr); gap: .7rem; padding: 1.3rem; } .detail-loading span { height: 5rem; border-radius: .65rem; background: linear-gradient(90deg,#f1f5f4 25%,#fafcfc 50%,#f1f5f4 75%); background-size: 200% 100%; animation: detail-shimmer 1.3s infinite; } @keyframes detail-shimmer { to { background-position: -200% 0; } }
    .detail-metrics { display: grid; grid-template-columns: repeat(4,1fr); border-block: 1px solid var(--app-border-color); } .detail-metrics div { display: grid; gap: .18rem; padding: .85rem 1rem; border-right: 1px solid var(--app-border-color); } .detail-metrics div:last-child { border-right: 0; } .detail-metrics span,.detail-metrics small { color: var(--app-muted-text-color); font-size: 12px; } .detail-metrics span { font-weight: 850; letter-spacing: .06em; text-transform: uppercase; } .detail-metrics strong { font-size: 1.05rem; }
    .risk-strip { display: flex; flex-wrap: wrap; gap: .55rem; } .risk-item { display: grid; gap: .1rem; min-width: 185px; padding: .6rem .75rem; border-left: 3px solid currentColor; background: #f8fafc; } .risk-item strong { font-size: 12px; } .risk-item small { color: #64748b; font-size: 12px; } .risk-item--warning { color: #b45309; background: #fffbeb; } .risk-item--danger { color: #b42318; background: #fef2f2; }
    .detail-profile,.detail-section { border-top: 1px solid var(--app-border-color); padding-top: 1rem; } .detail-profile > header,.detail-section > header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; } .detail-profile h3,.detail-section h3 { margin: .1rem 0 0; font-size: .95rem; } .detail-section > header > span { color: var(--app-muted-text-color); font-size: 12px; font-weight: 750; } .section-kicker { color: var(--app-primary-color); font-size: 12px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
    .detail-profile dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0; border: 1px solid var(--app-border-color); border-radius: .65rem; overflow: hidden; } .detail-profile dl div { display: grid; gap: .2rem; padding: .7rem .8rem; border-bottom: 1px solid var(--app-border-color); } .detail-profile dl div:nth-child(odd) { border-right: 1px solid var(--app-border-color); } .detail-profile dl div:nth-last-child(-n+2) { border-bottom: 0; } dt { color: var(--app-muted-text-color); font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; } dd { margin: 0; font-size: 12px; }
    .detail-table-wrap { overflow-x: auto; border: 1px solid var(--app-border-color); border-radius: .65rem; } .detail-table { width: 100%; min-width: 720px; border-collapse: collapse; } .detail-table th { padding: .65rem .7rem; } .detail-table td { height: auto; padding: .65rem .7rem; font-size: 12px; } .detail-table td:first-child { position: static; padding-right: .7rem; } .batch-state { display: inline-flex; align-items: center; width: fit-content; color: var(--app-primary-color); font-size: 12px; font-weight: 800; } .batch-state--warning { color: #b45309; } .batch-state--danger { color: #b42318; }
    .movement-list { border: 1px solid var(--app-border-color); border-radius: .65rem; overflow: hidden; } .movement-list article { display: grid; grid-template-columns: 1.7rem 1fr .65fr .85fr; align-items: center; gap: .7rem; padding: .62rem .75rem; border-bottom: 1px solid var(--app-border-color); font-size: 12px; } .movement-list article:last-child { border-bottom: 0; } .movement-list article div { display: grid; gap: .12rem; } .movement-list small,.movement-list time { color: var(--app-muted-text-color); font-size: 12px; } .movement-icon { display: grid; place-items: center; width: 1.45rem; height: 1.45rem; border-radius: 50%; background: var(--app-primary-soft-color); color: var(--app-primary-color); font-weight: 900; } .movement-icon--out { background: #fef2f2; color: #b42318; } .quantity-out { color: #b42318; } .detail-empty { padding: 1.5rem; color: var(--app-muted-text-color); text-align: center; font-size: 12px; }
    .medicine-drawer > header { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--app-border-color); }
    .close-button { width: 2.5rem; height: 2.5rem; border: 1px solid var(--app-border-color); border-radius: 50%; background: white; font-size: 1.5rem; cursor: pointer; }
    form { display: grid; gap: 1.2rem; padding-top: 1.2rem; } fieldset { display: grid; gap: 1rem; margin: 0; padding: 0 0 1.25rem; border: 0; border-bottom: 1px solid var(--app-border-color); } fieldset:last-of-type { border-bottom: 0; } legend { display: flex; align-items: flex-start; gap: .7rem; width: 100%; padding: 0; } legend > span { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--app-primary-soft-color); color: var(--app-primary-color); font-size: 12px; font-weight: 850; } legend div { display: grid; gap: .15rem; } legend strong { font-size: .82rem; } legend small { color: var(--app-muted-text-color); font-size: 12px; font-weight: 500; } .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    label { display: grid; gap: .4rem; } label.wide { grid-column: 1/-1; } label > span { font-size: 12px; font-weight: 780; }
    input, select, textarea { width: 100%; min-height: 2.65rem; padding: .65rem .75rem; border: 1px solid var(--app-border-color); border-radius: .55rem; background: white; color: var(--app-text-color); font: inherit; }
    .check-field { grid-template-columns: auto 1fr; align-items: start; align-self: end; min-height: 2.65rem; padding: .6rem .7rem; border: 1px solid var(--app-border-color); border-radius: .55rem; background: #fbfdfd; } .check-field input { width: 1rem; min-height: 1rem; margin-top: .12rem; accent-color: var(--app-primary-color); } .check-field > span { display: grid; gap: .12rem; } .check-field small { color: var(--app-muted-text-color); font-size: 12px; font-weight: 500; line-height: 1.35; }
    .generated-name { display: grid; gap: .25rem; padding: .7rem .8rem; border-left: 3px solid var(--app-primary-color); background: var(--app-primary-soft-color); } .generated-name span { color: var(--app-muted-text-color); font-size: 12px; font-weight: 800; text-transform: uppercase; } .generated-name strong { font-size: .78rem; }
    input:focus, select:focus, textarea:focus, button:focus-visible { outline: 3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%); outline-offset: 2px; border-color: var(--app-primary-color); }
    form footer { display: flex; justify-content: flex-end; gap: .7rem; padding-top: 1rem; border-top: 1px solid var(--app-border-color); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    @media(max-width:760px){ .page-header,.detail-header{align-items:stretch;flex-direction:column}.summary-strip,.form-grid,.detail-metrics,.detail-profile dl{grid-template-columns:1fr}.summary-strip div,.detail-metrics div{border-right:0;border-bottom:1px solid var(--app-border-color)}.detail-profile dl div,.detail-profile dl div:nth-child(odd){border-right:0}.detail-profile dl div:nth-last-child(-n+2){border-bottom:1px solid var(--app-border-color)}.detail-profile dl div:last-child{border-bottom:0}label.wide{grid-column:auto}.catalogue-toolbar{align-items:stretch;flex-direction:column}.movement-list article{grid-template-columns:1.7rem 1fr auto}.movement-list time{grid-column:2/-1}.detail-header__actions{justify-content:space-between} }
  `,
})
export class PharmacyCataloguePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly medicines = signal<CatalogueMedicine[]>([]);
  readonly medicineDefinitions = signal<MedicineDefinition[]>([]);
  readonly sellingUnits = ['tablet', 'capsule', 'bottle', 'vial', 'ampoule', 'sachet', 'tube', 'dose', 'mL', 'g', 'unit'];
  readonly search = signal('');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly formOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly selectedDetail = signal<MedicineDetail | null>(null);
  readonly selectedMedicineId = signal('');
  readonly selectedMedicineName = signal('');
  readonly editingId = signal('');
  readonly saving = signal(false);
  readonly activeCount = computed(() => this.medicines().filter((medicine) => medicine.isActive && medicine.isAvailableForSale !== false).length);
  readonly missingBarcodeCount = computed(() => this.medicines().filter((medicine) => !medicine.barcode).length);
  readonly filteredMedicines = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.medicines();
    return this.medicines().filter((medicine) => [medicine.name, medicine.genericName, medicine.brandName, medicine.productCode, medicine.barcode].some((value) => value?.toLowerCase().includes(query)));
  });

  readonly medicineForm = this.formBuilder.group({
    medicineId: ['', Validators.required], brandName: [''], manufacturer: [''], barcode: [''], productCode: [''],
    packageType: ['', Validators.required], unitsPerPurchaseUnit: [1, [Validators.required, Validators.min(1)]], packageUnit: ['', Validators.required],
    packageSizeValue: [null as number | null, Validators.min(.01)], packageSizeUnit: [''], sellingUnit: ['', Validators.required],
    allowLooseSale: [false], minimumSaleQuantity: [1, [Validators.required, Validators.min(1)]], controlledClassification: ['none'],
    reorderLevel: [10, [Validators.required, Validators.min(0)]], shelfLocation: [''], defaultSellingPrice: [null as number | null, Validators.min(.01)], priceChangeReason: [''],
    isAvailableForSale: [true], taxCategory: ['standard'], isTaxExempt: [false], lifecycleStatus: ['active'], storageInstructions: [''], description: [''],
  });

  ngOnInit(): void { this.loadMedicines(); }

  loadMedicines(): void {
    this.loading.set(true); this.loadError.set('');
    forkJoin({ products: this.api.getPharmacyProducts(), definitions: this.api.getPharmacyMedicines() }).subscribe({
      next: ({ products, definitions }) => { this.medicines.set(products ?? []); this.medicineDefinitions.set((definitions ?? []).filter((medicine) => medicine.lifecycleStatus === 'active')); this.loading.set(false); },
      error: (error) => { this.loadError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.loading.set(false); },
    });
  }

  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }

  openDetails(medicine: CatalogueMedicine): void {
    this.selectedMedicineId.set(medicine.id);
    this.selectedMedicineName.set(medicine.name);
    this.selectedDetail.set(null);
    this.detailError.set('');
    this.detailOpen.set(true);
    this.loadDetail(medicine.id);
  }

  reloadDetails(): void { if (this.selectedMedicineId()) this.loadDetail(this.selectedMedicineId()); }

  closeDetails(): void { this.detailOpen.set(false); }

  editFromDetails(detail: MedicineDetail): void {
    this.closeDetails();
    this.openEditForm(detail);
  }

  stockRisk(medicine: CatalogueMedicine): string {
    const available = this.availableStock(medicine);
    if (available <= 0) return 'Out of stock';
    if (available <= Number(medicine.reorderLevel || 0)) return 'Low stock';
    return '';
  }

  hasNearExpiryBatch(medicine: CatalogueMedicine): boolean { return (medicine.batches ?? []).some((batch) => batch.quantityRemaining > 0 && !this.isExpired(batch) && this.isBatchNearExpiry(batch)); }
  isExpired(batch: CatalogueBatch): boolean { return new Date(batch.expiryDate).getTime() < Date.now(); }
  isBatchNearExpiry(batch: CatalogueBatch): boolean { const expiry = new Date(batch.expiryDate).getTime(); return expiry >= Date.now() && expiry <= Date.now() + 90 * 86_400_000; }
  batchState(batch: CatalogueBatch): string { if (batch.quantityRemaining <= 0) return 'Exhausted'; if (this.isExpired(batch)) return 'Expired'; if (this.isBatchNearExpiry(batch)) return 'Near expiry'; return 'Available'; }
  movementLabel(type: string): string { return type.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }

  openCreateForm(): void {
    this.editingId.set('');
    this.medicineForm.reset({ medicineId: '', brandName: '', manufacturer: '', barcode: '', productCode: '', packageType: '', unitsPerPurchaseUnit: 1, packageUnit: '', packageSizeValue: null, packageSizeUnit: '', sellingUnit: '', allowLooseSale: false, minimumSaleQuantity: 1, controlledClassification: 'none', reorderLevel: 10, shelfLocation: '', defaultSellingPrice: null, priceChangeReason: '', isAvailableForSale: true, taxCategory: 'standard', isTaxExempt: false, lifecycleStatus: 'active', storageInstructions: '', description: '' });
    this.formOpen.set(true);
  }

  openEditForm(medicine: CatalogueMedicine): void {
    this.editingId.set(medicine.id);
    this.medicineForm.reset({
      medicineId: medicine.medicineId ?? medicine.medicine?.id ?? '', brandName: medicine.brandName ?? '', manufacturer: medicine.manufacturer ?? '', barcode: medicine.barcode ?? '', productCode: medicine.productCode ?? '',
      packageType: medicine.packageType ?? medicine.defaultPurchaseUnit ?? 'unit', unitsPerPurchaseUnit: medicine.packageQuantity ?? medicine.defaultUnitsPerPack ?? 1, packageUnit: medicine.packageUnit ?? medicine.unitOfMeasure,
      packageSizeValue: medicine.packageSizeValue ?? null, packageSizeUnit: medicine.packageSizeUnit ?? '', sellingUnit: medicine.sellingUnit ?? medicine.unitOfMeasure,
      allowLooseSale: medicine.allowLooseSale ?? false, minimumSaleQuantity: medicine.minimumSaleQuantity ?? 1, controlledClassification: medicine.controlledClassification ?? 'none',
      reorderLevel: medicine.reorderLevel, shelfLocation: medicine.shelfLocation ?? '', defaultSellingPrice: medicine.defaultSellingPrice ?? null, priceChangeReason: '', isAvailableForSale: medicine.isAvailableForSale !== false, taxCategory: medicine.taxCategory ?? 'standard', isTaxExempt: medicine.isTaxExempt ?? false,
      lifecycleStatus: medicine.lifecycleStatus ?? (medicine.isActive ? 'active' : 'archived'), storageInstructions: medicine.storageInstructions ?? '', description: medicine.description ?? '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void { if (!this.saving()) this.formOpen.set(false); }

  lifecycleLabel(status: string): string { return status === 'discontinued' ? 'Discontinued' : status === 'archived' ? 'Archived' : 'Active'; }

  packageLabel(product: CatalogueMedicine): string {
    const packageType = product.packageType ?? product.defaultPurchaseUnit;
    const quantity = Number(product.packageQuantity ?? product.defaultUnitsPerPack ?? 1);
    const unit = product.packageUnit ?? product.sellingUnit ?? product.unitOfMeasure;
    return packageType ? `${packageType} of ${quantity} ${unit}` : `${quantity} ${unit}`;
  }

  productPreviewName(): string {
    const value = this.medicineForm.getRawValue();
    const medicine = this.medicineDefinitions().find((definition) => definition.id === value.medicineId);
    if (!medicine) return 'Select a medicine definition';
    const identity = value.brandName?.trim() || medicine.genericName;
    const packageText = value.packageType ? ` — ${value.packageType} of ${Number(value.unitsPerPurchaseUnit || 1)} ${value.packageUnit || value.sellingUnit || 'units'}` : '';
    return `${identity} ${medicine.strengthDisplay} ${medicine.dosageForm}${packageText}`;
  }

  saveMedicine(): void {
    if (this.medicineForm.invalid || this.saving()) return;
    this.saving.set(true);
    const data = this.medicineForm.getRawValue();
    const request = this.editingId() ? this.api.updatePharmacyProduct(this.editingId(), data) : this.api.createPharmacyProduct(data);
    request.subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success(this.editingId() ? 'Product updated.' : 'Packaged product added.'); this.loadMedicines(); },
      error: (error) => { this.saving.set(false); this.toast.error(error?.error?.message ?? 'Product could not be saved.'); },
    });
  }

  private availableStock(medicine: CatalogueMedicine): number {
    return (medicine.batches ?? []).filter((batch) => batch.quantityRemaining > 0 && !this.isExpired(batch)).reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
  }

  private loadDetail(productId: string): void {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.api.getPharmacyProductDetail(productId).subscribe({
      next: (detail) => { this.selectedDetail.set(detail); this.detailLoading.set(false); },
      error: (error) => { this.detailError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.detailLoading.set(false); },
    });
  }
}
