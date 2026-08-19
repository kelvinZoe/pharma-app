import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';

interface PharmacyBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  quantityReceived: number;
  quantityRemaining: number;
}

interface PharmacyProduct {
  id: string;
  productCode: string;
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  unitOfMeasure: string;
  reorderLevel: number;
  shelfLocation?: string;
  defaultSellingPrice?: number;
  stockOnHand: number;
  batches: PharmacyBatch[];
}

type StockFilter = 'all' | 'low' | 'out' | 'healthy';

@Component({
  selector: 'app-pharmacy-inventory-page',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inventory-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Active location stock</span>
          <h1>Stock Overview</h1>
          <p>Monitor quantities and expiry exposure here. Catalogue setup and supplier receiving are handled in their own workflows.</p>
        </div>
        <div class="header-actions">
          <a routerLink="/pharmacy/catalogue" class="button button--secondary">Medicine catalogue</a>
          <a routerLink="/pharmacy/receiving" class="button button--primary">Receive stock</a>
        </div>
      </header>

      <div class="stock-summary">
        <button type="button" [class.active]="stockFilter() === 'all'" (click)="stockFilter.set('all')"><span>Catalogue items</span><strong>{{ products().length }}</strong><small>Visible at this location</small></button>
        <button type="button" [class.active]="stockFilter() === 'healthy'" (click)="stockFilter.set('healthy')"><span>Healthy stock</span><strong>{{ healthyCount() }}</strong><small>Above reorder level</small></button>
        <button type="button" [class.active]="stockFilter() === 'low'" (click)="stockFilter.set('low')"><span>Low stock</span><strong>{{ lowStockCount() }}</strong><small>Requires replenishment</small></button>
        <button type="button" [class.active]="stockFilter() === 'out'" (click)="stockFilter.set('out')"><span>Out of stock</span><strong>{{ outOfStockCount() }}</strong><small>No sellable quantity</small></button>
        <div class="expiry-stat"><span>Expiry exposure</span><strong>{{ expiryAlertCount() }}</strong><small>Active batches within 90 days</small></div>
      </div>

      <div class="inventory-toolbar">
        <label class="search-field"><span class="sr-only">Search stock</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input type="search" autocomplete="off" placeholder="Search medicine, generic name, product code or batch" (input)="setSearch($event)" /></label>
        <label class="filter-field"><span class="sr-only">Filter expiry status</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg><select (change)="setExpiryFilter($event)"><option value="all">All expiry dates</option><option value="90">Expiring within 90 days</option><option value="30">Expiring within 30 days</option><option value="expired">Expired batches</option></select></label>
        <button type="button" class="refresh-button" [disabled]="loading()" (click)="loadProducts()">{{ loading() ? 'Refreshing…' : 'Refresh' }}</button>
      </div>

      @if (loadError()) {
        <div class="state-card state-card--error"><strong>Stock could not be loaded</strong><p>{{ loadError() }}</p><button type="button" class="button button--secondary" (click)="loadProducts()">Try again</button></div>
      } @else {
        <div class="stock-table-wrap">
          <table class="stock-table">
            <colgroup><col class="col-medicine" /><col class="col-location" /><col class="col-number" /><col class="col-number" /><col class="col-batches" /><col class="col-expiry" /><col class="col-status" /><col class="col-action" /></colgroup>
            <thead><tr><th>Medicine</th><th>Shelf / Bin</th><th>On hand</th><th>Reorder at</th><th>Active batches</th><th>Nearest expiry</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>
              @if (loading()) {
                @for (row of [1,2,3,4]; track row) { <tr class="skeleton-row"><td colspan="8"><span></span></td></tr> }
              } @else {
                @for (product of filteredProducts(); track product.id) {
                  <tr class="product-row" [class.expanded]="expandedProductId() === product.id">
                    <td><div class="medicine-cell"><strong>{{ product.name }}</strong><span>{{ product.genericName || product.productCode }}{{ product.strength ? ' · ' + product.strength : '' }}</span></div></td>
                    <td><div class="location-cell">@if (product.shelfLocation) {<strong>{{ product.shelfLocation }}</strong>} @else {<span class="location-unassigned">Not assigned</span>}</div></td>
                    <td><div class="quantity-cell"><strong>{{ product.stockOnHand | number:'1.0-2' }}</strong><span>{{ product.unitOfMeasure }}{{ product.stockOnHand === 1 ? '' : 's' }}</span></div></td>
                    <td>{{ product.reorderLevel | number:'1.0-2' }}</td>
                    <td>{{ activeBatches(product).length }}</td>
                    <td><span [class]="nearestExpiryClass(product)">{{ nearestExpiry(product) }}</span></td>
                    <td><span [class]="'status-indicator ' + stockStatusClass(product)">{{ stockStatusLabel(product) }}</span></td>
                    <td><button type="button" class="view-button" [attr.aria-expanded]="expandedProductId() === product.id" [attr.aria-label]="(expandedProductId() === product.id ? 'Hide batches for ' : 'View batches for ') + product.name" (click)="toggleProduct(product.id)"><span>{{ expandedProductId() === product.id ? 'Hide' : 'View batches' }}</span><svg viewBox="0 0 24 24" aria-hidden="true" [class.rotated]="expandedProductId() === product.id"><path d="m9 18 6-6-6-6"></path></svg></button></td>
                  </tr>
                  @if (expandedProductId() === product.id) {
                    <tr class="batch-detail-row"><td colspan="8">
                      <div class="batch-detail">
                        <header>
                          <div><span class="eyebrow">Batch ledger</span><h2>{{ product.name }}</h2><p>{{ activeBatches(product).length }} active batch{{ activeBatches(product).length === 1 ? '' : 'es' }} · {{ product.stockOnHand | number:'1.0-2' }} {{ product.unitOfMeasure }}{{ product.stockOnHand === 1 ? '' : 's' }} available</p></div>
                          <a routerLink="/pharmacy/receiving" class="receive-batch-action"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>Receive stock</a>
                        </header>
                        @if (product.batches.length) {
                          <div class="batch-table-wrap">
                            <table class="batch-table">
                              <thead><tr><th>Batch number</th><th>Stock balance</th><th>Unit cost</th><th>Selling price</th><th>Expiry date</th><th>Condition</th></tr></thead>
                              <tbody>
                                @for (batch of product.batches; track batch.id) {
                                  <tr [class.batch-expired]="daysUntil(batch.expiryDate) < 0">
                                    <td><code>{{ batch.batchNumber }}</code></td>
                                    <td><strong>{{ batch.quantityRemaining | number:'1.0-2' }}</strong><span> of {{ batch.quantityReceived | number:'1.0-2' }} received</span></td>
                                    <td>GHS {{ batch.purchasePrice | number:'1.2-4' }}</td>
                                    <td>GHS {{ batch.sellingPrice | number:'1.2-2' }}</td>
                                    <td>{{ batch.expiryDate | date:'mediumDate' }}</td>
                                    <td><span [class]="expiryClass(batch.expiryDate)">{{ expiryLabel(batch.expiryDate) }}</span></td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>
                        } @else {
                          <div class="batch-empty">
                            <div class="batch-empty__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Z"></path><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"></path><path d="M12 11v10"></path></svg></div>
                            <div><strong>No batches at this location</strong><p>Receive the first supplier batch to make this medicine available for sale.</p></div>
                            <a routerLink="/pharmacy/receiving">Receive first batch</a>
                          </div>
                        }
                      </div>
                    </td></tr>
                  }
                } @empty { <tr><td colspan="8" class="empty-cell">No stock items match the selected filters.</td></tr> }
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host{display:block}.inventory-page{display:grid;gap:1.2rem;max-width:1520px;margin:0 auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1.2rem;border-bottom:1px solid var(--app-border-color)}h1,h2,p{margin-top:0}h1{margin-bottom:.4rem;font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.04em}.page-header p{max-width:74ch;margin-bottom:0;color:var(--app-muted-text-color);line-height:1.6}.eyebrow{display:block;margin-bottom:.35rem;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.header-actions{display:flex;gap:.65rem}.button{display:inline-flex;align-items:center;justify-content:center;min-height:2.65rem;padding:.65rem 1rem;border-radius:.6rem;font-size:.8rem;font-weight:800;text-decoration:none}.button--primary{border:1px solid var(--app-primary-color);background:var(--app-primary-color);color:white}.button--secondary{border:1px solid var(--app-border-color);background:white;color:var(--app-text-color)}.stock-summary{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid var(--app-border-color);border-radius:.8rem;background:white;overflow:hidden}.stock-summary>button,.stock-summary>div{display:grid;gap:.2rem;min-width:0;padding:.95rem 1rem;border:0;border-right:1px solid var(--app-border-color);background:white;text-align:left}.stock-summary>*:last-child{border-right:0}.stock-summary button{font:inherit;cursor:pointer}.stock-summary button:hover,.stock-summary button.active{background:var(--app-primary-soft-color);box-shadow:inset 0 -3px 0 var(--app-primary-color)}.stock-summary span{color:var(--app-muted-text-color);font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.stock-summary strong{font-size:1.2rem}.stock-summary small{overflow:hidden;color:var(--app-muted-text-color);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.expiry-stat strong{color:#b54708}.inventory-toolbar{display:grid;grid-template-columns:minmax(300px,1fr) 220px auto;gap:.65rem}.search-field,.filter-field{position:relative;display:flex;align-items:center}.search-field svg,.filter-field svg{position:absolute;left:.82rem;z-index:1;width:1rem;height:1rem;fill:none;stroke:#64748b;stroke-width:1.8;stroke-linecap:round;pointer-events:none}.inventory-toolbar input,.inventory-toolbar select{width:100%;min-height:2.65rem;padding:0 .8rem 0 2.45rem;border:1px solid #cbd5e1;border-radius:.55rem;background:#fff;color:#0f172a!important;-webkit-text-fill-color:#0f172a;font:inherit;font-size:.78rem}.inventory-toolbar input::placeholder{color:#94a3b8;opacity:1}.inventory-toolbar select option{background:#fff;color:#0f172a}.refresh-button{padding:0 1rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 65%);border-radius:.55rem;background:var(--app-primary-soft-color);color:var(--app-primary-color);font:inherit;font-size:.76rem;font-weight:800;cursor:pointer}.stock-table-wrap{overflow-x:auto;border:1px solid var(--app-border-color);border-radius:.8rem;background:white}.stock-table{width:100%;min-width:1120px;border-collapse:collapse;table-layout:fixed}.col-medicine{width:20%}.col-location{width:11%}.col-number{width:10%}.col-batches{width:11%}.col-expiry{width:14%}.col-status{width:11%}.col-action{width:10%}th{padding:.68rem .85rem;background:#f8fafc;color:var(--app-muted-text-color);font-size:12px;letter-spacing:.055em;text-align:left;text-transform:uppercase;white-space:nowrap}td{padding:.62rem .85rem;border-top:1px solid var(--app-border-color);color:#1e293b;font-size:12px;vertical-align:middle}.stock-table tbody>.product-row>td{display:table-cell!important}.product-row{height:3.2rem;transition:background-color 140ms ease}.product-row:hover{background:#fbfdfd}.medicine-cell,.location-cell,.quantity-cell{display:grid;gap:.1rem}.medicine-cell strong{overflow:hidden;font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}.medicine-cell span,.location-cell span,.quantity-cell span{color:var(--app-muted-text-color);font-size:12px}.location-cell strong{font-size:12px}.location-unassigned{font-style:italic}.quantity-cell strong{font-size:.86rem}.expiry-safe,.expiry-warning,.expiry-critical,.expiry-expired{font-size:12px;font-weight:760}.expiry-safe{color:#067647}.expiry-warning{color:#b54708}.expiry-critical,.expiry-expired{color:#b42318}.status-indicator{display:inline-flex;align-items:center;gap:.38rem;font-size:12px;font-weight:780;white-space:nowrap}.status-indicator::before{content:'';width:.42rem;height:.42rem;border-radius:50%;background:currentColor}.status-healthy{color:#067647}.status-low{color:#b54708}.status-out{color:#b42318}.view-button{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:1.9rem;padding:.32rem .52rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 68%);border-radius:.42rem;background:white;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:820;white-space:nowrap;cursor:pointer;transition:background-color 140ms ease,border-color 140ms ease}.view-button:hover,.view-button[aria-expanded="true"]{border-color:var(--app-primary-color);background:var(--app-primary-soft-color)}.view-button svg{width:.8rem;height:.8rem;fill:none;stroke:currentColor;stroke-width:2;transition:transform 160ms ease}.view-button svg.rotated{transform:rotate(90deg)}.expanded{background:color-mix(in srgb,var(--app-primary-soft-color),white 52%)}.batch-detail-row>td{display:table-cell!important;padding:0}.batch-detail{display:grid;gap:.75rem;padding:.82rem 1rem .9rem;border-left:3px solid var(--app-primary-color);background:#fbfdfd}.batch-detail>header{display:flex;align-items:center;justify-content:space-between;gap:1rem}.batch-detail h2{margin-bottom:0;font-size:.9rem}.batch-detail>header p{margin:.18rem 0 0;color:var(--app-muted-text-color);font-size:12px}.receive-batch-action{display:inline-flex;align-items:center;gap:.32rem;padding:.42rem .6rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 68%);border-radius:.42rem;background:white;color:var(--app-primary-color);font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}.receive-batch-action svg{width:.8rem;height:.8rem;fill:none;stroke:currentColor;stroke-width:2}.batch-table-wrap{overflow:hidden;border:1px solid var(--app-border-color);border-radius:.55rem;background:white}.batch-table{width:100%;border-collapse:collapse;table-layout:fixed}.batch-table th{padding:.5rem .65rem;background:#f8fafc;font-size:12px}.batch-table td{display:table-cell!important;padding:.56rem .65rem;border-top:1px solid var(--app-border-color);font-size:12px}.batch-table tbody tr:hover{background:#fbfdfd}.batch-table tr.batch-expired{background:#fffafa}.batch-table code{color:var(--app-primary-color);font-size:12px;font-weight:800}.batch-table td:nth-child(2) span{color:var(--app-muted-text-color);font-size:12px}.batch-empty{display:flex;align-items:center;gap:.8rem;padding:.78rem .85rem;border:1px dashed color-mix(in srgb,var(--app-primary-color),white 60%);border-radius:.55rem;background:white}.batch-empty__icon{display:grid;place-items:center;flex:0 0 2.2rem;width:2.2rem;height:2.2rem;border-radius:.5rem;background:var(--app-primary-soft-color);color:var(--app-primary-color)}.batch-empty__icon svg{width:1.15rem;height:1.15rem;fill:none;stroke:currentColor;stroke-width:1.7}.batch-empty>div:nth-child(2){display:grid;gap:.15rem;flex:1}.batch-empty strong{font-size:12px}.batch-empty p{margin:0;color:var(--app-muted-text-color);font-size:12px}.batch-empty>a{color:var(--app-primary-color);font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}.no-batches,.empty-cell,.state-card{padding:2rem;text-align:center;color:var(--app-muted-text-color)}.state-card{border:1px dashed var(--app-border-color);border-radius:.8rem;background:white}.state-card--error{color:#9f3128}.skeleton-row td{display:table-cell!important;padding:1rem}.skeleton-row span{display:block;height:1.4rem;border-radius:.4rem;background:linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9);background-size:200% 100%;animation:shimmer 1.3s infinite}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}input:focus,select:focus,button:focus-visible,a:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px}@keyframes shimmer{to{background-position:-200% 0}}@media(max-width:980px){.stock-summary{grid-template-columns:repeat(2,1fr)}.stock-summary>*{border-bottom:1px solid var(--app-border-color)}.batch-table{min-width:760px}.batch-table-wrap{overflow-x:auto}}@media(max-width:720px){.page-header{align-items:stretch;flex-direction:column}.header-actions{display:grid}.inventory-toolbar{grid-template-columns:1fr}.stock-summary{grid-template-columns:1fr}.stock-summary>button,.stock-summary>div{border-right:0}.batch-detail>header,.batch-empty{align-items:flex-start;flex-direction:column}.batch-empty>a{margin-left:3rem}}
  `,
})
export class PharmacyInventoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly products = signal<PharmacyProduct[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly search = signal('');
  readonly stockFilter = signal<StockFilter>('all');
  readonly expiryFilter = signal('all');
  readonly expandedProductId = signal('');

  readonly outOfStockCount = computed(() => this.products().filter((product) => product.stockOnHand <= 0).length);
  readonly lowStockCount = computed(() => this.products().filter((product) => product.stockOnHand > 0 && product.stockOnHand <= product.reorderLevel).length);
  readonly healthyCount = computed(() => this.products().filter((product) => product.stockOnHand > product.reorderLevel).length);
  readonly expiryAlertCount = computed(() => this.products().flatMap((product) => this.activeBatches(product)).filter((batch) => this.daysUntil(batch.expiryDate) <= 90).length);
  readonly filteredProducts = computed(() => {
    const query = this.search().trim().toLowerCase();
    const stockFilter = this.stockFilter();
    const expiryFilter = this.expiryFilter();
    return this.products().filter((product) => {
      const searchMatch = !query || [product.name, product.genericName, product.productCode, ...product.batches.map((batch) => batch.batchNumber)].some((value) => value?.toLowerCase().includes(query));
      const stockMatch = stockFilter === 'all' || (stockFilter === 'out' && product.stockOnHand <= 0) || (stockFilter === 'low' && product.stockOnHand > 0 && product.stockOnHand <= product.reorderLevel) || (stockFilter === 'healthy' && product.stockOnHand > product.reorderLevel);
      const days = product.batches.map((batch) => this.daysUntil(batch.expiryDate));
      const expiryMatch = expiryFilter === 'all' || (expiryFilter === 'expired' && days.some((day) => day < 0)) || (expiryFilter === '90' && days.some((day) => day >= 0 && day <= 90)) || (expiryFilter === '30' && days.some((day) => day >= 0 && day <= 30));
      return searchMatch && stockMatch && expiryMatch;
    });
  });

  ngOnInit(): void { this.loadProducts(); }
  loadProducts(): void { this.loading.set(true); this.loadError.set(''); this.api.getPharmacyProducts().subscribe({ next: (products) => { this.products.set(products ?? []); this.loading.set(false); }, error: (error) => { this.loadError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.loading.set(false); } }); }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  setExpiryFilter(event: Event): void { this.expiryFilter.set((event.target as HTMLSelectElement).value); }
  toggleProduct(productId: string): void { this.expandedProductId.set(this.expandedProductId() === productId ? '' : productId); }
  activeBatches(product: PharmacyProduct): PharmacyBatch[] { return product.batches.filter((batch) => batch.quantityRemaining > 0); }
  daysUntil(dateValue: string): number { const today = new Date(); today.setHours(0,0,0,0); return Math.ceil((new Date(dateValue).getTime() - today.getTime()) / 86_400_000); }
  expiryLabel(dateValue: string): string { const days = this.daysUntil(dateValue); if (days < 0) return 'Expired'; if (days === 0) return 'Expires today'; if (days <= 30) return `${days} days`; if (days <= 90) return `${Math.ceil(days / 30)} months`; return 'Safe'; }
  expiryClass(dateValue: string): string { const days = this.daysUntil(dateValue); if (days < 0) return 'expiry-expired'; if (days <= 30) return 'expiry-critical'; if (days <= 90) return 'expiry-warning'; return 'expiry-safe'; }
  nearestExpiry(product: PharmacyProduct): string { const batch = this.activeBatches(product).sort((left, right) => new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime())[0]; return batch ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(batch.expiryDate)) : '—'; }
  nearestExpiryClass(product: PharmacyProduct): string { const batch = this.activeBatches(product).sort((left, right) => new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime())[0]; return batch ? this.expiryClass(batch.expiryDate) : '' ; }
  stockStatusLabel(product: PharmacyProduct): string { if (product.stockOnHand <= 0) return 'Out of stock'; return product.stockOnHand <= product.reorderLevel ? 'Low stock' : 'Healthy'; }
  stockStatusClass(product: PharmacyProduct): string { if (product.stockOnHand <= 0) return 'status-out'; return product.stockOnHand <= product.reorderLevel ? 'status-low' : 'status-healthy'; }
}
