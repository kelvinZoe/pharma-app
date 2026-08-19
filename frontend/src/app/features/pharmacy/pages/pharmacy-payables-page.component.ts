import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

interface PayableInvoice {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  balanceDue: number;
  status: string;
  isOverdue: boolean;
  supplier: { id: string; supplierCode: string; name: string };
  location: { code: string; name: string };
  receipt: { id: string; receiptNumber: string; receivedAt: string };
}

@Component({
  selector: 'app-pharmacy-payables-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="payables-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Procurement finance</span>
          <h1>Supplier Payables & Returns</h1>
          <p>Control supplier invoices, payment due dates, purchase returns, credits, and accounting-linked payments for each pharmacy location.</p>
        </div>
        <div class="header-controls">
          <label><span>Active location</span><select [value]="session.activePharmacyLocationId() || ''" (change)="changeLocation($event)">@for (location of locations(); track location.id) { <option [value]="location.id">{{ location.code }} · {{ location.name }}</option> }</select></label>
          <button type="button" class="button button--secondary" [disabled]="!statementSupplierId()" (click)="openStatement()">Supplier statement</button>
        </div>
      </header>

      <section class="summary-strip" aria-label="Supplier payable summary">
        <div><span>Outstanding</span><strong>GHS {{ summary().outstandingBalance | number:'1.2-2' }}</strong><small>{{ summary().unpaidCount }} open invoices</small></div>
        <div class="metric-warning"><span>Overdue</span><strong>GHS {{ summary().overdueBalance | number:'1.2-2' }}</strong><small>{{ summary().overdueCount }} overdue invoices</small></div>
        <div><span>Supplier credit</span><strong>GHS {{ summary().supplierCredit | number:'1.2-2' }}</strong><small>Returns beyond payable balance</small></div>
        <div><span>Invoices</span><strong>{{ summary().invoiceCount }}</strong><small>At this pharmacy location</small></div>
      </section>

      <section class="workspace">
        <div class="workspace-toolbar">
          <nav aria-label="Payables views">
            <button type="button" [class.active]="activeTab() === 'invoices'" (click)="activeTab.set('invoices')">Invoices <span>{{ invoices().length }}</span></button>
            <button type="button" [class.active]="activeTab() === 'payments'" (click)="activeTab.set('payments')">Payments <span>{{ payments().length }}</span></button>
            <button type="button" [class.active]="activeTab() === 'returns'" (click)="activeTab.set('returns')">Returns <span>{{ returns().length }}</span></button>
          </nav>
          <div class="statement-picker"><select aria-label="Select supplier for statement" (change)="statementSupplierId.set($any($event.target).value)"><option value="">Select supplier for statement</option>@for (supplier of suppliers(); track supplier.id) { <option [value]="supplier.id">{{ supplier.name }}</option> }</select></div>
        </div>

        @if (loading()) {
          <div class="loading-state"><span></span><span></span><span></span><span></span></div>
        } @else if (loadError()) {
          <div class="state state--error"><strong>Procurement finance records could not be loaded</strong><p>{{ loadError() }}</p><button type="button" class="button button--secondary" (click)="loadAll()">Try again</button></div>
        } @else if (activeTab() === 'invoices') {
          <div class="invoice-tools">
            <div class="filters">@for (filter of invoiceFilters; track filter.value) { <button type="button" [class.active]="invoiceStatus() === filter.value" (click)="invoiceStatus.set(filter.value)">{{ filter.label }}</button> }</div>
            <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input type="search" placeholder="Search invoice, receipt, or supplier" (input)="invoiceSearch.set($any($event.target).value)" /></label>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Supplier invoice</th><th>Supplier</th><th>Dates</th><th>Original value</th><th>Paid / credited</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                @for (invoice of filteredInvoices(); track invoice.id) {
                  <tr class="click-row" tabindex="0" (click)="openInvoice(invoice)" (keydown.enter)="openInvoice(invoice)">
                    <td><strong>{{ invoice.supplierInvoiceNumber }}</strong><small>{{ invoice.invoiceNumber }} · {{ invoice.receipt.receiptNumber }}</small></td>
                    <td><strong>{{ invoice.supplier.name }}</strong><small>{{ invoice.supplier.supplierCode }}</small></td>
                    <td><span>{{ invoice.invoiceDate | date:'mediumDate' }}</span><small [class.overdue-text]="invoice.isOverdue">Due {{ invoice.dueDate | date:'mediumDate' }}</small></td>
                    <td><strong>GHS {{ invoice.totalAmount | number:'1.2-2' }}</strong></td>
                    <td><span>Paid {{ invoice.paidAmount | number:'1.2-2' }}</span><small>Credit {{ invoice.creditAmount | number:'1.2-2' }}</small></td>
                    <td><strong [class.credit-text]="invoice.balanceDue < 0">GHS {{ invoice.balanceDue | number:'1.2-2' }}</strong></td>
                    <td><span [class]="'status ' + statusClass(invoice)">{{ statusLabel(invoice) }}</span></td>
                    <td><button type="button" class="view-button" (click)="$event.stopPropagation(); openInvoice(invoice)">View</button></td>
                  </tr>
                } @empty { <tr><td colspan="8" class="empty-cell">No supplier invoices match these filters.</td></tr> }
              </tbody>
            </table>
          </div>
        } @else if (activeTab() === 'payments') {
          <div class="table-wrap"><table><thead><tr><th>Payment</th><th>Supplier</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Accounting</th><th>Amount</th></tr></thead><tbody>@for (payment of payments(); track payment.id) { <tr><td><strong>{{ payment.paymentNumber }}</strong><small>{{ payment.paymentDate | date:'mediumDate' }}</small></td><td><strong>{{ payment.supplier.name }}</strong></td><td><span>{{ payment.invoice.supplierInvoiceNumber }}</span><small>{{ payment.invoice.invoiceNumber }}</small></td><td>{{ methodLabel(payment.paymentMethod) }}</td><td>{{ payment.referenceNumber || 'Cash payment' }}</td><td><span class="linked-status">Expense linked</span><small>{{ payment.expense?.id || '—' }}</small></td><td><strong>GHS {{ payment.amount | number:'1.2-2' }}</strong></td></tr> } @empty { <tr><td colspan="7" class="empty-cell">No supplier payments have been recorded at this location.</td></tr> }</tbody></table></div>
        } @else {
          <div class="table-wrap"><table><thead><tr><th>Return</th><th>Supplier</th><th>Original receipt</th><th>Reason</th><th>Lines</th><th>Posted by</th><th>Supplier credit</th></tr></thead><tbody>@for (item of returns(); track item.id) { <tr><td><strong>{{ item.returnNumber }}</strong><small>{{ item.returnDate | date:'mediumDate' }}</small></td><td><strong>{{ item.supplier.name }}</strong></td><td>{{ item.receipt.receiptNumber }}</td><td>{{ item.reason }}</td><td>{{ item.lines.length }}</td><td>{{ item.createdBy.fullName || item.createdBy.username }}</td><td><strong>GHS {{ item.totalCredit | number:'1.2-2' }}</strong></td></tr> } @empty { <tr><td colspan="7" class="empty-cell">No supplier returns have been posted at this location.</td></tr> }</tbody></table></div>
        }
      </section>
    </section>

    @if (detailOpen()) {
      <div class="backdrop" (click)="closeDetail()"></div>
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="payable-detail-title">
        <header><div><span class="eyebrow">Supplier payable</span><h2 id="payable-detail-title">{{ detail()?.supplierInvoiceNumber || selectedInvoiceNumber() }}</h2>@if (detail(); as invoice) { <p>{{ invoice.supplier.name }} · {{ invoice.receipt.receiptNumber }}</p> }</div><button type="button" class="close-button" aria-label="Close invoice details" (click)="closeDetail()">×</button></header>
        @if (detailLoading()) { <div class="loading-state drawer-loading"><span></span><span></span><span></span></div> }
        @else if (detailError()) { <div class="state state--error"><strong>Invoice details could not be loaded</strong><p>{{ detailError() }}</p></div> }
        @else if (detail(); as invoice) {
          <div class="detail-content">
            <section class="detail-metrics"><div><span>Invoice value</span><strong>GHS {{ invoice.totalAmount | number:'1.2-2' }}</strong></div><div><span>Paid</span><strong>GHS {{ invoice.paidAmount | number:'1.2-2' }}</strong></div><div><span>Returns credited</span><strong>GHS {{ invoice.creditAmount | number:'1.2-2' }}</strong></div><div><span>Balance due</span><strong [class.credit-text]="invoice.balanceDue < 0">GHS {{ invoice.balanceDue | number:'1.2-2' }}</strong></div></section>

            <section class="invoice-record">
              <header><div><span class="section-label">Invoice control</span><h3>Supplier document and due date</h3></div>@if (canRecordPayment()) { <button type="button" class="text-button" (click)="editingInvoice.update(value => !value)">{{ editingInvoice() ? 'Close editor' : 'Edit invoice' }}</button> }</header>
              @if (editingInvoice()) {
                <form class="invoice-edit" [formGroup]="invoiceForm" (ngSubmit)="saveInvoice()"><label><span>Supplier invoice number</span><input formControlName="supplierInvoiceNumber" /></label><label><span>Invoice date</span><input type="date" formControlName="invoiceDate" /></label><label><span>Due date</span><input type="date" formControlName="dueDate" /></label><label class="wide"><span>Notes</span><input formControlName="notes" /></label><button type="submit" class="button button--primary" [disabled]="invoiceForm.invalid || savingInvoice()">{{ savingInvoice() ? 'Saving…' : 'Save invoice' }}</button></form>
              } @else {
                <dl><div><dt>Internal reference</dt><dd>{{ invoice.invoiceNumber }}</dd></div><div><dt>Supplier reference</dt><dd>{{ invoice.supplierInvoiceNumber }}</dd></div><div><dt>Invoice date</dt><dd>{{ invoice.invoiceDate | date:'mediumDate' }}</dd></div><div><dt>Due date</dt><dd [class.overdue-text]="invoice.isOverdue">{{ invoice.dueDate | date:'mediumDate' }}</dd></div><div><dt>Location</dt><dd>{{ invoice.location.code }} · {{ invoice.location.name }}</dd></div><div><dt>Status</dt><dd>{{ statusLabel(invoice) }}</dd></div></dl>
              }
            </section>

            <section class="detail-section"><header><div><span class="section-label">Original delivery</span><h3>Returnable receipt lines</h3></div><span>{{ invoice.receipt.lines.length }} batches</span></header><div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Medicine</th><th>Batch</th><th>Received</th><th>Previously returned</th><th>Current stock</th><th>Returnable now</th></tr></thead><tbody>@for (line of invoice.receipt.lines; track line.id) { <tr><td><strong>{{ line.product.name }}</strong><small>{{ line.product.productCode }}</small></td><td>{{ line.batch.batchNumber }}</td><td>{{ line.quantityReceived | number:'1.0-2' }}</td><td>{{ line.quantityReturned | number:'1.0-2' }}</td><td>{{ line.batch.quantityRemaining | number:'1.0-2' }}</td><td><strong>{{ returnableQuantity(line) | number:'1.0-2' }} {{ line.product.unitOfMeasure }}</strong></td></tr> }</tbody></table></div></section>

            <section class="history-grid"><div><header><span class="section-label">Payments</span><h3>Payment history</h3></header>@for (payment of invoice.payments; track payment.id) { <article><div><strong>{{ payment.paymentNumber }}</strong><small>{{ methodLabel(payment.paymentMethod) }} · {{ payment.paymentDate | date:'mediumDate' }}</small></div><strong>GHS {{ payment.amount | number:'1.2-2' }}</strong></article> } @empty { <p class="inline-empty">No payments recorded.</p> }</div><div><header><span class="section-label">Credits</span><h3>Supplier returns</h3></header>@for (item of invoice.purchaseReturns; track item.id) { <article><div><strong>{{ item.returnNumber }}</strong><small>{{ item.reason }} · {{ item.returnDate | date:'mediumDate' }}</small></div><strong>GHS {{ item.totalCredit | number:'1.2-2' }}</strong></article> } @empty { <p class="inline-empty">No returns recorded.</p> }</div></section>

            <footer class="action-bar"><div><span [class]="'status ' + statusClass(invoice)">{{ statusLabel(invoice) }}</span><small>Payments create linked inventory expenses automatically.</small></div><div>@if (canReturn() && hasReturnableStock(invoice)) { <button type="button" class="button button--secondary" (click)="openReturn(invoice)">Return stock</button> }@if (canRecordPayment() && invoice.balanceDue > 0) { <button type="button" class="button button--primary" (click)="openPayment(invoice)">Record payment</button> }<button type="button" class="button button--secondary" (click)="openStatement(invoice.supplier.id)">Statement</button></div></footer>
          </div>
        }
      </aside>
    }

    @if (paymentOpen()) {
      <div class="backdrop top-layer" (click)="paymentOpen.set(false)"></div><aside class="form-drawer top-drawer" role="dialog" aria-modal="true" aria-labelledby="payment-title"><header><div><span class="eyebrow">Cash outflow</span><h2 id="payment-title">Record supplier payment</h2><p>{{ paymentInvoiceName() }} · Balance GHS {{ paymentInvoiceBalance() | number:'1.2-2' }}</p></div><button type="button" class="close-button" aria-label="Close payment form" (click)="paymentOpen.set(false)">×</button></header><form [formGroup]="paymentForm" (ngSubmit)="submitPayment()"><label><span>Payment amount *</span><div class="money"><span>GHS</span><input type="number" min="0.01" [max]="paymentInvoiceBalance()" step="0.01" formControlName="amount" /></div></label><label><span>Payment date *</span><input type="date" formControlName="paymentDate" /></label><label><span>Payment method *</span><select formControlName="paymentMethod"><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile Money</option><option value="cheque">Cheque</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label><span>Reference number</span><input formControlName="referenceNumber" placeholder="Bank, cheque, or wallet reference" /></label><label class="wide"><span>Notes</span><textarea rows="3" formControlName="notes" placeholder="Payment approval or remittance notes"></textarea></label><footer><button type="button" class="button button--secondary" (click)="paymentOpen.set(false)">Cancel</button><button type="submit" class="button button--primary" [disabled]="paymentForm.invalid || paymentSaving()">{{ paymentSaving() ? 'Recording…' : 'Record payment' }}</button></footer></form></aside>
    }

    @if (returnOpen()) {
      <div class="backdrop top-layer" (click)="returnOpen.set(false)"></div><aside class="return-drawer top-drawer" role="dialog" aria-modal="true" aria-labelledby="return-title"><header><div><span class="eyebrow">Stock reversal</span><h2 id="return-title">Return stock to supplier</h2><p>Quantities are removed from the original batches and credited to the supplier invoice.</p></div><button type="button" class="close-button" aria-label="Close return form" (click)="returnOpen.set(false)">×</button></header><form [formGroup]="returnForm" (ngSubmit)="submitReturn()"><div class="return-header"><label><span>Return date *</span><input type="date" formControlName="returnDate" /></label><label><span>Overall reason *</span><select formControlName="reason"><option value="">Select reason</option><option value="Damaged on delivery">Damaged on delivery</option><option value="Incorrect item supplied">Incorrect item supplied</option><option value="Short-dated stock">Short-dated stock</option><option value="Expired stock">Expired stock</option><option value="Quality concern">Quality concern</option><option value="Supplier recall">Supplier recall</option><option value="Other">Other</option></select></label><label class="wide"><span>Notes</span><input formControlName="notes" placeholder="Supplier authorization, credit note, or transport details" /></label></div><section class="return-lines" formArrayName="lines"><header><span class="section-label">Receipt batches</span><strong>Select quantities physically sent back</strong></header>@for (control of returnLineControls; track $index; let index = $index) { <article [formGroupName]="index"><div><strong>{{ returnSourceLines()[index].product.name }}</strong><small>Batch {{ returnSourceLines()[index].batch.batchNumber }} · {{ returnableQuantity(returnSourceLines()[index]) }} available to return</small></div><label><span>Quantity</span><input type="number" min="0" [max]="returnableQuantity(returnSourceLines()[index])" step="0.01" formControlName="quantity" /></label><label><span>Line reason</span><input formControlName="returnReason" placeholder="Optional detail" /></label><strong>GHS {{ returnLineValue(index) | number:'1.2-2' }}</strong></article> }</section><footer><div><span>Supplier credit</span><strong>GHS {{ returnTotal() | number:'1.2-2' }}</strong></div><div><button type="button" class="button button--secondary" (click)="returnOpen.set(false)">Cancel</button><button type="submit" class="button button--primary" [disabled]="returnForm.invalid || returnSaving() || returnTotal() <= 0">{{ returnSaving() ? 'Posting return…' : 'Post supplier return' }}</button></div></footer></form></aside>
    }

    @if (statementOpen()) {
      <div class="backdrop top-layer" (click)="statementOpen.set(false)"></div><aside class="statement-drawer top-drawer" role="dialog" aria-modal="true" aria-labelledby="statement-title"><header><div><span class="eyebrow">Supplier account</span><h2 id="statement-title">{{ statement()?.supplier?.name || 'Supplier statement' }}</h2><p>Invoices increase the balance; payments and returns reduce it.</p></div><div class="header-actions"><button type="button" class="button button--secondary" [disabled]="!statement()" (click)="printStatement()">Print</button><button type="button" class="close-button" aria-label="Close supplier statement" (click)="statementOpen.set(false)">×</button></div></header><form class="statement-filters" [formGroup]="statementForm" (ngSubmit)="loadStatement()"><label><span>From</span><input type="date" formControlName="startDate" /></label><label><span>To</span><input type="date" formControlName="endDate" /></label><button type="submit" class="button button--secondary">Apply dates</button></form>@if (statementLoading()) { <div class="loading-state drawer-loading"><span></span><span></span><span></span></div> } @else if (statement(); as account) { <section class="statement-summary"><div><span>Invoiced</span><strong>GHS {{ account.totals.invoiced | number:'1.2-2' }}</strong></div><div><span>Paid</span><strong>GHS {{ account.totals.paid | number:'1.2-2' }}</strong></div><div><span>Returns</span><strong>GHS {{ account.totals.returned | number:'1.2-2' }}</strong></div><div><span>Net balance</span><strong>GHS {{ account.totals.balance | number:'1.2-2' }}</strong></div></section><div class="statement-table"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Location</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>@for (entry of account.entries; track entry.type + entry.id) { <tr><td>{{ entry.date | date:'mediumDate' }}</td><td><span [class]="'entry-type entry-type--' + entry.type">{{ entry.type }}</span></td><td>{{ entry.reference }}</td><td>{{ entry.description }}</td><td>{{ entry.location.code }}</td><td>{{ entry.debit ? ('GHS ' + (entry.debit | number:'1.2-2')) : '—' }}</td><td>{{ entry.credit ? ('GHS ' + (entry.credit | number:'1.2-2')) : '—' }}</td><td><strong>GHS {{ entry.balance | number:'1.2-2' }}</strong></td></tr> } @empty { <tr><td colspan="8" class="empty-cell">No statement activity for this period.</td></tr> }</tbody></table></div> }</aside>
    }
  `,
  styles: `
    :host{display:block}.payables-page{display:grid;gap:1.15rem;max-width:1540px;margin:0 auto;color:var(--app-text-color)}h1,h2,h3,p{margin-top:0}.page-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding-bottom:1.1rem;border-bottom:1px solid var(--app-border-color)}h1{margin-bottom:.38rem;font-size:clamp(1.75rem,3vw,2.45rem);letter-spacing:-.04em}.page-header p{max-width:75ch;margin-bottom:0;color:var(--app-muted-text-color);line-height:1.55}.eyebrow,.section-label{display:block;color:var(--app-primary-color);font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.eyebrow{margin-bottom:.34rem}.header-controls{display:flex;align-items:end;gap:.6rem}.header-controls label{min-width:220px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:.55rem .82rem;border-radius:.5rem;font:inherit;font-size:12px;font-weight:820;cursor:pointer}.button--primary{border:1px solid var(--app-primary-color);background:var(--app-primary-color);color:#fff}.button--secondary{border:1px solid var(--app-border-color);background:#fff;color:var(--app-text-color)}button:disabled{opacity:.5;cursor:not-allowed}.summary-strip{display:grid;grid-template-columns:1.25fr 1fr 1fr .7fr;border-block:1px solid var(--app-border-color)}.summary-strip>div{display:grid;gap:.15rem;padding:.82rem 1rem;border-right:1px solid var(--app-border-color)}.summary-strip>div:last-child{border-right:0}.summary-strip span,.detail-metrics span,.statement-summary span{color:var(--app-muted-text-color);font-size:12px;font-weight:850;letter-spacing:.055em;text-transform:uppercase}.summary-strip strong{font-size:1.05rem}.summary-strip small{color:var(--app-muted-text-color);font-size:12px}.metric-warning strong,.overdue-text{color:#b54708!important}.workspace{display:grid;gap:.9rem}.workspace-toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem}.workspace-toolbar nav{display:flex;gap:.25rem;padding:.22rem;border:1px solid var(--app-border-color);border-radius:.55rem;background:#f8fafc}.workspace-toolbar nav button{display:flex;align-items:center;gap:.45rem;min-height:2.05rem;padding:.35rem .65rem;border:0;border-radius:.38rem;background:transparent;color:#64748b;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.workspace-toolbar nav button span{display:grid;place-items:center;min-width:1.25rem;height:1.25rem;border-radius:999px;background:#e9efed;font-size:12px}.workspace-toolbar nav button.active{background:#fff;color:var(--app-primary-color);box-shadow:0 3px 12px rgba(31,62,57,.08)}.statement-picker select{min-width:270px}.invoice-tools{display:flex;align-items:center;justify-content:space-between;gap:1rem}.filters{display:flex;gap:.3rem;overflow-x:auto}.filters button{min-height:1.9rem;padding:.3rem .58rem;border:1px solid var(--app-border-color);border-radius:999px;background:#fff;color:#64748b;font:inherit;font-size:12px;font-weight:760;cursor:pointer}.filters button.active{border-color:color-mix(in srgb,var(--app-primary-color),white 55%);background:var(--app-primary-soft-color);color:var(--app-primary-color)}.search{position:relative;width:min(430px,100%)}.search svg{position:absolute;left:.7rem;top:50%;width:.9rem;translate:0 -50%;fill:none;stroke:#64748b;stroke-width:1.8}.search input{padding-left:2.15rem}input,select,textarea{width:100%;min-height:2.5rem;padding:.52rem .65rem;border:1px solid var(--app-border-color);border-radius:.48rem;background:#fff;color:var(--app-text-color);font:inherit;font-size:12px}label{display:grid;gap:.32rem}label>span{font-size:12px;font-weight:780}.table-wrap,.detail-table-wrap,.statement-table{overflow-x:auto;border:1px solid var(--app-border-color);border-radius:.7rem;background:#fff}table{width:100%;min-width:1150px;border-collapse:collapse;table-layout:auto}th{padding:.66rem .75rem;background:#f8fafc;color:var(--app-muted-text-color);font-size:12px;letter-spacing:.05em;text-align:left;text-transform:uppercase;white-space:nowrap}td{padding:.6rem .75rem;border-top:1px solid var(--app-border-color);font-size:12px;vertical-align:middle}td>strong,td>span,td>small{display:block}td small{margin-top:.12rem;color:var(--app-muted-text-color);font-size:12px}.click-row{cursor:pointer}.click-row:hover{background:#fbfdfd}.status,.linked-status{display:inline-flex;width:fit-content;padding:.2rem .42rem;border-radius:999px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:850;text-transform:capitalize}.status--paid,.linked-status{background:#ecfdf5;color:#087f6a}.status--partial{background:#fff7ed;color:#9a3412}.status--overdue{background:#fff1f2;color:#b42318}.status--credit{background:#eff6ff;color:#175cd3}.credit-text{color:#175cd3}.view-button,.text-button{border:0;background:transparent;color:var(--app-primary-color);font:inherit;font-size:12px;font-weight:820;cursor:pointer}.empty-cell,.state{padding:2.4rem;text-align:center;color:var(--app-muted-text-color)}.state{border:1px dashed var(--app-border-color);border-radius:.7rem}.state--error{color:#9f3128}.loading-state{display:grid;gap:.5rem}.loading-state span{height:3.2rem;border-radius:.55rem;background:linear-gradient(90deg,#eef3f2,#f8faf9,#eef3f2);background-size:200% 100%;animation:shimmer 1.25s infinite}.backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.42);backdrop-filter:blur(2px)}.detail-drawer,.form-drawer,.return-drawer,.statement-drawer{position:fixed;inset:0 0 0 auto;z-index:81;overflow-y:auto;background:#fff;box-shadow:-18px 0 50px rgba(15,23,42,.16)}.detail-drawer{width:min(980px,100%)}.form-drawer{width:min(560px,100%)}.return-drawer{width:min(900px,100%)}.statement-drawer{width:min(1120px,100%)}.top-layer{z-index:90}.top-drawer{z-index:91}.detail-drawer>header,.form-drawer>header,.return-drawer>header,.statement-drawer>header{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.15rem;border-bottom:1px solid var(--app-border-color);background:rgba(255,255,255,.96);backdrop-filter:blur(10px)}.detail-drawer h2,.form-drawer h2,.return-drawer h2,.statement-drawer h2{margin-bottom:.12rem}.detail-drawer header p,.form-drawer header p,.return-drawer header p,.statement-drawer header p{margin:0;color:var(--app-muted-text-color);font-size:12px}.close-button{display:grid;place-items:center;flex:0 0 2.25rem;width:2.25rem;height:2.25rem;border:1px solid var(--app-border-color);border-radius:50%;background:#fff;font-size:1.3rem;cursor:pointer}.drawer-loading{padding:1rem}.detail-content{display:grid;gap:1rem;padding:1.05rem 1.15rem 5rem}.detail-metrics,.statement-summary{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--app-border-color)}.detail-metrics div,.statement-summary div{display:grid;gap:.18rem;padding:.72rem .8rem;border-right:1px solid var(--app-border-color)}.detail-metrics div:last-child,.statement-summary div:last-child{border-right:0}.detail-metrics strong,.statement-summary strong{font-size:.86rem}.invoice-record,.detail-section{padding-top:.85rem;border-top:1px solid var(--app-border-color)}.invoice-record>header,.detail-section>header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:.65rem}.invoice-record h3,.detail-section h3,.history-grid h3{margin:.1rem 0 0;font-size:.84rem}.invoice-record dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0;border:1px solid var(--app-border-color);border-radius:.58rem;overflow:hidden}.invoice-record dl div{display:grid;gap:.15rem;padding:.58rem .68rem;border-right:1px solid var(--app-border-color);border-bottom:1px solid var(--app-border-color)}.invoice-record dl div:nth-child(3n){border-right:0}.invoice-record dl div:nth-last-child(-n+3){border-bottom:0}dt{color:var(--app-muted-text-color);font-size:12px;font-weight:800;text-transform:uppercase}dd{margin:0;font-size:12px;font-weight:650}.invoice-edit{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.65rem;padding:.75rem;border:1px solid var(--app-border-color);border-radius:.58rem;background:#fbfdfd}.invoice-edit .wide{grid-column:1/-1}.invoice-edit button{justify-self:end;grid-column:1/-1}.detail-section>header>span{color:var(--app-muted-text-color);font-size:12px}.detail-table{min-width:760px}.detail-table td{font-size:12px}.history-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.history-grid>div{border:1px solid var(--app-border-color);border-radius:.58rem;overflow:hidden}.history-grid header{padding:.65rem .7rem;background:#f8fafc}.history-grid article{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.55rem .7rem;border-top:1px solid var(--app-border-color);font-size:12px}.history-grid article div{display:grid;gap:.1rem}.history-grid small,.inline-empty{color:var(--app-muted-text-color);font-size:12px}.inline-empty{padding:.8rem}.action-bar{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem;border:1px solid var(--app-border-color);border-radius:.6rem;background:rgba(255,255,255,.97)}.action-bar>div{display:flex;align-items:center;gap:.5rem}.action-bar>div:first-child{display:grid;gap:.15rem}.action-bar small{color:var(--app-muted-text-color);font-size:12px}.form-drawer form{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;padding:1rem 1.15rem}.form-drawer form .wide{grid-column:1/-1}.form-drawer form>footer{display:flex;justify-content:flex-end;gap:.5rem;grid-column:1/-1;padding-top:.8rem;border-top:1px solid var(--app-border-color)}.money{position:relative}.money>span{position:absolute;left:.55rem;top:50%;translate:0 -50%;color:var(--app-primary-color);font-size:12px;font-weight:850}.money input{padding-left:2.45rem}.return-drawer form{display:grid}.return-header{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;padding:1rem 1.15rem;border-bottom:1px solid var(--app-border-color)}.return-header .wide{grid-column:1/-1}.return-lines{padding:1rem 1.15rem}.return-lines>header{display:grid;gap:.12rem;margin-bottom:.55rem}.return-lines article{display:grid;grid-template-columns:1.3fr .45fr 1fr .35fr;align-items:end;gap:.65rem;padding:.65rem 0;border-top:1px solid var(--app-border-color)}.return-lines article>div{display:grid;gap:.12rem}.return-lines article small{color:var(--app-muted-text-color);font-size:12px}.return-lines article>strong{align-self:center;text-align:right;font-size:12px}.return-drawer form>footer{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1.15rem;border-top:1px solid var(--app-border-color);background:rgba(255,255,255,.97)}.return-drawer form>footer>div{display:flex;align-items:center;gap:.55rem}.return-drawer form>footer>div:first-child{display:grid;gap:.1rem}.return-drawer form>footer span{color:var(--app-muted-text-color);font-size:12px}.statement-filters{display:flex;align-items:end;gap:.65rem;padding:.75rem 1.15rem;border-bottom:1px solid var(--app-border-color)}.statement-filters label{width:170px}.statement-summary{margin:1rem 1.15rem}.statement-table{margin:0 1.15rem 2rem}.statement-table table{min-width:1000px}.entry-type{display:inline-flex;padding:.18rem .38rem;border-radius:999px;background:#f1f5f9;font-size:12px;font-weight:850;text-transform:capitalize}.entry-type--invoice{color:#9a3412;background:#fff7ed}.entry-type--payment{color:#087f6a;background:#ecfdf5}.entry-type--return{color:#175cd3;background:#eff6ff}.header-actions{display:flex;align-items:center;gap:.5rem}input:focus,select:focus,textarea:focus,button:focus-visible{outline:3px solid color-mix(in srgb,var(--app-primary-color),transparent 80%);outline-offset:2px;border-color:var(--app-primary-color)}button:active{transform:translateY(1px)}@keyframes shimmer{to{background-position:-200% 0}}@media(max-width:900px){.summary-strip{grid-template-columns:repeat(2,1fr)}.history-grid{grid-template-columns:1fr}.return-lines article{grid-template-columns:1fr 1fr}.return-lines article>div{grid-column:1/-1}.invoice-record dl{grid-template-columns:1fr 1fr}.invoice-record dl div:nth-child(3n){border-right:1px solid var(--app-border-color)}.invoice-record dl div:nth-child(2n){border-right:0}}@media(max-width:720px){.page-header,.workspace-toolbar,.invoice-tools,.action-bar,.return-drawer form>footer{align-items:stretch;flex-direction:column}.header-controls{display:grid}.summary-strip,.detail-metrics,.statement-summary,.invoice-edit,.form-drawer form,.return-header,.invoice-record dl{grid-template-columns:1fr}.workspace-toolbar nav{overflow-x:auto}.statement-picker select,.search{width:100%;min-width:0}.action-bar>div:last-child,.return-drawer form>footer>div:last-child{display:grid}.return-lines article{grid-template-columns:1fr}.statement-filters{align-items:stretch;flex-direction:column}.statement-filters label{width:100%}}
  `,
})
export class PharmacyPayablesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly session = inject(SessionService);

  readonly locations = signal<any[]>([]);
  readonly suppliers = signal<any[]>([]);
  readonly invoices = signal<PayableInvoice[]>([]);
  readonly payments = signal<any[]>([]);
  readonly returns = signal<any[]>([]);
  readonly summary = signal({ invoiceCount: 0, outstandingBalance: 0, overdueBalance: 0, supplierCredit: 0, unpaidCount: 0, overdueCount: 0 });
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly activeTab = signal<'invoices' | 'payments' | 'returns'>('invoices');
  readonly invoiceStatus = signal('all');
  readonly invoiceSearch = signal('');
  readonly statementSupplierId = signal('');
  readonly invoiceFilters = [{ label: 'All', value: 'all' }, { label: 'Unpaid', value: 'unpaid' }, { label: 'Part paid', value: 'partially_paid' }, { label: 'Overdue', value: 'overdue' }, { label: 'Paid', value: 'paid' }, { label: 'Credit due', value: 'credit_due' }];

  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly detail = signal<any | null>(null);
  readonly selectedInvoiceId = signal('');
  readonly selectedInvoiceNumber = signal('');
  readonly editingInvoice = signal(false);
  readonly savingInvoice = signal(false);

  readonly paymentOpen = signal(false);
  readonly paymentSaving = signal(false);
  readonly paymentInvoiceName = signal('');
  readonly paymentInvoiceBalance = signal(0);
  readonly returnOpen = signal(false);
  readonly returnSaving = signal(false);
  readonly returnSourceLines = signal<any[]>([]);
  readonly statementOpen = signal(false);
  readonly statementLoading = signal(false);
  readonly statement = signal<any | null>(null);

  readonly canRecordPayment = computed(() => this.userRoles().some((role) => role === 0 || role === 5));
  readonly canReturn = computed(() => this.userRoles().some((role) => role === 0 || role === 4));
  readonly filteredInvoices = computed(() => {
    const filter = this.invoiceStatus();
    const query = this.invoiceSearch().trim().toLowerCase();
    return this.invoices().filter((invoice) => {
      const statusMatch = filter === 'all' || (filter === 'overdue' ? invoice.isOverdue : invoice.status === filter);
      const searchMatch = !query || [invoice.invoiceNumber, invoice.supplierInvoiceNumber, invoice.receipt.receiptNumber, invoice.supplier.name, invoice.supplier.supplierCode].some((value) => value.toLowerCase().includes(query));
      return statusMatch && searchMatch;
    });
  });

  readonly invoiceForm = this.fb.group({ supplierInvoiceNumber: ['', Validators.required], invoiceDate: ['', Validators.required], dueDate: ['', Validators.required], notes: [''] });
  readonly paymentForm = this.fb.group({ invoiceId: ['', Validators.required], amount: [null as number | null, [Validators.required, Validators.min(.01)]], paymentDate: [new Date().toISOString().slice(0, 10), Validators.required], paymentMethod: ['bank_transfer', Validators.required], referenceNumber: [''], notes: [''] });
  readonly returnForm = this.fb.group({ receiptId: ['', Validators.required], returnDate: [new Date().toISOString().slice(0, 10), Validators.required], reason: ['', Validators.required], notes: [''], lines: this.fb.array([]) });
  readonly statementForm = this.fb.group({ startDate: [''], endDate: [''] });
  get returnLines(): FormArray { return this.returnForm.controls.lines; }
  get returnLineControls() { return this.returnLines.controls; }

  ngOnInit(): void { this.loadLocations(); this.loadAll(); }

  loadLocations(): void {
    this.api.getPharmacyLocations().subscribe({ next: (locations) => {
      this.locations.set((locations ?? []).filter((location) => location.isActive !== false));
      if (!this.session.activePharmacyLocationId() && this.locations().length) this.session.setActivePharmacyLocation(this.locations()[0].id);
    } });
  }

  loadAll(): void {
    this.loading.set(true); this.loadError.set('');
    forkJoin({ summary: this.api.getPharmacyPayablesSummary(), invoices: this.api.getPharmacySupplierInvoices(), payments: this.api.getPharmacySupplierPayments(), returns: this.api.getPharmacyPurchaseReturns(), suppliers: this.api.getPharmacySuppliers() }).subscribe({
      next: (data) => { this.summary.set(data.summary); this.invoices.set(data.invoices ?? []); this.payments.set(data.payments ?? []); this.returns.set(data.returns ?? []); this.suppliers.set(data.suppliers ?? []); this.loading.set(false); },
      error: (error) => { this.loadError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.loading.set(false); },
    });
  }

  changeLocation(event: Event): void { const id = (event.target as HTMLSelectElement).value; if (!id) return; this.session.setActivePharmacyLocation(id); this.closeDetail(); this.loadAll(); }
  openInvoice(invoice: PayableInvoice): void { this.selectedInvoiceId.set(invoice.id); this.selectedInvoiceNumber.set(invoice.supplierInvoiceNumber); this.detail.set(null); this.detailOpen.set(true); this.loadDetail(invoice.id); }
  closeDetail(): void { this.detailOpen.set(false); this.editingInvoice.set(false); }
  private loadDetail(id: string): void { this.detailLoading.set(true); this.detailError.set(''); this.api.getPharmacySupplierInvoiceDetail(id).subscribe({ next: (invoice) => { this.detail.set(invoice); this.statementSupplierId.set(invoice.supplier.id); this.invoiceForm.reset({ supplierInvoiceNumber: invoice.supplierInvoiceNumber, invoiceDate: invoice.invoiceDate.slice(0, 10), dueDate: invoice.dueDate.slice(0, 10), notes: invoice.notes ?? '' }); this.detailLoading.set(false); }, error: (error) => { this.detailError.set(error?.error?.message ?? 'Please check your connection and try again.'); this.detailLoading.set(false); } }); }
  saveInvoice(): void { if (this.invoiceForm.invalid || this.savingInvoice()) return; this.savingInvoice.set(true); this.api.updatePharmacySupplierInvoice(this.selectedInvoiceId(), this.invoiceForm.getRawValue()).subscribe({ next: () => { this.savingInvoice.set(false); this.editingInvoice.set(false); this.toast.success('Supplier invoice updated.'); this.loadDetail(this.selectedInvoiceId()); this.loadAll(); }, error: (error) => { this.savingInvoice.set(false); this.toast.error(error?.error?.message ?? 'Supplier invoice could not be updated.'); } }); }

  openPayment(invoice: any): void { this.paymentInvoiceName.set(`${invoice.supplier.name} · ${invoice.supplierInvoiceNumber}`); this.paymentInvoiceBalance.set(Number(invoice.balanceDue)); this.paymentForm.reset({ invoiceId: invoice.id, amount: null, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'bank_transfer', referenceNumber: '', notes: '' }); this.paymentOpen.set(true); }
  submitPayment(): void { if (this.paymentForm.invalid || this.paymentSaving()) { this.paymentForm.markAllAsTouched(); return; } this.paymentSaving.set(true); this.api.recordPharmacySupplierPayment(this.paymentForm.getRawValue()).subscribe({ next: () => { this.paymentSaving.set(false); this.paymentOpen.set(false); this.toast.success('Supplier payment recorded and linked to accounting expenses.'); this.loadAll(); if (this.selectedInvoiceId()) this.loadDetail(this.selectedInvoiceId()); }, error: (error) => { this.paymentSaving.set(false); this.toast.error(error?.error?.message ?? 'Supplier payment could not be recorded.'); } }); }

  openReturn(invoice: any): void { const sourceLines = invoice.receipt.lines.filter((line: any) => this.returnableQuantity(line) > 0); this.returnSourceLines.set(sourceLines); this.returnForm.reset({ receiptId: invoice.receipt.id, returnDate: new Date().toISOString().slice(0, 10), reason: '', notes: '', lines: [] as any }); this.returnLines.clear(); for (const line of sourceLines) this.returnLines.push(this.fb.group({ receiptLineId: [line.id, Validators.required], quantity: [0, [Validators.required, Validators.min(0)]], returnReason: [''] })); this.returnOpen.set(true); }
  returnableQuantity(line: any): number { return Math.max(0, Math.min(Number(line.quantityReceived) - Number(line.quantityReturned ?? 0), Number(line.batch.quantityRemaining))); }
  hasReturnableStock(invoice: any): boolean { return invoice.receipt.lines.some((line: any) => this.returnableQuantity(line) > 0); }
  returnLineValue(index: number): number { return Number(this.returnLines.at(index).get('quantity')?.value ?? 0) * Number(this.returnSourceLines()[index]?.unitCost ?? 0); }
  returnTotal(): number { return this.returnLineControls.reduce((sum, _, index) => sum + this.returnLineValue(index), 0); }
  submitReturn(): void { if (this.returnForm.invalid || this.returnSaving()) { this.returnForm.markAllAsTouched(); return; } const value = this.returnForm.getRawValue(); const lines = value.lines.filter((line: any) => Number(line.quantity) > 0); if (!lines.length) { this.toast.error('Enter a return quantity for at least one batch.'); return; } this.returnSaving.set(true); this.api.recordPharmacyPurchaseReturn({ ...value, lines }).subscribe({ next: () => { this.returnSaving.set(false); this.returnOpen.set(false); this.toast.success('Supplier return posted and stock deducted.'); this.loadAll(); if (this.selectedInvoiceId()) this.loadDetail(this.selectedInvoiceId()); }, error: (error) => { this.returnSaving.set(false); this.toast.error(error?.error?.message ?? 'Supplier return could not be posted.'); } }); }

  openStatement(supplierId?: string): void { if (supplierId) this.statementSupplierId.set(supplierId); if (!this.statementSupplierId()) return; this.statementOpen.set(true); this.loadStatement(); }
  loadStatement(): void { const supplierId = this.statementSupplierId(); if (!supplierId) return; this.statementLoading.set(true); this.api.getPharmacySupplierStatement(supplierId, this.statementForm.controls.startDate.value ?? '', this.statementForm.controls.endDate.value ?? '').subscribe({ next: (statement) => { this.statement.set(statement); this.statementLoading.set(false); }, error: (error) => { this.statementLoading.set(false); this.toast.error(error?.error?.message ?? 'Supplier statement could not be loaded.'); } }); }
  printStatement(): void { const account = this.statement(); if (!account) return; const windowRef = window.open('', '_blank', 'width=1100,height=760'); if (!windowRef) { this.toast.error('Allow pop-ups to print the supplier statement.'); return; } const rows = account.entries.map((entry: any) => `<tr><td>${new Date(entry.date).toLocaleDateString()}</td><td>${this.escape(entry.type)}</td><td>${this.escape(entry.reference)}</td><td>${this.escape(entry.description)}</td><td>${this.escape(entry.location.code)}</td><td>${entry.debit ? Number(entry.debit).toFixed(2) : '—'}</td><td>${entry.credit ? Number(entry.credit).toFixed(2) : '—'}</td><td>${Number(entry.balance).toFixed(2)}</td></tr>`).join(''); windowRef.document.write(`<html><head><title>Supplier statement - ${this.escape(account.supplier.name)}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}header{display:flex;justify-content:space-between;border-bottom:2px solid #0f8f7f;padding-bottom:14px}h1{font-size:22px;margin:0}p{color:#59677d}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{padding:8px;border:1px solid #d8e0e8;text-align:left;font-size:12px}th{background:#f3f7f6}.totals{margin-top:18px;text-align:right;font-size:14px}</style></head><body><header><div><h1>Supplier Statement</h1><p>${this.escape(account.supplier.name)} · ${this.escape(account.supplier.supplierCode)}</p></div><p>Printed ${new Date().toLocaleString()}</p></header><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Location</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><strong>Balance: GHS ${Number(account.totals.balance).toFixed(2)}</strong></div></body></html>`); windowRef.document.close(); windowRef.focus(); windowRef.print(); }

  statusLabel(invoice: any): string { if (invoice.isOverdue) return 'Overdue'; return ({ partially_paid: 'Part paid', credit_due: 'Credit due' } as Record<string, string>)[invoice.status] ?? String(invoice.status).replaceAll('_', ' '); }
  statusClass(invoice: any): string { if (invoice.isOverdue) return 'status--overdue'; if (invoice.status === 'paid') return 'status--paid'; if (invoice.status === 'partially_paid') return 'status--partial'; if (invoice.status === 'credit_due') return 'status--credit'; return ''; }
  methodLabel(value: string): string { return ({ mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer' } as Record<string, string>)[value] ?? String(value ?? '').replaceAll('_', ' '); }
  private userRoles(): number[] { const user = this.session.currentUser(); return user ? (Array.isArray(user.roles) ? user.roles.map(Number) : [Number(user.role)]) : []; }
  private escape(value: unknown): string { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character)); }
}
