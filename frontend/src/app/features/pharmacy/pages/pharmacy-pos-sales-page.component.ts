import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { getInternetDate } from '../../../core/utils/clock';

interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  unitOfMeasure: string;
  packageLabel: string;
  minimumSaleQuantity: number;
  quantityStep: number;
  allowLooseSale: boolean;
  sellingPrice: number;
  quantity: number;
  maxQuantity: number;
}

@Component({
  selector: 'app-pharmacy-pos-sales',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pos-shell" [class.printing-document]="receiptSale() || completedClosure()">
      <header class="pos-header">
        <div>
          <span class="eyebrow">Counter workspace</span>
          <h1>Pharmacy POS</h1>
          <p>Dispense safely, collect payment, and keep every shift accountable.</p>
        </div>
        <div class="register-state" [class.closed]="!activeSession()">
          <span class="status-dot"></span>
          <div>
            <small>Register</small>
            @if (sessionLoading()) {
              <strong>Checking shift</strong>
            } @else if (activeSession()) {
              <strong>Open</strong>
              <span>Float GHS {{ money(openingFloat()) }}</span>
            } @else {
              <strong>Closed</strong>
              <span>Payment disabled</span>
            }
          </div>
          @if (!activeSession() && !sessionLoading()) {
            <label class="open-register-control">
              <span>Opening float</span>
              <input type="number" min="0" step="0.01" [ngModel]="openingFloatInput()" (ngModelChange)="openingFloatInput.set(+$event)" />
            </label>
            <button type="button" class="button primary" [disabled]="openingRegister()" (click)="openRegister()">
              {{ openingRegister() ? 'Opening…' : 'Open register' }}
            </button>
          }
        </div>
      </header>

      <nav class="pos-tabs" aria-label="POS sections">
        @for (item of tabs; track item.value) {
          <button type="button" [class.active]="activeTab() === item.value" (click)="setTab(item.value)">
            {{ item.label }}
            @if (item.value === 'history') { <span>{{ recentSales().length }}</span> }
          </button>
        }
      </nav>

      @if (activeTab() === 'sale') {
        <section class="sale-workspace">
          <section class="catalogue-pane">
            <div class="search-row">
              <label class="search-field">
                <span class="sr-only">Search medicine catalogue</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input
                  type="search"
                  autocomplete="off"
                  placeholder="Scan barcode or search name, generic, brand, code…"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  (keydown.enter)="handleSearchEnter()"
                />
                @if (searchQuery()) { <button type="button" aria-label="Clear search" (click)="searchQuery.set('')">×</button> }
              </label>
              <button type="button" class="button" (click)="loadProducts()">Refresh stock</button>
            </div>

            @if (productsLoading()) {
              <div class="product-skeleton" aria-label="Loading medicines">
                @for (line of [1,2,3,4,5]; track line) { <span></span> }
              </div>
            } @else if (productsError()) {
              <div class="state error"><strong>Stock could not be loaded</strong><p>{{ productsError() }}</p><button type="button" class="button" (click)="loadProducts()">Try again</button></div>
            } @else {
              <div class="product-list">
                @for (product of filteredProducts(); track product.id) {
                  <article class="product-row" [class.product-row--unavailable]="!canSellProduct(product)">
                    <button type="button" class="product-summary" [disabled]="!canSellProduct(product)" (click)="addToCart(product)">
                      <span class="product-name"><strong>{{ productTitle(product) }}</strong><small>{{ productClinicalLine(product) }}</small><em>{{ productPackageLabel(product) }}</em></span>
                      <span class="product-alerts">
                        @if (product.hasExpiredStock) { <span class="expiry-badge">Expired batch</span> }
                        @if (product.hasNearExpiryStock) { <span class="near-expiry-badge">Near expiry</span> }
                        @if (!canSellProduct(product)) { <span class="unavailable-badge">{{ productUnavailableReason(product) }}</span> }
                      </span>
                      <span class="stock-figure">
                        <span class="stock-total"><strong>{{ product.stockOnHand | number:'1.0-2' }}</strong><span>{{ stockUnitLabel(product) }}</span></span>
                        <span class="stock-meter" [ngClass]="stockTone(product)" aria-hidden="true">
                          @for (bar of stockBars; track bar) { <i [class.filled]="bar <= stockMeterLevel(product)"></i> }
                        </span>
                      </span>
                      <span class="price-figure"><small>Unit price</small><strong>GHS {{ money(product.defaultSellingPrice) }}</strong></span>
                    </button>
                  </article>
                } @empty {
                  <div class="state"><strong>No sellable medicines found</strong><p>Try another name or barcode. Expired, quarantined, reserved, and exhausted batches are excluded.</p></div>
                }
              </div>
            }
          </section>

          <aside class="cart-pane">
            <header><div><span class="eyebrow">Current sale</span><h2>Checkout</h2></div><span class="line-count">{{ cart().length }} line{{ cart().length === 1 ? '' : 's' }}</span></header>
            <div class="cart-lines">
              @for (item of cart(); track item.productId) {
                <article class="cart-line">
                  <div><strong>{{ item.productName }}</strong><small>{{ item.packageLabel }} · {{ item.allowLooseSale ? 'Loose sale allowed' : 'Whole packages only' }}</small></div>
                  <div class="quantity-control"><button type="button" aria-label="Reduce quantity" [disabled]="item.quantity <= item.minimumSaleQuantity" (click)="updateQuantity(item,-item.quantityStep)">−</button><input type="number" [min]="item.minimumSaleQuantity" [step]="item.quantityStep" [max]="item.maxQuantity" [ngModel]="item.quantity" (ngModelChange)="setQuantity(item,$event)" /><button type="button" aria-label="Increase quantity" [disabled]="item.quantity + item.quantityStep > item.maxQuantity" (click)="updateQuantity(item,item.quantityStep)">+</button></div>
                  <div class="line-price"><strong>GHS {{ money(item.sellingPrice * item.quantity) }}</strong><small>{{ money(item.sellingPrice) }} each</small></div>
                  <button type="button" class="remove-cart-line" [attr.aria-label]="'Remove ' + item.productName" (click)="removeFromCart(item.productId)">Remove</button>
                </article>
              } @empty {
                <div class="empty-cart"><span>0</span><strong>No medicines selected</strong><p>Search or scan a medicine, then click it to add it.</p></div>
              }
            </div>

            @if (cart().length) {
              <section class="checkout-fields">
                <label><span>Customer name <small>optional</small></span><input type="text" [ngModel]="customerName()" (ngModelChange)="customerName.set($event)" placeholder="Walk-in customer" /></label>
                <fieldset><legend>Payment method</legend><div class="payment-options"><button type="button" [class.active]="paymentMethod() === 'cash'" (click)="selectPayment('cash')">Cash</button><button type="button" [class.active]="paymentMethod() === 'mobile_money'" (click)="selectPayment('mobile_money')">Mobile Money</button></div></fieldset>
                @if (paymentMethod() === 'cash') {
                  <label><span>Cash received</span><div class="money-input"><b>GHS</b><input type="number" min="0" step="0.01" [ngModel]="cashTendered()" (ngModelChange)="cashTendered.set($event === null ? null : +$event)" /><button type="button" (click)="cashTendered.set(cartTotal())">Exact</button></div></label>
                } @else {
                  <label><span>MoMo transaction reference</span><input type="text" [ngModel]="mobileMoneyReference()" (ngModelChange)="mobileMoneyReference.set($event)" placeholder="Required reference" /></label>
                }
              </section>
              <footer class="checkout-total">
                <div><span>Total</span><strong>GHS {{ money(cartTotal()) }}</strong></div>
                @if (paymentMethod() === 'cash') { <p [class.insufficient]="changeDue() < 0">{{ changeDue() < 0 ? 'Still due' : 'Change due' }} <strong>GHS {{ money(Math.abs(changeDue())) }}</strong></p> }
                <button type="button" class="pay-button" [disabled]="!canCheckout()" (click)="checkout()">{{ checkoutLoading() ? 'Processing sale…' : 'Complete payment' }}</button>
              </footer>
            }
          </aside>
        </section>
      } @else if (activeTab() === 'history') {
        <section class="list-page">
          <header><div><span class="eyebrow">Current location</span><h2>Recent transactions</h2><p>Review completed sales and reprint an exact server-backed receipt.</p></div><button type="button" class="button" (click)="loadRecentSales()">Refresh history</button></header>
          <div class="history-table"><table><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Payment</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
            @for (sale of recentSales(); track sale.id) {<tr><td><strong>{{ sale.saleNumber }}</strong><small>{{ sale.items.length }} line{{ sale.items.length === 1 ? '' : 's' }}</small></td><td>{{ sale.paidAt | date:'medium' }}</td><td>{{ saleCustomer(sale) }}</td><td>{{ sale.soldByUser?.fullName || sale.soldByUser?.username || '—' }}</td><td>{{ paymentLabel(sale.paymentMethod) }}<small>{{ sale.referenceNumber || '' }}</small></td><td><strong>GHS {{ money(sale.total) }}</strong></td><td><span class="sale-status" [class.voided]="sale.status === 'voided'">{{ sale.status }}</span></td><td><button type="button" class="text-button" (click)="openReceipt(sale)">Receipt</button></td></tr>}
            @empty {<tr><td colspan="8" class="state">No transactions recorded at this location.</td></tr>}
          </tbody></table></div>
        </section>
      } @else {
        <section class="closure-page">
          <header><div><span class="eyebrow">Register control</span><h2>Close cashier shift</h2><p>Count each payment channel and document any difference before locking the session.</p></div><button type="button" class="button" (click)="loadUnclosedSales()">Recalculate</button></header>
          @if (!activeSession()) {
            <div class="state"><strong>No open register</strong><p>Open a register from the Sale tab before collecting payment.</p></div>
          } @else {
            <div class="closure-grid">
              <section class="expected-ledger"><span class="eyebrow">System ledger</span><h3>Expected position</h3><dl><div><dt>Opening float</dt><dd>GHS {{ money(openingFloat()) }}</dd></div><div><dt>Cash sales</dt><dd>GHS {{ money(unclosedCashTotal()) }}</dd></div><div><dt>Expected cash</dt><dd>GHS {{ money(expectedCashTotal()) }}</dd></div><div><dt>Expected MoMo</dt><dd>GHS {{ money(unclosedMomoTotal()) }}</dd></div><div class="total"><dt>Total expected</dt><dd>GHS {{ money(expectedTotal()) }}</dd></div></dl><p>{{ unclosedSalesCount() }} non-voided transaction{{ unclosedSalesCount() === 1 ? '' : 's' }} in this shift.</p></section>
              <section class="count-form"><span class="eyebrow">Physical count</span><h3>Confirm actual balances</h3><label><span>Cash counted</span><input type="number" min="0" step="0.01" [ngModel]="cashCounted()" (ngModelChange)="cashCounted.set($event === null ? null : +$event)" /></label><label><span>MoMo confirmed</span><input type="number" min="0" step="0.01" [ngModel]="momoCounted()" (ngModelChange)="momoCounted.set($event === null ? null : +$event)" /></label><div class="variance" [class.clear]="discrepancy() === 0"><span>Calculated discrepancy</span><strong>{{ discrepancy() > 0 ? '+' : '' }}GHS {{ money(discrepancy()) }}</strong></div><label><span>Reconciliation notes @if(discrepancy() !== 0){<b>required</b>}</span><textarea [ngModel]="closureNotes()" (ngModelChange)="closureNotes.set($event)" placeholder="Explain shortages, surpluses, wallet checks, or handover notes"></textarea></label><button type="button" class="button primary wide" [disabled]="!canCloseSession()" (click)="closeSession()">{{ closingSession() ? 'Closing shift…' : 'Close and lock shift' }}</button></section>
            </div>
          }
        </section>
      }

      @if (receiptSale()) {
        <div class="document-backdrop no-print" (click)="closeReceipt()"></div>
        <section class="print-layer receipt-document" [class.narrow]="receiptWidth() === '58mm'" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <header><span>OFFICIAL RECEIPT</span><h2 id="receipt-title">{{ settings()?.clinicName || receiptSale().location?.name || 'PharmaFlow Pharmacy' }}</h2><p>{{ receiptSale().location?.name }} · {{ receiptSale().location?.address || settings()?.location || '' }}</p><p>{{ receiptSale().location?.phone || settings()?.phone || '' }}</p></header>
          <div class="receipt-meta"><div><span>Receipt</span><strong>{{ receiptSale().saleNumber }}</strong></div><div><span>Date</span><strong>{{ receiptSale().paidAt | date:'yyyy-MM-dd HH:mm' }}</strong></div><div><span>Cashier</span><strong>{{ receiptSale().soldByUser?.fullName || receiptSale().soldByUser?.username || '—' }}</strong></div><div><span>Customer</span><strong>{{ saleCustomer(receiptSale()) }}</strong></div></div>
          <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>@for(item of receiptSale().items;track item.id || item.batchId){<tr><td><strong>{{item.itemName}}</strong><small>{{ receiptBatch(item) }}</small></td><td>{{item.quantity}}</td><td>{{money(item.unitPrice)}}</td><td>{{money(item.lineTotal)}}</td></tr>}</tbody></table>
          <div class="receipt-total"><span>Total paid</span><strong>GHS {{ money(receiptSale().total) }}</strong></div>
          <div class="receipt-payment"><span>{{ paymentLabel(receiptSale().paymentMethod) }}</span>@if(receiptSale().referenceNumber){<strong>Ref: {{receiptSale().referenceNumber}}</strong>}@if(receiptSale().paymentMethod === 'cash' && receiptSale().cashTendered !== undefined){<strong>Received GHS {{money(receiptSale().cashTendered)}} · Change GHS {{money(receiptSale().changeDue)}}</strong>}</div>
          @if(receiptSale().status === 'voided'){<div class="void-banner">VOIDED · {{receiptSale().voidReason}}</div>}
          <footer><p>{{ settings()?.receiptFooter || 'Thank you. Keep this receipt for your records.' }}</p><p>Medicines should be stored and used as directed.</p><div class="document-actions no-print"><div><button type="button" [class.active]="receiptWidth() === '58mm'" (click)="receiptWidth.set('58mm')">58 mm</button><button type="button" [class.active]="receiptWidth() === '80mm'" (click)="receiptWidth.set('80mm')">80 mm</button></div><button type="button" class="button" (click)="closeReceipt()">Close</button><button type="button" class="button primary" (click)="printDocument()">Print receipt</button></div></footer>
        </section>
      }

      @if (completedClosure()) {
        <div class="document-backdrop no-print" (click)="closeClosureSlip()"></div>
        <section class="print-layer receipt-document" role="dialog" aria-modal="true" aria-labelledby="closure-title">
          <header><span>SHIFT RECONCILIATION</span><h2 id="closure-title">{{ completedClosure().location?.name || settings()?.clinicName || 'PharmaFlow Pharmacy' }}</h2><p>Closed by {{ completedClosure().closedByUser?.fullName || completedClosure().closedByUser?.username || '—' }}</p></header>
          <div class="receipt-meta"><div><span>Closure</span><strong>{{ completedClosure().id.slice(-8).toUpperCase() }}</strong></div><div><span>Closed</span><strong>{{ completedClosure().closureDate | date:'yyyy-MM-dd HH:mm' }}</strong></div></div>
          <table><thead><tr><th>Channel</th><th>Expected</th><th>Counted</th></tr></thead><tbody><tr><td>Cash</td><td>{{money(completedClosure().expectedCash)}}</td><td>{{money(completedClosure().cashCounted)}}</td></tr><tr><td>Mobile Money</td><td>{{money(completedClosure().expectedMomo)}}</td><td>{{money(completedClosure().momoCounted)}}</td></tr></tbody></table>
          <div class="receipt-total"><span>Discrepancy</span><strong>{{completedClosure().discrepancy > 0 ? '+' : ''}}GHS {{money(completedClosure().discrepancy)}}</strong></div>
          <div class="receipt-payment"><span>{{completedClosure().totalSalesCount}} transactions · sales GHS {{money(completedClosure().totalSalesAmount)}}</span></div>
          @if(completedClosure().notes){<div class="closure-note"><strong>Notes</strong><p>{{completedClosure().notes}}</p></div>}
          <footer><p>Cashier signature ____________________</p><p>Supervisor signature ____________________</p><div class="document-actions no-print"><button type="button" class="button" (click)="closeClosureSlip()">Close</button><button type="button" class="button primary" (click)="printDocument()">Print closure</button></div></footer>
        </section>
      }
    </main>
  `,
  styleUrls: ['./pharmacy-pos-sales-page.component.scss', './pharmacy-pos-sales-page.overrides.scss'],
})
export class PharmacyPosSalesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly tabs = [
    { label: 'Sale', value: 'sale' as const },
    { label: 'Transactions', value: 'history' as const },
    { label: 'Close shift', value: 'close' as const },
  ];
  readonly Math = Math;
  readonly stockBars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly activeTab = signal<'sale' | 'history' | 'close'>('sale');
  readonly products = signal<any[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError = signal('');
  readonly recentSales = signal<any[]>([]);
  readonly settings = signal<any>(null);
  readonly searchQuery = signal('');
  readonly cart = signal<CartItem[]>([]);
  readonly customerName = signal('');
  readonly paymentMethod = signal<'cash' | 'mobile_money'>('cash');
  readonly mobileMoneyReference = signal('');
  readonly cashTendered = signal<number | null>(null);
  readonly checkoutLoading = signal(false);
  readonly receiptSale = signal<any | null>(null);
  readonly receiptFromCheckout = signal(false);
  readonly receiptWidth = signal<'58mm' | '80mm'>('80mm');

  readonly activeSession = signal<any | null>(null);
  readonly sessionLoading = signal(true);
  readonly openingRegister = signal(false);
  readonly openingFloat = signal(0);
  readonly openingFloatInput = signal(0);
  readonly unclosedSalesCount = signal(0);
  readonly unclosedSalesTotal = signal(0);
  readonly unclosedCashTotal = signal(0);
  readonly unclosedMomoTotal = signal(0);
  readonly cashCounted = signal<number | null>(null);
  readonly momoCounted = signal<number | null>(null);
  readonly closureNotes = signal('');
  readonly closingSession = signal(false);
  readonly completedClosure = signal<any | null>(null);

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const matches = !query ? this.products() : this.products().filter((product) => [product.name, product.genericName, product.brandName, product.manufacturer, product.strength, product.productCode, product.barcode]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)));
    return query ? matches : matches.filter((product) => this.canSellProduct(product));
  });
  readonly cartTotal = computed(() => this.cart().reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0));
  readonly changeDue = computed(() => Number(this.cashTendered() ?? 0) - this.cartTotal());
  readonly expectedCashTotal = computed(() => this.openingFloat() + this.unclosedCashTotal());
  readonly expectedTotal = computed(() => this.expectedCashTotal() + this.unclosedMomoTotal());
  readonly countedTotal = computed(() => Number(this.cashCounted() ?? 0) + Number(this.momoCounted() ?? 0));
  readonly discrepancy = computed(() => this.countedTotal() - this.expectedTotal());
  readonly canCheckout = computed(() => {
    if (this.checkoutLoading() || !this.activeSession() || !this.cart().length) return false;
    if (this.paymentMethod() === 'mobile_money') return this.mobileMoneyReference().trim().length > 0;
    return this.cashTendered() !== null && Number(this.cashTendered()) >= this.cartTotal();
  });
  readonly canCloseSession = computed(() => {
    if (!this.activeSession() || this.closingSession() || this.cashCounted() === null || this.momoCounted() === null) return false;
    return Math.abs(this.discrepancy()) < 0.005 || this.closureNotes().trim().length >= 5;
  });

  ngOnInit(): void {
    this.loadProducts();
    this.loadRecentSales();
    this.loadActiveSession();
    this.api.getSettings().subscribe({ next: (settings) => this.settings.set(settings) });
  }

  setTab(tab: 'sale' | 'history' | 'close'): void {
    this.activeTab.set(tab);
    if (tab === 'history') this.loadRecentSales();
    if (tab === 'close') this.loadUnclosedSales();
  }

  loadProducts(): void {
    this.productsLoading.set(true);
    this.productsError.set('');
    this.api.getPharmacyProducts().subscribe({
      next: (products) => {
        const now = getInternetDate();
        this.products.set((products ?? []).filter((product) => product.isActive !== false && product.isAvailableForSale !== false).map((product) => {
          const allBatches = product.batches ?? [];
          const batches = allBatches.filter((batch: any) => this.availableQuantity(batch) > 0 && new Date(batch.expiryDate) > now);
          const hasExpiredStock = allBatches.some((batch: any) => this.availableQuantity(batch) > 0 && new Date(batch.expiryDate) <= now);
          const nearExpiryLimit = new Date(now.getTime() + 90 * 86_400_000);
          const hasNearExpiryStock = batches.some((batch: any) => new Date(batch.expiryDate) <= nearExpiryLimit);
          return { ...product, batches, hasExpiredStock, hasNearExpiryStock, stockOnHand: batches.reduce((sum: number, batch: any) => sum + this.availableQuantity(batch), 0) };
        }));
        this.productsLoading.set(false);
      },
      error: (error) => {
        this.productsError.set(error?.error?.message ?? 'Check the active pharmacy location and try again.');
        this.productsLoading.set(false);
      },
    });
  }

  loadRecentSales(): void {
    this.api.getRecentPharmacySales().subscribe({ next: (sales) => this.recentSales.set(sales ?? []) });
  }

  loadActiveSession(): void {
    this.sessionLoading.set(true);
    this.api.getActiveSession().subscribe({
      next: (session) => {
        this.activeSession.set(session ?? null);
        this.openingFloat.set(Number(session?.openingFloat ?? 0));
        this.sessionLoading.set(false);
      },
      error: () => { this.activeSession.set(null); this.sessionLoading.set(false); },
    });
  }

  openRegister(): void {
    const amount = Number(this.openingFloatInput());
    if (!Number.isFinite(amount) || amount < 0) return;
    this.openingRegister.set(true);
    this.api.openSession(amount).subscribe({
      next: (session) => { this.activeSession.set(session); this.openingFloat.set(Number(session.openingFloat)); this.openingRegister.set(false); },
      error: (error) => { this.openingRegister.set(false); this.toast.error(error?.error?.message ?? 'Unable to open register.'); },
    });
  }

  handleSearchEnter(): void {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return;
    const product = this.products().find((item) => [item.barcode, item.productCode].some((value) => String(value ?? '').trim().toLowerCase() === query));
    if (!product) return;
    if (!this.canSellProduct(product)) {
      this.toast.error(`${this.productTitle(product)} cannot be added: ${this.productUnavailableReason(product).toLowerCase()}.`);
      return;
    }
    this.addToCart(product);
    this.searchQuery.set('');
  }

  addToCart(product: any): void {
    const rawSellingPrice = product.defaultSellingPrice;
    const sellingPrice = Number(rawSellingPrice);
    if (rawSellingPrice === null || rawSellingPrice === undefined || !Number.isFinite(sellingPrice)) {
      this.toast.error(`Set a selling price for ${product.name} before adding it to a sale.`);
      return;
    }
    const minimumSaleQuantity = this.effectiveMinimumSaleQuantity(product);
    const quantityStep = this.saleQuantityStep(product);
    this.cart.update((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) return items.map((item) => {
        if (item.productId !== product.id) return item;
        const requested = Math.min(item.quantity + item.quantityStep, item.maxQuantity);
        const quantity = item.allowLooseSale ? requested : Math.floor(requested / item.quantityStep) * item.quantityStep;
        return { ...item, quantity: Math.max(item.minimumSaleQuantity, quantity) };
      });
      return [...items, {
        productId: product.id,
        productName: product.name,
        productCode: product.productCode ?? '',
        unitOfMeasure: product.sellingUnit ?? product.unitOfMeasure ?? 'unit',
        packageLabel: this.productPackageLabel(product),
        minimumSaleQuantity,
        quantityStep,
        allowLooseSale: product.allowLooseSale === true,
        sellingPrice,
        quantity: minimumSaleQuantity,
        maxQuantity: Number(product.stockOnHand ?? 0),
      }];
    });
  }

  updateQuantity(item: CartItem, delta: number): void { this.setQuantity(item, item.quantity + delta); }

  setQuantity(item: CartItem, value: number): void {
    const quantity = Math.floor(Number(value));
    if (!Number.isFinite(quantity)) return;
    const normalized = item.allowLooseSale
      ? Math.max(item.minimumSaleQuantity, Math.min(quantity, item.maxQuantity))
      : Math.max(item.minimumSaleQuantity, Math.min(Math.floor(quantity / item.quantityStep) * item.quantityStep, item.maxQuantity));
    this.cart.update((items) => items.map((line) => line.productId === item.productId ? { ...line, quantity: normalized } : line));
  }

  removeFromCart(productId: string): void { this.cart.update((items) => items.filter((item) => item.productId !== productId)); }

  selectPayment(method: 'cash' | 'mobile_money'): void {
    this.paymentMethod.set(method);
    if (method === 'cash') this.mobileMoneyReference.set('');
    else this.cashTendered.set(null);
  }

  checkout(): void {
    if (!this.canCheckout()) return;
    this.checkoutLoading.set(true);
    const cashTendered = this.paymentMethod() === 'cash' ? Number(this.cashTendered()) : undefined;
    this.api.processPharmacySale({
      customerName: this.customerName().trim() || null,
      paymentMethod: this.paymentMethod(),
      referenceNumber: this.mobileMoneyReference().trim() || null,
      items: this.cart().map((item) => ({ productId: item.productId, quantity: item.quantity })),
    }).subscribe({
      next: (sale) => {
        if (sale?.id) {
          this.completeCheckout(sale, cashTendered);
          return;
        }
        this.checkoutLoading.set(false);
        this.toast.error('The server did not return a receipt. Check Transactions before attempting another payment.');
      },
      error: (error) => { this.checkoutLoading.set(false); this.toast.error(error?.error?.message ?? 'Unable to complete sale.'); },
    });
  }

  openReceipt(sale: any): void { this.receiptFromCheckout.set(false); this.receiptSale.set(sale); }

  closeReceipt(): void {
    this.receiptSale.set(null);
    this.receiptFromCheckout.set(false);
  }

  loadUnclosedSales(): void {
    this.api.getPharmacyUnclosedSales().subscribe({ next: (summary) => {
      this.unclosedSalesCount.set(Number(summary.salesCount ?? 0));
      this.unclosedSalesTotal.set(Number(summary.salesTotal ?? 0));
      this.unclosedCashTotal.set(Number(summary.cashTotal ?? 0));
      this.unclosedMomoTotal.set(Number(summary.momoTotal ?? 0));
      this.openingFloat.set(Number(summary.openingFloat ?? this.openingFloat()));
    }});
  }

  closeSession(): void {
    if (!this.canCloseSession()) return;
    this.closingSession.set(true);
    this.api.closePharmacySales({ cashCounted: this.cashCounted(), momoCounted: this.momoCounted(), notes: this.closureNotes().trim() || null }).subscribe({
      next: (closure) => {
        this.closingSession.set(false);
        this.completedClosure.set(closure);
        this.activeSession.set(null);
        this.openingFloat.set(0);
      },
      error: (error) => { this.closingSession.set(false); this.toast.error(error?.error?.message ?? 'Unable to close shift.'); },
    });
  }

  closeClosureSlip(): void {
    this.completedClosure.set(null);
    this.cashCounted.set(null);
    this.momoCounted.set(null);
    this.closureNotes.set('');
    this.activeTab.set('sale');
  }

  printDocument(): void { window.print(); }
  private completeCheckout(sale: any, cashTendered?: number): void {
    this.checkoutLoading.set(false);
    this.receiptFromCheckout.set(true);
    this.receiptSale.set({ ...sale, cashTendered, changeDue: cashTendered === undefined ? undefined : cashTendered - Number(sale.total) });
    this.recentSales.update((sales) => [sale, ...sales.filter((item) => item.id !== sale.id)].slice(0, 30));
    this.cart.set([]);
    this.customerName.set('');
    this.mobileMoneyReference.set('');
    this.cashTendered.set(null);
    this.searchQuery.set('');
    this.loadProducts();
    this.toast.success(`Sale ${sale.saleNumber} completed.`);
  }
  availableQuantity(batch: any): number { return Math.max(0, Number(batch?.availableQuantity ?? batch?.quantityRemaining ?? 0)); }
  stockTone(product: any): string {
    const stock = Number(product.stockOnHand ?? 0);
    const reorderLevel = Number(product.reorderLevel ?? 0);
    if (stock <= reorderLevel) return 'stock-pill--critical';
    if (reorderLevel > 0 && stock <= reorderLevel * 1.5) return 'stock-pill--low';
    return 'stock-pill--healthy';
  }
  stockMeterLevel(product: any): number {
    const stock = Number(product.stockOnHand ?? 0);
    const reorderLevel = Number(product.reorderLevel ?? 0);
    if (stock <= 0) return 0;
    if (reorderLevel <= 0) return 10;
    return Math.min(10, Math.max(1, Math.ceil((stock / reorderLevel) * 5)));
  }
  stockUnitLabel(product: any): string {
    const unit = String(product.sellingUnit ?? product.unitOfMeasure ?? 'unit');
    return Number(product.stockOnHand) === 1 || unit.endsWith('s') ? unit : `${unit}s`;
  }
  productTitle(product: any): string { return String(product.brandName || product.genericName || product.name || 'Unnamed product'); }
  productClinicalLine(product: any): string {
    const genericName = product.brandName && product.genericName ? product.genericName : null;
    return [genericName, product.strength, product.dosageForm].filter(Boolean).join(' · ') || 'Clinical details not recorded';
  }
  productPackageLabel(product: any): string {
    const packageType = product.packageType || product.defaultPurchaseUnit || 'package';
    const quantity = Number(product.packageQuantity ?? product.defaultUnitsPerPack ?? 1);
    const unit = product.packageUnit || product.sellingUnit || product.unitOfMeasure || 'unit';
    return `${packageType} of ${quantity} ${quantity === 1 ? unit : this.pluralize(unit)}`;
  }
  productUnavailableReason(product: any): string {
    if (product.defaultSellingPrice === null || product.defaultSellingPrice === undefined || !Number.isFinite(Number(product.defaultSellingPrice))) return 'No selling price';
    if (Number(product.stockOnHand ?? 0) < this.effectiveMinimumSaleQuantity(product)) return product.hasExpiredStock ? 'Expired stock only' : 'Out of stock';
    return 'Unavailable';
  }
  canSellProduct(product: any): boolean {
    const price = Number(product.defaultSellingPrice);
    return product.defaultSellingPrice !== null && product.defaultSellingPrice !== undefined && Number.isFinite(price) && Number(product.stockOnHand ?? 0) >= this.effectiveMinimumSaleQuantity(product);
  }
  private effectiveMinimumSaleQuantity(product: any): number {
    const configuredMinimum = Math.max(1, Math.floor(Number(product.minimumSaleQuantity ?? 1)));
    if (product.allowLooseSale === true) return configuredMinimum;
    return Math.max(configuredMinimum, Math.floor(Number(product.packageQuantity ?? product.defaultUnitsPerPack ?? 1)));
  }
  private saleQuantityStep(product: any): number { return product.allowLooseSale === true ? 1 : this.effectiveMinimumSaleQuantity(product); }
  private pluralize(unit: string): string { return unit.endsWith('s') ? unit : `${unit}s`; }
  money(value: unknown): string { return Number(value ?? 0).toFixed(2); }
  paymentLabel(method: string): string { return method === 'mobile_money' ? 'Mobile Money' : 'Cash'; }
  initials(value: string): string { return String(value ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'RX'; }
  patientName(prescription: any): string { const patient = prescription?.visit?.patient; return patient ? `${patient.surname}, ${patient.firstName}` : 'Clinic patient'; }
  saleCustomer(sale: any): string { return sale?.customerName || (sale?.prescription ? this.patientName(sale.prescription) : 'Walk-in customer'); }
  receiptBatch(item: any): string { return item.batch?.batchNumber ? `Batch ${item.batch.batchNumber}` : 'Batch recorded in stock ledger'; }
}
