import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../../core/auth/session.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-pharmacy-transfers-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="transfers-page">
      <header class="page-header">
        <div><span class="eyebrow">Network inventory</span><h1>Stock Transfers</h1><p>Move traceable batches between pharmacy shops without mixing sales, receipts, or location balances.</p></div>
        <button type="button" class="button primary" (click)="openCreate()">New transfer request</button>
      </header>

      <section class="summary-strip">
        <div><span>Outgoing queue</span><strong>{{ summary().outgoing }}</strong></div>
        <div><span>Awaiting receipt</span><strong>{{ summary().incoming }}</strong></div>
        <div><span>In transit</span><strong>{{ summary().inTransit }}</strong></div>
        <div [class.alert]="summary().discrepancies"><span>Discrepancies</span><strong>{{ summary().discrepancies }}</strong></div>
      </section>

      <div class="toolbar">
        <div class="filters">
          @for (filter of directionFilters; track filter.value) { <button type="button" [class.active]="direction() === filter.value" (click)="direction.set(filter.value)">{{ filter.label }}</button> }
        </div>
        <label><span class="sr-only">Filter by transfer status</span><select (change)="statusFilter.set($any($event.target).value)"><option value="">All statuses</option>@for (status of statuses; track status) { <option [value]="status">{{ label(status) }}</option> }</select></label>
        <label class="search"><span class="sr-only">Search transfers</span><input type="search" placeholder="Search transfer, shop, medicine or batch" (input)="search.set($any($event.target).value)" /></label>
      </div>

      @if (loading()) { <div class="state">Loading transfer operations…</div> }
      @else if (loadError()) { <div class="state error"><strong>Transfers could not be loaded</strong><p>{{ loadError() }}</p><button type="button" class="button" (click)="load()">Try again</button></div> }
      @else {
        <div class="table-wrap"><table><thead><tr><th>Transfer</th><th>Route</th><th>Stock lines</th><th>Units</th><th>Requested</th><th>Status</th><th>Action</th></tr></thead><tbody>
          @for (transfer of filteredTransfers(); track transfer.id) {
            <tr tabindex="0" (click)="openDetail(transfer)" (keydown.enter)="openDetail(transfer)">
              <td><strong>{{ transfer.transferNumber }}</strong><small>{{ transfer.reason }}</small></td>
              <td><span class="route"><b>{{ transfer.sourceLocation.code }}</b><i>→</i><b>{{ transfer.destinationLocation.code }}</b></span><small>{{ transfer.sourceLocation.name }} to {{ transfer.destinationLocation.name }}</small></td>
              <td><strong>{{ transfer.lines.length }} batch{{ transfer.lines.length === 1 ? '' : 'es' }}</strong><small>{{ linePreview(transfer) }}</small></td>
              <td><strong>{{ transferUnits(transfer) | number:'1.0-2' }}</strong><small>{{ transfer.status === 'dispatched' ? 'in transit' : 'requested / approved' }}</small></td>
              <td><span>{{ transfer.requestedAt || transfer.createdAt | date:'mediumDate' }}</span><small>{{ transfer.requestedBy.fullName || transfer.requestedBy.username }}</small></td>
              <td><span class="status" [attr.data-status]="transfer.status">{{ label(transfer.status) }}</span></td>
              <td><button type="button" class="view" (click)="$event.stopPropagation(); openDetail(transfer)">Review</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">No transfers match this view.</td></tr> }
        </tbody></table></div>
      }
    </section>

    @if (createOpen()) {
      <div class="backdrop" (click)="createOpen.set(false)"></div>
      <aside class="drawer create" role="dialog" aria-modal="true" aria-labelledby="transfer-form-title">
        <header><div><span class="eyebrow">New movement request</span><h2 id="transfer-form-title">Plan stock transfer</h2><p>Stock remains available until an administrator approves and reserves it.</p></div><button type="button" class="close" aria-label="Close transfer form" (click)="createOpen.set(false)">×</button></header>
        <form [formGroup]="transferForm" (ngSubmit)="saveTransfer()">
          <section class="header-fields">
            <label><span>Destination shop *</span><select formControlName="destinationLocationId"><option value="">Select destination</option>@for (location of destinationLocations(); track location.id) { <option [value]="location.id">{{ location.code }} · {{ location.name }}</option> }</select></label>
            <label><span>Transfer reason *</span><input formControlName="reason" placeholder="Low stock replenishment, balancing, urgent need…" /></label>
            <label class="wide"><span>Planning notes</span><textarea rows="2" formControlName="notes" placeholder="Operational context or handling instructions"></textarea></label>
            @if (session.isAdmin()) { <label class="wide"><span>FEFO override reason</span><input formControlName="fefoOverrideReason" placeholder="Only use when an earlier-expiring safe batch should not be transferred" /></label> }
          </section>
          <section class="line-editor">
            <header><div><span class="section-label">Traceable batch lines</span><h3>Select exact source batches</h3></div><button type="button" class="button" (click)="addLine()">Add batch</button></header>
            <div formArrayName="lines">
              @for (control of lineControls; track $index; let index = $index) {
                <article [formGroupName]="index"><span class="line-number">{{ index + 1 }}</span><label><span>Medicine batch *</span><select formControlName="sourceBatchId"><option value="">Select available batch</option>@for (batch of availableBatches(); track batch.id) { <option [value]="batch.id">{{ batch.productName }} · {{ batch.batchNumber }} · {{ batch.availableQuantity }} available · exp {{ batch.expiryDate | date:'mediumDate' }}</option> }</select></label><label><span>Requested quantity *</span><input type="number" min="0.01" step="0.01" formControlName="requestedQty" /></label><div class="availability"><span>Available</span><strong>{{ selectedAvailable(index) | number:'1.0-2' }}</strong></div><button type="button" class="remove" [disabled]="lineControls.length === 1" (click)="removeLine(index)">Remove</button></article>
              }
            </div>
          </section>
          <footer><span>{{ requestedTotal() | number:'1.0-2' }} total units requested</span><div><button type="button" class="button" (click)="createOpen.set(false)">Cancel</button><button type="submit" class="button primary" [disabled]="transferForm.invalid || saving()">{{ saving() ? 'Saving…' : 'Save draft' }}</button></div></footer>
        </form>
      </aside>
    }

    @if (detailOpen()) {
      <div class="backdrop" (click)="detailOpen.set(false)"></div>
      <aside class="drawer detail" role="dialog" aria-modal="true" aria-labelledby="transfer-detail-title">
        <header><div><span class="eyebrow">Stock movement</span><h2 id="transfer-detail-title">{{ detail()?.transferNumber || 'Transfer details' }}</h2>@if (detail(); as transfer) { <p>{{ transfer.sourceLocation.name }} → {{ transfer.destinationLocation.name }}</p> }</div><button type="button" class="close" aria-label="Close transfer details" (click)="detailOpen.set(false)">×</button></header>
        @if (detailLoading()) { <div class="state">Loading transfer record…</div> }
        @else if (detail(); as transfer) {
          <div class="detail-content">
            <section class="workflow">@for (step of workflowSteps; track step.value) { <div [class.complete]="hasReached(transfer.status, step.value)" [class.current]="transfer.status === step.value"><i>{{ $index + 1 }}</i><span>{{ step.label }}<small>{{ stepDate(transfer, step.value) }}</small></span></div> }</section>
            <section class="transfer-brief"><div><span>Reason</span><strong>{{ transfer.reason }}</strong><small>{{ transfer.notes || 'No additional planning notes' }}</small>@if(transfer.fefoOverrideReason){<small class="danger-text">FEFO override: {{transfer.fefoOverrideReason}}</small>}</div><div><span>Requested by</span><strong>{{ transfer.requestedBy.fullName || transfer.requestedBy.username }}</strong><small>{{ transfer.requestedAt || transfer.createdAt | date:'medium' }}</small></div><div><span>Status</span><strong class="status" [attr.data-status]="transfer.status">{{ label(transfer.status) }}</strong><small>{{ actionHint(transfer) }}</small></div></section>

            <form [formGroup]="lineReviewForm">
              <div formArrayName="lines" class="detail-table-wrap"><table><thead><tr><th>Medicine / source batch</th><th>Available now</th><th>Requested</th><th>Approved</th><th>Dispatched</th><th>Received</th><th>Quarantine</th><th>Rejected / condition</th></tr></thead><tbody>
                @for (control of reviewLineControls; track $index; let index = $index) { <tr [formGroupName]="index"><td><strong>{{ transfer.lines[index].product.name }}</strong><small>{{ transfer.lines[index].product.productCode }} · {{ transfer.lines[index].batchNumber }} · exp {{ transfer.lines[index].expiryDate | date:'mediumDate' }}</small><small>{{ transfer.lines[index].storageInstructions || 'Standard storage' }}</small></td><td>{{ availableAtSource(transfer.lines[index]) | number:'1.0-2' }}</td><td>{{ transfer.lines[index].requestedQty | number:'1.0-2' }}</td><td>@if (transfer.status === 'requested' && session.isAdmin()) { <input type="number" min="0" [max]="transfer.lines[index].requestedQty" formControlName="approvedQty" /> } @else { {{ value(transfer.lines[index].approvedQty) }} }</td><td>{{ value(transfer.lines[index].dispatchedQty) }}</td><td>@if (transfer.status === 'dispatched' && isDestination(transfer)) { <input type="number" min="0" [max]="transfer.lines[index].dispatchedQty" formControlName="receivedQty" /> } @else { {{ value(transfer.lines[index].receivedQty) }} }</td><td>@if (transfer.status === 'dispatched' && isDestination(transfer)) { <input type="number" min="0" [max]="reviewLines.at(index).get('receivedQty')?.value" formControlName="quarantinedQty" /> } @else { {{ value(transfer.lines[index].quarantinedQty) }} }</td><td>@if (transfer.status === 'dispatched' && isDestination(transfer)) { @if(receiptDifference(index)>0){<input formControlName="discrepancyReason" placeholder="Explain shortage / rejection" />}@if(quarantineQuantity(index)>0){<select formControlName="conditionStatus"><option value="">Select condition</option><option value="damaged">Damaged</option><option value="suspect">Suspect</option><option value="temperature_affected">Temperature affected</option><option value="mismatched">Batch mismatch</option><option value="recalled">Recalled</option></select>} } @else { {{ value(transfer.lines[index].rejectedQty) }}<small>{{ label(transfer.lines[index].conditionStatus) || transfer.lines[index].discrepancyReason }}</small> }</td></tr> }
              </tbody></table></div>
            </form>

            @if (transfer.status === 'approved' && isSource(transfer)) { <form class="operation-card" [formGroup]="dispatchForm"><div><span class="section-label">Dispatch record</span><h3>Document the movement out</h3></div><label><span>Transporter</span><input formControlName="transporterName" /></label><label><span>Phone</span><input formControlName="transporterPhone" /></label><label><span>Vehicle / dispatch reference</span><input formControlName="vehicleReference" /></label><label class="wide"><span>Dispatch notes</span><input formControlName="dispatchNotes" /></label></form> }
            @if (transfer.status === 'dispatched' && isDestination(transfer)) { <form class="operation-card receive" [formGroup]="receiptForm"><div><span class="section-label">Destination check</span><h3>Confirm quantity and condition</h3></div><label class="wide"><span>Receipt notes</span><input formControlName="receiptNotes" placeholder="Seal condition, temperature, packaging, or handover notes" /></label></form> }
            @if (transfer.transporterName || transfer.dispatchNotes) { <section class="transport"><div><span>Transporter</span><strong>{{ transfer.transporterName || 'Not recorded' }}</strong><small>{{ transfer.transporterPhone || transfer.vehicleReference || 'No contact/reference' }}</small></div><div><span>Dispatch notes</span><strong>{{ transfer.dispatchNotes || 'None' }}</strong><small>{{ transfer.dispatchedAt | date:'medium' }}</small></div><div><span>Receipt notes</span><strong>{{ transfer.receiptNotes || 'Pending receipt' }}</strong><small>{{ transfer.receivedAt ? (transfer.receivedAt | date:'medium') : 'Not received' }}</small></div></section> }
            @if (transfer.discrepancyNotes) { <div class="discrepancy-note"><strong>Discrepancy resolution</strong><span>{{ transfer.discrepancyNotes }}</span></div> }

            <footer class="action-bar"><div><span class="status" [attr.data-status]="transfer.status">{{ label(transfer.status) }}</span><small>{{ actionHint(transfer) }}</small></div><div><button type="button" class="button" (click)="printTransfer(transfer,'request')">Print request</button>@if(['dispatched','discrepancy_review','completed'].includes(transfer.status)){<button type="button" class="button" (click)="printTransfer(transfer,'dispatch')">Dispatch note</button>}@if(transfer.receivedAt){<button type="button" class="button" (click)="printTransfer(transfer,'receipt')">Receipt</button>}
              @if (canCancel(transfer)) { <button type="button" class="button danger" [disabled]="actionBusy()" (click)="cancel(transfer)">Cancel</button> }
              @if (transfer.status === 'draft' && isSource(transfer)) { <button type="button" class="button primary" [disabled]="actionBusy()" (click)="submit(transfer)">Submit for approval</button> }
              @if (transfer.status === 'requested' && session.isAdmin()) { <button type="button" class="button danger" [disabled]="actionBusy()" (click)="reject(transfer)">Reject</button><button type="button" class="button primary" [disabled]="actionBusy()" (click)="approve(transfer)">Approve & reserve</button> }
              @if (transfer.status === 'approved' && isSource(transfer)) { <button type="button" class="button primary" [disabled]="actionBusy()" (click)="dispatch(transfer)">Dispatch stock</button> }
              @if (transfer.status === 'dispatched' && isDestination(transfer)) { <button type="button" class="button primary" [disabled]="actionBusy()" (click)="receive(transfer)">Confirm receipt</button> }
              @if (transfer.status === 'discrepancy_review' && session.isAdmin()) { <button type="button" class="button danger" [disabled]="actionBusy()" (click)="resolve(transfer,'write_off')">Write off discrepancy</button><button type="button" class="button primary" [disabled]="actionBusy()" (click)="resolve(transfer,'return_to_source')">Return to source stock</button> }
            </div></footer>
          </div>
        }
      </aside>
    }
  `,
  styles: `
    .danger-text{color:#b42318!important}
    :host{display:block}.transfers-page{display:grid;gap:1rem;max-width:1540px;margin:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1rem;border-bottom:1px solid var(--app-border-color)}h1,h2,h3,p{margin-top:0}h1{margin-bottom:.35rem;font-size:clamp(1.9rem,3vw,2.5rem);letter-spacing:-.045em}.page-header p{max-width:76ch;margin:0;color:var(--app-muted-text-color);line-height:1.5}.eyebrow,.section-label{display:block;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.summary-strip{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--app-border-color)}.summary-strip div{display:grid;gap:.15rem;padding:.78rem 1rem;border-right:1px solid var(--app-border-color)}.summary-strip div:last-child{border-right:0}.summary-strip span{color:var(--app-muted-text-color);font-size:12px;font-weight:850;text-transform:uppercase}.summary-strip strong{font-size:1.05rem}.summary-strip .alert strong{color:#b42318}.toolbar{display:grid;grid-template-columns:auto 190px minmax(260px,1fr);align-items:center;gap:.6rem}.filters{display:flex;gap:.3rem}.filters button{min-height:2.1rem;padding:.35rem .7rem;border:1px solid var(--app-border-color);border-radius:999px;background:#fff;color:#64748b;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.filters button.active{border-color:var(--app-primary-color);background:var(--app-primary-soft-color);color:var(--app-primary-color)}input,select,textarea{width:100%;min-height:2.5rem;padding:.52rem .65rem;border:1px solid var(--app-border-color);border-radius:.48rem;background:#fff;color:var(--app-text-color);font:inherit}.table-wrap,.detail-table-wrap{overflow:auto;border:1px solid var(--app-border-color);border-radius:.68rem;background:#fff}table{width:100%;min-width:1120px;border-collapse:collapse}th{padding:.68rem .75rem;background:#f7faf9;color:var(--app-muted-text-color);font-size:12px;letter-spacing:.05em;text-align:left;text-transform:uppercase}td{padding:.62rem .75rem;border-top:1px solid var(--app-border-color);font-size:12px;vertical-align:middle}tbody tr{cursor:pointer}tbody tr:hover{background:#f8fcfb}td>strong,td>small,td>span{display:block}td small{margin-top:.14rem;color:var(--app-muted-text-color);font-size:12px}.route{display:flex;align-items:center;gap:.4rem}.route b{padding:.18rem .36rem;border-radius:.3rem;background:var(--app-primary-soft-color);color:var(--app-primary-color);font-size:12px}.route i{color:#94a3b8;font-style:normal}.status{display:inline-flex!important;width:max-content;padding:.2rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:850;text-transform:capitalize}.status[data-status="requested"],.status[data-status="discrepancy_review"]{background:#fff7ed;color:#9a3412}.status[data-status="approved"],.status[data-status="completed"]{background:#ecfdf5;color:#087f6a}.status[data-status="dispatched"]{background:#eff6ff;color:#1d4ed8}.status[data-status="rejected"],.status[data-status="cancelled"]{background:#fef2f2;color:#b42318}.view{min-height:1.9rem;padding:.3rem .58rem;border:1px solid color-mix(in srgb,var(--app-primary-color),white 62%);border-radius:.4rem;background:#fff;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.button{min-height:2.45rem;padding:.55rem .82rem;border:1px solid var(--app-border-color);border-radius:.5rem;background:#fff;color:var(--app-text-color);font:inherit;font-size:12px;font-weight:820;cursor:pointer}.button.primary{border-color:var(--app-primary-color);background:var(--app-primary-color);color:#fff}.button.danger{border-color:#fecaca;color:#b42318}.button:disabled{opacity:.5;cursor:not-allowed}.state,.empty{padding:2rem;text-align:center;color:var(--app-muted-text-color)}.state.error{color:#9f3128}.backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.42);backdrop-filter:blur(2px)}.drawer{position:fixed;inset:0 0 0 auto;z-index:81;overflow:auto;background:#fff;box-shadow:-18px 0 50px rgba(15,23,42,.16)}.drawer.create{width:min(940px,100%)}.drawer.detail{width:min(1080px,100%)}.drawer>header{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid var(--app-border-color);background:rgba(255,255,255,.97);backdrop-filter:blur(10px)}.drawer h2{margin:.15rem 0}.drawer header p{margin:0;color:var(--app-muted-text-color);font-size:12px}.close{width:2.25rem;height:2.25rem;border:1px solid var(--app-border-color);border-radius:50%;background:#fff;font-size:1.3rem;cursor:pointer}.header-fields{display:grid;grid-template-columns:.8fr 1.2fr;gap:.75rem;padding:1rem 1.2rem;border-bottom:1px solid var(--app-border-color)}label{display:grid;gap:.3rem}label>span{font-size:12px;font-weight:800}.wide{grid-column:1/-1}.line-editor{padding:1rem 1.2rem}.line-editor>header{display:flex;align-items:end;justify-content:space-between;margin-bottom:.7rem}.line-editor h3,.operation-card h3{margin:.12rem 0 0;font-size:.88rem}.line-editor article{display:grid;grid-template-columns:1.7rem 1fr .28fr .18fr auto;align-items:end;gap:.55rem;padding:.65rem 0;border-top:1px solid var(--app-border-color)}.line-number{display:grid;place-items:center;align-self:center;width:1.55rem;height:1.55rem;border-radius:50%;background:var(--app-primary-soft-color);color:var(--app-primary-color);font-size:12px;font-weight:850}.availability{display:grid;align-self:center}.availability span{color:var(--app-muted-text-color);font-size:12px}.availability strong{font-size:12px}.remove{align-self:center;border:0;background:transparent;color:#b42318;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.remove:disabled{opacity:.3}.drawer.create form>footer{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1.2rem;border-top:1px solid var(--app-border-color);background:rgba(255,255,255,.97);font-size:12px}.drawer.create footer div{display:flex;gap:.5rem}.detail-content{display:grid;gap:1rem;padding:1rem 1.2rem 5.5rem}.workflow{display:grid;grid-template-columns:repeat(5,1fr);border-block:1px solid var(--app-border-color)}.workflow div{display:flex;align-items:center;gap:.45rem;padding:.68rem .35rem;color:#94a3b8}.workflow i{display:grid;place-items:center;width:1.45rem;height:1.45rem;border-radius:50%;background:#eef2f6;font-style:normal;font-size:12px;font-weight:850}.workflow span{display:grid;font-size:12px;font-weight:800}.workflow small{font-size:12px;font-weight:500}.workflow .complete{color:var(--app-primary-color)}.workflow .complete i{background:var(--app-primary-soft-color)}.workflow .current{box-shadow:inset 0 -2px var(--app-primary-color)}.transfer-brief,.transport{display:grid;grid-template-columns:1.2fr .7fr .7fr;border-block:1px solid var(--app-border-color)}.transfer-brief>div,.transport>div{display:grid;gap:.12rem;padding:.7rem .8rem;border-right:1px solid var(--app-border-color)}.transfer-brief>div:last-child,.transport>div:last-child{border-right:0}.transfer-brief span,.transport span{color:var(--app-muted-text-color);font-size:12px;font-weight:800;text-transform:uppercase}.transfer-brief strong,.transport strong{font-size:12px}.transfer-brief small,.transport small{color:var(--app-muted-text-color);font-size:12px}.detail-table-wrap table{min-width:1000px}.detail-table-wrap input{min-height:2rem;padding:.35rem .45rem;font-size:12px}.operation-card{display:grid;grid-template-columns:1fr repeat(3,.7fr);align-items:end;gap:.65rem;padding:.85rem;border:1px solid var(--app-border-color);border-left:3px solid var(--app-primary-color);border-radius:.55rem;background:#fbfefd}.operation-card .wide{grid-column:2/-1}.operation-card.receive{grid-template-columns:1fr 2fr}.discrepancy-note{display:grid;gap:.2rem;padding:.65rem .75rem;border-left:3px solid #d97706;background:#fff7ed;color:#9a3412;font-size:12px}.action-bar{position:fixed;right:0;bottom:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;width:min(1080px,100%);padding:.8rem 1.2rem;border-top:1px solid var(--app-border-color);background:rgba(255,255,255,.97);backdrop-filter:blur(10px)}.action-bar>div{display:flex;align-items:center;gap:.5rem}.action-bar>div:first-child{display:grid;gap:.14rem}.action-bar small{color:var(--app-muted-text-color);font-size:12px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}input:focus,select:focus,textarea:focus,button:focus-visible,tr:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px}@media(max-width:850px){.toolbar,.summary-strip,.header-fields,.transfer-brief,.transport,.operation-card,.operation-card.receive{grid-template-columns:1fr}.filters{overflow:auto}.line-editor article{grid-template-columns:1.7rem 1fr}.workflow{grid-template-columns:1fr}.operation-card .wide,.wide{grid-column:auto}.page-header,.drawer>header,.action-bar,.drawer.create form>footer{align-items:stretch;flex-direction:column}.action-bar>div:last-child{display:grid}}
  `,
})
export class PharmacyTransfersPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly session = inject(SessionService);

  readonly summary = signal({ outgoing: 0, incoming: 0, inTransit: 0, discrepancies: 0 });
  readonly transfers = signal<any[]>([]);
  readonly locations = signal<any[]>([]);
  readonly products = signal<any[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly direction = signal<'all' | 'outgoing' | 'incoming'>('all');
  readonly statusFilter = signal('');
  readonly search = signal('');
  readonly createOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detail = signal<any>(null);
  readonly saving = signal(false);
  readonly actionBusy = signal(false);
  readonly statuses = ['draft', 'requested', 'approved', 'dispatched', 'discrepancy_review', 'completed', 'rejected', 'cancelled'];
  readonly directionFilters = [{ label: 'All activity', value: 'all' as const }, { label: 'Outgoing', value: 'outgoing' as const }, { label: 'Incoming', value: 'incoming' as const }];
  readonly workflowSteps = [{ value: 'draft', label: 'Draft' }, { value: 'requested', label: 'Requested' }, { value: 'approved', label: 'Reserved' }, { value: 'dispatched', label: 'In transit' }, { value: 'completed', label: 'Received' }];

  readonly destinationLocations = computed(() => this.locations().filter((location) => location.id !== this.session.activePharmacyLocationId()));
  readonly availableBatches = computed(() => this.products().flatMap((product) => (product.batches ?? []).map((batch: any) => ({ ...batch, productName: product.name, productCode: product.productCode, availableQuantity: Math.max(0, Number(batch.availableQuantity ?? batch.quantityRemaining ?? 0)) }))).filter((batch: any) => batch.availableQuantity > 0 && new Date(batch.expiryDate) > new Date()));
  readonly filteredTransfers = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.transfers().filter((transfer) => {
      const directionMatch = this.direction() === 'all' || (this.direction() === 'outgoing' ? this.isSource(transfer) : this.isDestination(transfer));
      const statusMatch = !this.statusFilter() || transfer.status === this.statusFilter();
      const searchMatch = !query || [transfer.transferNumber, transfer.reason, transfer.sourceLocation.name, transfer.destinationLocation.name, ...transfer.lines.flatMap((line: any) => [line.product.name, line.batchNumber])].some((value) => String(value ?? '').toLowerCase().includes(query));
      return directionMatch && statusMatch && searchMatch;
    });
  });

  readonly transferForm = this.fb.group({ destinationLocationId: ['', Validators.required], reason: ['', [Validators.required, Validators.minLength(5)]], notes: [''], fefoOverrideReason: [''], lines: this.fb.array<FormGroup>([this.createLineGroup()]) });
  readonly lineReviewForm = this.fb.group({ lines: this.fb.array<FormGroup>([]) });
  readonly dispatchForm = this.fb.group({ transporterName: [''], transporterPhone: [''], vehicleReference: [''], dispatchNotes: [''] });
  readonly receiptForm = this.fb.group({ receiptNotes: [''] });

  get lines(): FormArray<FormGroup> { return this.transferForm.controls.lines; }
  get lineControls(): FormGroup[] { return this.lines.controls; }
  get reviewLines(): FormArray<FormGroup> { return this.lineReviewForm.controls.lines; }
  get reviewLineControls(): FormGroup[] { return this.reviewLines.controls; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({ summary: this.api.getPharmacyTransferSummary(), transfers: this.api.getPharmacyTransfers(), locations: this.api.getPharmacyLocations(), products: this.api.getPharmacyProducts() }).subscribe({
      next: (result) => { this.summary.set(result.summary); this.transfers.set(result.transfers ?? []); this.locations.set(result.locations ?? []); this.products.set(result.products ?? []); this.loading.set(false); },
      error: (error) => { this.loading.set(false); this.loadError.set(error?.error?.message ?? 'Check your connection and active pharmacy location.'); },
    });
  }

  openCreate(): void {
    this.transferForm.reset({ destinationLocationId: '', reason: '', notes: '', fefoOverrideReason: '', lines: [] as any });
    this.lines.clear();
    this.addLine();
    this.createOpen.set(true);
  }

  addLine(): void { this.lines.push(this.createLineGroup()); }
  removeLine(index: number): void { if (this.lines.length > 1) this.lines.removeAt(index); }
  selectedAvailable(index: number): number { const id = this.lines.at(index).get('sourceBatchId')?.value; return Number(this.availableBatches().find((batch: any) => batch.id === id)?.availableQuantity ?? 0); }
  requestedTotal(): number { return this.lineControls.reduce((sum, control) => sum + Number(control.get('requestedQty')?.value ?? 0), 0); }

  saveTransfer(): void {
    if (this.transferForm.invalid || this.saving()) { this.transferForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.api.createPharmacyTransfer(this.transferForm.getRawValue()).subscribe({
      next: (transfer) => { this.saving.set(false); this.createOpen.set(false); this.toast.success('Transfer draft saved.'); this.load(); this.openDetail(transfer); },
      error: (error) => { this.saving.set(false); this.toast.error(error?.error?.message ?? 'Transfer draft could not be saved.'); },
    });
  }

  openDetail(transfer: any): void {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detail.set(null);
    this.api.getPharmacyTransfer(transfer.id).subscribe({ next: (value) => { this.detail.set(value); this.prepareReviewForms(value); this.detailLoading.set(false); }, error: (error) => { this.detailLoading.set(false); this.toast.error(error?.error?.message ?? 'Transfer details could not be loaded.'); } });
  }

  submit(transfer: any): void { this.run(this.api.submitPharmacyTransfer(transfer.id), 'Transfer submitted for approval.', transfer.id); }
  approve(transfer: any): void { this.run(this.api.approvePharmacyTransfer(transfer.id, { lines: this.lineReviewForm.getRawValue().lines }), 'Transfer approved and stock reserved.', transfer.id); }
  dispatch(transfer: any): void { this.run(this.api.dispatchPharmacyTransfer(transfer.id, this.dispatchForm.getRawValue()), 'Transfer dispatched and moved into transit.', transfer.id); }
  receive(transfer: any): void { this.run(this.api.receivePharmacyTransfer(transfer.id, { ...this.receiptForm.getRawValue(), lines: this.lineReviewForm.getRawValue().lines }), 'Destination receipt posted.', transfer.id); }

  reject(transfer: any): void {
    const reason = window.prompt('Reason for rejecting this transfer:')?.trim();
    if (!reason) return;
    this.run(this.api.rejectPharmacyTransfer(transfer.id, reason), 'Transfer rejected.', transfer.id);
  }

  cancel(transfer: any): void {
    const reason = window.prompt('Reason for cancelling this transfer:')?.trim();
    if (!reason) return;
    this.run(this.api.cancelPharmacyTransfer(transfer.id, reason), 'Transfer cancelled and any reservation released.', transfer.id);
  }

  resolve(transfer: any, resolution: 'return_to_source' | 'write_off'): void {
    const notes = window.prompt(resolution === 'return_to_source' ? 'Explain the return-to-source resolution:' : 'Explain why the discrepancy must be written off:')?.trim();
    if (!notes) return;
    this.run(this.api.resolvePharmacyTransfer(transfer.id, { resolution, notes }), 'Transfer discrepancy resolved.', transfer.id);
  }

  receiptDifference(index: number): number {
    const transferLine = this.detail()?.lines[index];
    return Math.max(0, Number(transferLine?.dispatchedQty ?? 0) - Number(this.reviewLines.at(index)?.get('receivedQty')?.value ?? 0));
  }

  quarantineQuantity(index: number): number { return Number(this.reviewLines.at(index)?.get('quarantinedQty')?.value ?? 0); }

  isSource(transfer: any): boolean { return transfer.sourceLocationId === this.session.activePharmacyLocationId() || transfer.sourceLocation?.id === this.session.activePharmacyLocationId(); }
  isDestination(transfer: any): boolean { return transfer.destinationLocationId === this.session.activePharmacyLocationId() || transfer.destinationLocation?.id === this.session.activePharmacyLocationId(); }
  canCancel(transfer: any): boolean { return this.isSource(transfer) && ['draft', 'requested', 'approved'].includes(transfer.status); }
  transferUnits(transfer: any): number { return transfer.lines.reduce((sum: number, line: any) => sum + Number(line.dispatchedQty ?? line.approvedQty ?? line.requestedQty ?? 0), 0); }
  linePreview(transfer: any): string { return transfer.lines.slice(0, 2).map((line: any) => `${line.product.name} · ${line.batchNumber}`).join(', ') + (transfer.lines.length > 2 ? ` +${transfer.lines.length - 2}` : ''); }
  availableAtSource(line: any): number { return Math.max(0, Number(line.sourceBatch?.quantityRemaining ?? 0) - Number(line.sourceBatch?.quantityReserved ?? 0) - Number(line.sourceBatch?.quantityQuarantined ?? 0)); }
  value(value: unknown): string { return value === null || value === undefined ? '—' : Number(value).toFixed(2); }
  label(value: unknown): string { return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()); }

  hasReached(status: string, step: string): boolean {
    if (status === 'discrepancy_review') return ['draft', 'requested', 'approved', 'dispatched'].includes(step);
    const rank: Record<string, number> = { draft: 1, requested: 2, approved: 3, dispatched: 4, completed: 5 };
    return (rank[status] ?? 0) >= (rank[step] ?? 0);
  }

  stepDate(transfer: any, step: string): string {
    const value = ({ draft: transfer.createdAt, requested: transfer.requestedAt, approved: transfer.approvedAt, dispatched: transfer.dispatchedAt, completed: transfer.receivedAt } as Record<string, string | null>)[step];
    return value ? new Date(value).toLocaleDateString() : 'Pending';
  }

  actionHint(transfer: any): string {
    const hints: Record<string, string> = { draft: 'Review and submit the request.', requested: 'Waiting for administrator approval.', approved: 'Stock is reserved at the source shop.', dispatched: 'Destination must inspect and receive it.', discrepancy_review: 'Administrator resolution is required.', completed: 'Stock movement is complete.', rejected: 'The request was rejected.', cancelled: 'The transfer was cancelled.' };
    return hints[transfer.status] ?? 'Review transfer history.';
  }

  private createLineGroup(): FormGroup { return this.fb.group({ sourceBatchId: ['', Validators.required], requestedQty: [1, [Validators.required, Validators.min(0.01)]] }); }

  private prepareReviewForms(transfer: any): void {
    this.reviewLines.clear();
    for (const line of transfer.lines) this.reviewLines.push(this.fb.group({ id: [line.id], approvedQty: [Number(line.approvedQty ?? line.requestedQty)], receivedQty: [Number(line.receivedQty ?? line.dispatchedQty ?? 0)], quarantinedQty: [Number(line.quarantinedQty ?? 0)], conditionStatus: [line.conditionStatus ?? ''], discrepancyReason: [line.discrepancyReason ?? ''] }));
    this.dispatchForm.reset({ transporterName: transfer.transporterName ?? '', transporterPhone: transfer.transporterPhone ?? '', vehicleReference: transfer.vehicleReference ?? '', dispatchNotes: transfer.dispatchNotes ?? '' });
    this.receiptForm.reset({ receiptNotes: transfer.receiptNotes ?? '' });
  }

  private run(request: any, successMessage: string, transferId: string): void {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    request.subscribe({
      next: () => { this.actionBusy.set(false); this.toast.success(successMessage); this.load(); this.api.getPharmacyTransfer(transferId).subscribe({ next: (value) => { this.detail.set(value); this.prepareReviewForms(value); } }); },
      error: (error: any) => { this.actionBusy.set(false); this.toast.error(error?.error?.message ?? 'Transfer action failed.'); },
    });
  }

  printTransfer(transfer: any, documentType: 'request' | 'dispatch' | 'receipt'): void {
    const printWindow = window.open('', '_blank', 'width=980,height=760');
    if (!printWindow) { this.toast.error('Allow pop-ups to print transfer documents.'); return; }
    const title = documentType === 'request' ? 'Stock Transfer Request' : documentType === 'dispatch' ? 'Stock Transfer Dispatch Note' : 'Stock Transfer Receipt Confirmation';
    const quantityKey = documentType === 'request' ? 'requestedQty' : documentType === 'dispatch' ? 'dispatchedQty' : 'receivedQty';
    const rows = transfer.lines.map((line: any) => `<tr><td>${this.escape(line.product.name)}<small>${this.escape(line.product.productCode)}</small></td><td>${this.escape(line.batchNumber)}</td><td>${new Date(line.expiryDate).toLocaleDateString()}</td><td>${Number(line[quantityKey] ?? 0).toFixed(2)} ${this.escape(line.product.unitOfMeasure)}</td><td>${Number(line.quarantinedQty ?? 0).toFixed(2)}</td><td>${this.escape(line.storageInstructions || 'Standard storage')}</td></tr>`).join('');
    const actor = documentType === 'request' ? transfer.requestedBy : documentType === 'dispatch' ? transfer.dispatchedBy : transfer.receivedBy;
    const documentDate = documentType === 'request' ? transfer.requestedAt || transfer.createdAt : documentType === 'dispatch' ? transfer.dispatchedAt : transfer.receivedAt;
    printWindow.document.write(`<html><head><title>${this.escape(title)} ${this.escape(transfer.transferNumber)}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #0f8f7f;padding-bottom:15px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:4px 0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.meta div{border-bottom:1px solid #ccd8d5;padding:8px}.meta span,small{display:block;color:#64748b;font-size:12px}.route{font-size:15px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #d8e0e8;text-align:left;font-size:12px}th{background:#f3f7f6}.sign{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:50px}.sign div{border-top:1px solid #172033;padding-top:6px;font-size:12px}</style></head><body><header><div><h1>${this.escape(title)}</h1><h2>${this.escape(transfer.transferNumber)}</h2></div><div>${documentDate ? new Date(documentDate).toLocaleString() : 'Pending date'}</div></header><div class="meta"><div><span>Route</span><strong class="route">${this.escape(transfer.sourceLocation.code)} → ${this.escape(transfer.destinationLocation.code)}</strong><small>${this.escape(transfer.sourceLocation.name)} to ${this.escape(transfer.destinationLocation.name)}</small></div><div><span>Reason</span><strong>${this.escape(transfer.reason)}</strong><small>${this.escape(transfer.fefoOverrideReason ? `FEFO override: ${transfer.fefoOverrideReason}` : 'FEFO compliant')}</small></div><div><span>Transport</span><strong>${this.escape(transfer.transporterName || 'Not recorded')}</strong><small>${this.escape(transfer.vehicleReference || transfer.transporterPhone || '')}</small></div></div><table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Quarantine</th><th>Storage</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>Prepared / processed by: ${this.escape(actor?.fullName || actor?.username || '')}</div><div>Authorized / received signature</div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  private escape(value: unknown): string { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character)); }
}
