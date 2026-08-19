import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../../core/auth/session.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-pharmacy-network-stock-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="network-page">
      <header class="page-header"><div><span class="eyebrow">Multi-shop intelligence</span><h1>Network Stock</h1><p>Compare location availability, detect shortages and excess, and turn safe FEFO recommendations into controlled transfer requests.</p></div><button type="button" class="button" (click)="load()">Refresh network</button></header>

      <section class="metrics"><div><span>Catalogue medicines</span><strong>{{ data()?.summary?.products || 0 }}</strong></div><div><span>Shortage lines</span><strong>{{ data()?.summary?.shortageLines || 0 }}</strong></div><div><span>Excess lines</span><strong>{{ data()?.summary?.excessLines || 0 }}</strong></div><div class="warning"><span>Quarantined</span><strong>{{ data()?.summary?.quarantinedUnits || 0 | number:'1.0-2' }}</strong></div><div class="danger"><span>Expired</span><strong>{{ data()?.summary?.expiredUnits || 0 | number:'1.0-2' }}</strong></div><div><span>In transit</span><strong>{{ data()?.summary?.inTransitUnits || 0 | number:'1.0-2' }}</strong></div></section>

      <nav class="tabs"><button type="button" [class.active]="tab() === 'comparison'" (click)="tab.set('comparison')">Location comparison</button><button type="button" [class.active]="tab() === 'recommendations'" (click)="tab.set('recommendations')">Replenishment <span>{{ activeRecommendations().length }}</span></button><button type="button" [class.active]="tab() === 'quarantine'" (click)="tab.set('quarantine')">Quarantine <span>{{ quarantine().length }}</span></button></nav>

      <div class="toolbar"><div class="filters">@for (filter of stockFilters; track filter.value) { <button type="button" [class.active]="stockFilter() === filter.value" (click)="stockFilter.set(filter.value)">{{ filter.label }}</button> }</div><label><span class="sr-only">Search network stock</span><input type="search" [value]="search()" placeholder="Search medicine or code" (input)="search.set($any($event.target).value)" (keydown.enter)="load()" /></label><button type="button" class="button primary" (click)="load()">Search</button></div>

      @if (loading()) { <div class="state">Calculating stock positions and demand…</div> }
      @else if (error()) { <div class="state error"><strong>Network stock could not be calculated</strong><p>{{ error() }}</p><button type="button" class="button" (click)="load()">Try again</button></div> }
      @else if (tab() === 'comparison') {
        <div class="table-wrap"><table><thead><tr><th>Medicine</th><th>Location</th><th>On hand</th><th>Available</th><th>Reserved</th><th>Quarantine</th><th>Expired</th><th>Transit in</th><th>Daily use</th><th>Days cover</th><th>Target</th><th>Position</th><th>Policy</th></tr></thead><tbody>
          @for (row of filteredRows(); track row.location.id + ':' + row.product.id) { <tr><td><strong>{{ row.product.name }}</strong><small>{{ row.product.productCode }} · {{ row.product.unitOfMeasure }}</small></td><td><strong>{{ row.location.code }}</strong><small>{{ row.location.name }}</small></td><td>{{ row.onHand | number:'1.0-2' }}</td><td><strong>{{ row.available | number:'1.0-2' }}</strong></td><td>{{ row.reserved | number:'1.0-2' }}</td><td [class.danger-text]="row.quarantined > 0">{{ row.quarantined | number:'1.0-2' }}</td><td [class.danger-text]="row.expired > 0">{{ row.expired | number:'1.0-2' }}</td><td>{{ row.inTransitIn | number:'1.0-2' }}</td><td>{{ row.averageDailyUsage | number:'1.0-2' }}</td><td>{{ row.daysOfStock === null ? '—' : (row.daysOfStock | number:'1.0-1') }}</td><td>{{ row.targetStock | number:'1.0-2' }}</td><td>@if(row.shortage > 0){<span class="position shortage">−{{row.shortage|number:'1.0-2'}} shortage</span>}@else if(row.transferableExcess > 0){<span class="position excess">+{{row.transferableExcess|number:'1.0-2'}} transferable</span>}@else{<span class="position balanced">Balanced</span>}</td><td>@if(session.isAdmin()){<button type="button" class="text-button" (click)="openPolicy(row)">Edit</button>}@else{<span>{{row.reorderLevel}} / {{row.safetyStock}}</span>}</td></tr> }
          @empty { <tr><td colspan="13" class="empty">No location stock rows match this view.</td></tr> }
        </tbody></table></div>
      } @else if (tab() === 'recommendations') {
        <section class="recommendations">
          @for (recommendation of activeRecommendations(); track recommendation.id) {
            <article><header><div><span class="section-label">{{ recommendation.product.productCode }}</span><h2>{{ recommendation.product.name }}</h2></div><strong>{{ recommendation.recommendedQuantity | number:'1.0-2' }} {{ recommendation.product.unitOfMeasure }}</strong></header><div class="route"><span><small>Source</small><b>{{ recommendation.sourceLocation.code }}</b><em>{{ recommendation.sourceLocation.name }}</em></span><i>→</i><span><small>Destination</small><b>{{ recommendation.destinationLocation.code }}</b><em>{{ recommendation.destinationLocation.name }}</em></span></div><div class="recommendation-stats"><span>Destination shortage <strong>{{ recommendation.shortage | number:'1.0-2' }}</strong></span><span>Donor excess <strong>{{ recommendation.donorExcess | number:'1.0-2' }}</strong></span><span>Daily use <strong>{{ recommendation.averageDailyUsage | number:'1.0-2' }}</strong></span></div><div class="batch-plan">@for(line of recommendation.suggestedLines;track line.sourceBatchId){<span><b>{{line.batchNumber}}</b><em>{{line.quantity|number:'1.0-2'}} · exp {{line.expiryDate|date:'mediumDate'}}</em>@if(line.nearExpiry){<small>Near-expiry demand checked</small>}</span>}</div><footer><p>{{ recommendation.rationale }}</p>@if(recommendation.canCreateFromActiveLocation){<button type="button" class="button primary" [disabled]="creatingRecommendation() === recommendation.id" (click)="createRecommendedTransfer(recommendation)">{{ creatingRecommendation() === recommendation.id ? 'Creating…' : 'Create transfer request' }}</button>}@else{<button type="button" class="button" (click)="switchToDonor(recommendation)">Switch to {{recommendation.sourceLocation.code}}</button>}</footer></article>
          } @empty { <div class="state"><strong>No safe transfer recommendations</strong><p>Either locations are balanced or donor stock cannot safely cover current shortages.</p></div> }
        </section>
      } @else {
        <div class="table-wrap"><table><thead><tr><th>Medicine / batch</th><th>Expiry</th><th>On hand</th><th>Quarantined</th><th>Available</th><th>Unit cost</th><th>Resolution</th></tr></thead><tbody>
          @for(batch of quarantine();track batch.id){<tr><td><strong>{{batch.product.name}}</strong><small>{{batch.product.productCode}} · {{batch.batchNumber}}</small></td><td>{{batch.expiryDate|date:'mediumDate'}}</td><td>{{batch.quantityRemaining|number:'1.0-2'}}</td><td><strong class="danger-text">{{batch.quantityQuarantined|number:'1.0-2'}}</strong></td><td>{{available(batch)|number:'1.0-2'}}</td><td>GHS {{batch.purchasePrice|number:'1.2-4'}}</td><td>@if(session.isAdmin()){<div class="row-actions"><button type="button" class="text-button" (click)="resolveQuarantine(batch,'release')">Release</button><button type="button" class="text-button danger-text" (click)="resolveQuarantine(batch,'write_off')">Write off</button></div>}@else{Awaiting administrator}</td></tr>}
          @empty{<tr><td colspan="7" class="empty">No quarantined stock at the active location.</td></tr>}
        </tbody></table></div>
      }
    </section>

    @if(policyOpen()) { <div class="backdrop" (click)="policyOpen.set(false)"></div><aside class="policy-drawer" role="dialog" aria-modal="true" aria-labelledby="policy-title"><header><div><span class="eyebrow">Location policy</span><h2 id="policy-title">{{ policyRow()?.product.name }}</h2><p>{{ policyRow()?.location.code }} · {{ policyRow()?.location.name }}</p></div><button type="button" class="close" aria-label="Close policy form" (click)="policyOpen.set(false)">×</button></header><form [formGroup]="policyForm" (ngSubmit)="savePolicy()"><div class="policy-guide"><strong>How the recommendation is calculated</strong><p>Target stock combines recent daily usage, supplier lead time, target cover days, reorder level, safety stock, current availability, and incoming transfers.</p></div><label><span>Reorder level</span><input type="number" min="0" step="0.01" formControlName="reorderLevel" /></label><label><span>Safety stock</span><input type="number" min="0" step="0.01" formControlName="safetyStock" /></label><label><span>Maximum stock</span><input type="number" min="0" step="0.01" formControlName="maximumStock" /><small>Leave blank to calculate from demand.</small></label><label><span>Supplier lead time (days)</span><input type="number" min="0" step="1" formControlName="supplierLeadTimeDays" /></label><label><span>Target cover (days)</span><input type="number" min="1" step="1" formControlName="targetCoverDays" /></label><footer><button type="button" class="button" (click)="policyOpen.set(false)">Cancel</button><button type="submit" class="button primary" [disabled]="policyForm.invalid || savingPolicy()">Save policy</button></footer></form></aside> }
  `,
  styles: `
    .metrics{grid-template-columns:repeat(6,1fr)!important}.metrics .danger strong{color:#b42318}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:650px){.metrics{grid-template-columns:1fr!important}}
    :host{display:block}.network-page{display:grid;gap:1rem;max-width:1580px;margin:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1rem;border-bottom:1px solid var(--app-border-color)}h1,h2,p{margin-top:0}h1{margin-bottom:.35rem;font-size:clamp(1.9rem,3vw,2.5rem);letter-spacing:-.045em}.page-header p{max-width:78ch;margin:0;color:var(--app-muted-text-color);line-height:1.5}.eyebrow,.section-label{display:block;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(5,1fr);border-block:1px solid var(--app-border-color)}.metrics div{display:grid;gap:.15rem;padding:.75rem 1rem;border-right:1px solid var(--app-border-color)}.metrics div:last-child{border:0}.metrics span{color:var(--app-muted-text-color);font-size:12px;font-weight:850;text-transform:uppercase}.metrics strong{font-size:1.02rem}.metrics .warning strong{color:#b54708}.tabs{display:flex;gap:.28rem}.tabs button{min-height:2.2rem;padding:.4rem .7rem;border:1px solid var(--app-border-color);border-radius:.45rem;background:#fff;color:#64748b;font:inherit;font-size:12px;font-weight:820;cursor:pointer}.tabs button.active{border-color:var(--app-primary-color);background:var(--app-primary-soft-color);color:var(--app-primary-color)}.tabs span{display:inline-grid;place-items:center;min-width:1.15rem;height:1.15rem;margin-left:.28rem;border-radius:999px;background:#e9f3f1;font-size:12px}.toolbar{display:grid;grid-template-columns:auto minmax(240px,1fr) auto;align-items:center;gap:.55rem}.filters{display:flex;gap:.28rem}.filters button{min-height:2rem;padding:.32rem .62rem;border:1px solid var(--app-border-color);border-radius:999px;background:#fff;color:#64748b;font:inherit;font-size:12px;font-weight:780;cursor:pointer}.filters button.active{border-color:var(--app-primary-color);color:var(--app-primary-color)}input{width:100%;min-height:2.45rem;padding:.5rem .62rem;border:1px solid var(--app-border-color);border-radius:.46rem;background:#fff;color:var(--app-text-color);font:inherit}.button{min-height:2.4rem;padding:.52rem .78rem;border:1px solid var(--app-border-color);border-radius:.48rem;background:#fff;color:var(--app-text-color);font:inherit;font-size:12px;font-weight:820;cursor:pointer}.button.primary{border-color:var(--app-primary-color);background:var(--app-primary-color);color:#fff}.button:disabled{opacity:.5}.table-wrap{overflow:auto;border:1px solid var(--app-border-color);border-radius:.68rem;background:#fff}table{width:100%;min-width:1280px;border-collapse:collapse}th{padding:.64rem .7rem;background:#f7faf9;color:var(--app-muted-text-color);font-size:12px;letter-spacing:.05em;text-align:left;text-transform:uppercase}td{padding:.56rem .7rem;border-top:1px solid var(--app-border-color);font-size:12px;vertical-align:middle}td>strong,td>small{display:block}td small{margin-top:.12rem;color:var(--app-muted-text-color);font-size:12px}.position{display:inline-flex;width:max-content;padding:.18rem .38rem;border-radius:999px;font-size:12px;font-weight:820}.position.shortage{background:#fef2f2;color:#b42318}.position.excess{background:#ecfdf5;color:#087f6a}.position.balanced{background:#f1f5f9;color:#64748b}.danger-text{color:#b42318!important}.text-button{border:0;background:transparent;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:820;cursor:pointer}.row-actions{display:flex;gap:.45rem}.state,.empty{padding:2rem;text-align:center;color:var(--app-muted-text-color)}.state.error{color:#9f3128}.recommendations{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:.75rem}.recommendations article{display:grid;gap:.8rem;padding:.9rem;border:1px solid var(--app-border-color);border-top:3px solid var(--app-primary-color);border-radius:.65rem;background:#fff}.recommendations article>header{display:flex;align-items:start;justify-content:space-between;gap:1rem}.recommendations h2{margin:.12rem 0 0;font-size:.9rem}.recommendations article>header>strong{color:var(--app-primary-color);font-size:.82rem}.route{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.6rem;padding:.55rem 0;border-block:1px solid var(--app-border-color)}.route span{display:grid}.route span:last-child{text-align:right}.route small,.route em{color:var(--app-muted-text-color);font-size:12px;font-style:normal}.route b{font-size:12px}.route i{color:var(--app-primary-color);font-style:normal}.recommendation-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem}.recommendation-stats span{display:grid;gap:.1rem;color:var(--app-muted-text-color);font-size:12px}.recommendation-stats strong{color:var(--app-text-color);font-size:12px}.batch-plan{display:grid;gap:.28rem}.batch-plan>span{display:grid;grid-template-columns:.5fr 1fr auto;gap:.45rem;padding:.35rem .45rem;background:#f8fafc;font-size:12px}.batch-plan em{color:var(--app-muted-text-color);font-style:normal}.batch-plan small{color:#b54708}.recommendations footer{display:flex;align-items:end;justify-content:space-between;gap:.7rem}.recommendations footer p{margin:0;color:var(--app-muted-text-color);font-size:12px}.backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.42)}.policy-drawer{position:fixed;inset:0 0 0 auto;z-index:81;width:min(520px,100%);overflow:auto;background:#fff;box-shadow:-18px 0 50px rgba(15,23,42,.16)}.policy-drawer>header{display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid var(--app-border-color)}.policy-drawer h2{margin:.15rem 0}.policy-drawer header p{margin:0;color:var(--app-muted-text-color);font-size:12px}.close{width:2.2rem;height:2.2rem;border:1px solid var(--app-border-color);border-radius:50%;background:#fff;font-size:1.3rem}.policy-drawer form{display:grid;gap:.72rem;padding:1rem}.policy-drawer label{display:grid;gap:.3rem}.policy-drawer label>span{font-size:12px;font-weight:800}.policy-drawer label small{color:var(--app-muted-text-color);font-size:12px}.policy-guide{padding:.65rem;border-left:3px solid var(--app-primary-color);background:var(--app-primary-soft-color)}.policy-guide strong{font-size:12px}.policy-guide p{margin:.2rem 0 0;color:var(--app-muted-text-color);font-size:12px;line-height:1.45}.policy-drawer footer{display:flex;justify-content:flex-end;gap:.5rem;padding-top:.7rem;border-top:1px solid var(--app-border-color)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}input:focus,button:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.toolbar{grid-template-columns:1fr}.filters,.tabs{overflow:auto}}@media(max-width:650px){.page-header,.recommendations footer{align-items:stretch;flex-direction:column}.recommendation-stats{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}}
  `,
})
export class PharmacyNetworkStockPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly session = inject(SessionService);

  readonly data = signal<any>(null);
  readonly quarantine = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<'comparison' | 'recommendations' | 'quarantine'>('comparison');
  readonly stockFilter = signal<'all' | 'shortage' | 'excess' | 'quarantine'>('all');
  readonly search = signal('');
  readonly policyOpen = signal(false);
  readonly policyRow = signal<any>(null);
  readonly savingPolicy = signal(false);
  readonly creatingRecommendation = signal('');
  readonly stockFilters = [{ label: 'All stock', value: 'all' as const }, { label: 'Shortages', value: 'shortage' as const }, { label: 'Transferable excess', value: 'excess' as const }, { label: 'Quarantined', value: 'quarantine' as const }];

  readonly filteredRows = computed(() => (this.data()?.rows ?? []).filter((row: any) => this.stockFilter() === 'all' || (this.stockFilter() === 'shortage' ? row.shortage > 0 : this.stockFilter() === 'excess' ? row.transferableExcess > 0 : row.quarantined > 0)));
  readonly activeRecommendations = computed(() => this.data()?.recommendations ?? []);
  readonly policyForm = this.fb.group({ reorderLevel: [0, [Validators.required, Validators.min(0)]], safetyStock: [0, [Validators.required, Validators.min(0)]], maximumStock: [null as number | null, Validators.min(0)], supplierLeadTimeDays: [7, [Validators.required, Validators.min(0)]], targetCoverDays: [14, [Validators.required, Validators.min(1)]] });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ network: this.api.getPharmacyNetworkStock(this.search().trim()), quarantine: this.api.getPharmacyQuarantinedStock() }).subscribe({
      next: (result) => { this.data.set(result.network); this.quarantine.set(result.quarantine ?? []); this.loading.set(false); },
      error: (error) => { this.loading.set(false); this.error.set(error?.error?.message ?? 'Check your connection and active location.'); },
    });
  }

  openPolicy(row: any): void {
    this.policyRow.set(row);
    this.policyForm.reset({ reorderLevel: row.reorderLevel, safetyStock: row.safetyStock, maximumStock: row.maximumStock, supplierLeadTimeDays: row.supplierLeadTimeDays, targetCoverDays: row.targetCoverDays });
    this.policyOpen.set(true);
  }

  savePolicy(): void {
    const row = this.policyRow();
    if (!row || this.policyForm.invalid || this.savingPolicy()) return;
    this.savingPolicy.set(true);
    this.api.updatePharmacyInventoryPolicy(row.location.id, row.product.id, this.policyForm.getRawValue()).subscribe({ next: () => { this.savingPolicy.set(false); this.policyOpen.set(false); this.toast.success('Inventory policy updated.'); this.load(); }, error: (error) => { this.savingPolicy.set(false); this.toast.error(error?.error?.message ?? 'Inventory policy could not be updated.'); } });
  }

  createRecommendedTransfer(recommendation: any): void {
    this.creatingRecommendation.set(recommendation.id);
    const payload = { destinationLocationId: recommendation.destinationLocation.id, reason: `Network replenishment for ${recommendation.product.name}`, notes: recommendation.rationale, lines: recommendation.suggestedLines.map((line: any) => ({ sourceBatchId: line.sourceBatchId, requestedQty: line.quantity })) };
    this.api.createPharmacyTransfer(payload).pipe(switchMap((transfer) => this.api.submitPharmacyTransfer(transfer.id))).subscribe({ next: () => { this.creatingRecommendation.set(''); this.toast.success('Recommended transfer created and submitted for approval.'); this.router.navigate(['/pharmacy/transfers']); }, error: (error) => { this.creatingRecommendation.set(''); this.toast.error(error?.error?.message ?? 'Recommended transfer could not be created.'); } });
  }

  switchToDonor(recommendation: any): void {
    this.session.setActivePharmacyLocation(recommendation.sourceLocation.id);
    window.dispatchEvent(new Event('pharmacy-location-changed'));
    this.toast.success(`Active pharmacy changed to ${recommendation.sourceLocation.name}.`);
    this.load();
  }

  resolveQuarantine(batch: any, action: 'release' | 'write_off'): void {
    const quantityText = window.prompt(`Quantity to ${action === 'release' ? 'release' : 'write off'} (maximum ${batch.quantityQuarantined}):`, String(batch.quantityQuarantined));
    if (!quantityText) return;
    const quantity = Number(quantityText);
    const reason = window.prompt(`Reason for quarantine ${action === 'release' ? 'release' : 'write-off'}:`)?.trim();
    if (!reason) return;
    this.api.resolvePharmacyQuarantine(batch.id, { action, quantity, reason }).subscribe({ next: () => { this.toast.success(`Quarantined stock ${action === 'release' ? 'released' : 'written off'}.`); this.load(); }, error: (error) => this.toast.error(error?.error?.message ?? 'Quarantine resolution failed.') });
  }

  available(batch: any): number { return Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)); }
}
