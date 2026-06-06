import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

interface CartItem {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  sellingPrice: number;
  quantity: number;
  maxQuantity: number;
}

@Component({
  selector: 'app-pharmacy-pos-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pharmacy-workspace" [class.pharmacy-pos-grid]="activeTab() !== 'end_of_day'" [style.grid-template-columns]="activeTab() === 'end_of_day' ? '1fr' : null">
      
      <!-- Catalog / Prescription Work area -->
      <div class="panel" *ngIf="!showThermalReceipt() && !showThermalClosureSlip()">
        <div class="panel-header" style="border-bottom: 1px solid var(--app-border-color); padding-bottom: 0.5rem;">
          <div class="tab-selector" style="display: flex; gap: 1rem;">
            <button
              class="btn"
              [class.btn-primary]="activeTab() === 'walk_in'"
              [class.btn-secondary]="activeTab() !== 'walk_in'"
              (click)="setTab('walk_in')"
            >
              🛒 Direct Walk-In Sale
            </button>
            <button
              class="btn"
              [class.btn-primary]="activeTab() === 'referred'"
              [class.btn-secondary]="activeTab() !== 'referred'"
              (click)="setTab('referred')"
            >
              📋 Clinic Prescriptions Queue
            </button>
            <button
              class="btn"
              [class.btn-primary]="activeTab() === 'end_of_day'"
              [class.btn-secondary]="activeTab() !== 'end_of_day'"
              (click)="setTab('end_of_day')"
            >
              ⏰ End of Day
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" (click)="loadInitialData()">
            🔄 Refresh
          </button>
        </div>

        <!-- Direct Walkin Picker -->
        <div *ngIf="activeTab() === 'walk_in'" style="margin-top: 1rem;">
          <div class="search-box">
            <input
              type="text"
              placeholder="Search medicine stock catalog..."
              [(ngModel)]="searchQuery"
              class="form-control search-input"
            />
            <span class="search-icon">🔍</span>
          </div>

          <div class="pos-product-picker" *ngIf="filteredProducts().length > 0; else noProducts">
            <div *ngFor="let p of filteredProducts()" class="pos-product-card" (click)="openBatchSelect(p)">
              <div>
                <div class="name">{{ p.name }}</div>
                <div class="stock-desc">Stock: <strong>{{ p.qtyOnHand }} units</strong> across {{ p.batches?.length || 0 }} batch(es)</div>
              </div>
              
              <!-- Batch select dropdown if clicked -->
              <div *ngIf="selectingProductId() === p.id" class="batch-select-popup mt-2" (click)="$event.stopPropagation()">
                <label class="small label">Pick Batch:</label>
                <select class="form-control form-control-sm" #bSelect>
                  <option *ngFor="let b of p.batches" [value]="b.id">
                    Batch: {{ b.batchNumber }} (₵{{ b.sellingPrice }} - {{ b.quantityRemaining }} left)
                  </option>
                </select>
                <button
                  class="btn btn-primary btn-sm btn-block mt-2"
                  (click)="addToCartFromSelect(p, bSelect.value)"
                  [disabled]="p.qtyOnHand === 0"
                >
                  Add to Cart
                </button>
              </div>

              <div class="price-strip" *ngIf="selectingProductId() !== p.id">
                <span class="small text-muted">Cost: ₵{{ getProductMinPrice(p).toFixed(2) }} - ₵{{ getProductMaxPrice(p).toFixed(2) }}</span>
                <strong style="font-size: 0.85rem; color: var(--app-primary-color);">Select Batches</strong>
              </div>
            </div>
          </div>
          
          <ng-template #noProducts>
            <div class="empty-state">
              <p>No products available in stock catalog.</p>
            </div>
          </ng-template>
        </div>

        <!-- Referred Prescriptions Queue -->
        <div *ngIf="activeTab() === 'referred'" style="margin-top: 1.25rem;">
          <p class="section-desc">Active referred prescriptions from radiology scans or lab doctor procedures.</p>
          
          <div class="referred-queue-section" *ngIf="prescriptions().length > 0; else noScripts">
            <div *ngFor="let r of prescriptions()" class="referred-prescription-card" (click)="loadPrescriptionIntoCart(r)">
              <div class="header">
                <div class="name">{{ r.visit.patient.surname }}, {{ r.visit.patient.firstName }}</div>
                <span class="code">{{ r.visit.patient.code }}</span>
              </div>
              <div class="prescription-text">{{ r.prescriptionText }}</div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--app-muted-text-color);">
                <span>Doctor Note • Visit Ref: VIS-{{ r.visitId.slice(-6).toUpperCase() }}</span>
                <span class="text-success" style="font-weight: 700;">➔ DISPENSE SCRIPT</span>
              </div>
            </div>
          </div>

          <ng-template #noScripts>
            <div class="empty-state">
              <div class="empty-icon">💊</div>
              <p>No clinic prescriptions currently in queue awaiting dispensing.</p>
            </div>
          </ng-template>
        </div>

        <!-- End of Day Drawer Closure -->
        <div *ngIf="activeTab() === 'end_of_day'" style="margin-top: 1.25rem;">
          
          <div class="closure-summary-card mb-4" style="background: var(--app-primary-soft-color); border: 1px solid rgba(49, 145, 234, 0.15); border-radius: 0.75rem; padding: 1.25rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-weight: 700; font-size: 1rem; color: var(--app-primary-color); display: flex; align-items: center; gap: 0.5rem;">
              <span>📊</span> Unclosed Sales Session Summary
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem;">
              <div style="background: #fff; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--app-border-color);">
                <div style="font-size: 0.75rem; color: var(--app-muted-text-color); font-weight: 600;">Unclosed Txns</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--app-text-color); margin-top: 0.25rem;">{{ unclosedSalesCount() }}</div>
              </div>
              <div style="background: #fff; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--app-border-color);">
                <div style="font-size: 0.75rem; color: var(--app-muted-text-color); font-weight: 600;">Expected Cash</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--app-text-color); margin-top: 0.25rem;">₵{{ unclosedCashTotal().toFixed(2) }}</div>
              </div>
              <div style="background: #fff; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--app-border-color);">
                <div style="font-size: 0.75rem; color: var(--app-muted-text-color); font-weight: 600;">Expected Momo</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--app-text-color); margin-top: 0.25rem;">₵{{ unclosedMomoTotal().toFixed(2) }}</div>
              </div>
              <div style="background: #fff; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--app-border-color);">
                <div style="font-size: 0.75rem; color: var(--app-muted-text-color); font-weight: 600;">Total System expected</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--app-primary-color); margin-top: 0.25rem;">₵{{ unclosedSalesTotal().toFixed(2) }}</div>
              </div>
            </div>
          </div>

          <div *ngIf="unclosedSalesCount() === 0" class="empty-state" style="background: #fff; border: 1px solid var(--app-border-color); border-radius: 0.75rem; padding: 3rem 1.5rem;">
            <div class="empty-icon">🎉</div>
            <p style="font-weight: 700; color: var(--app-text-color); margin-bottom: 0.25rem;">No unclosed sales found.</p>
            <p style="font-size: 0.8rem;">All transactions are successfully locked. POS drawer is clean!</p>
          </div>

          <div *ngIf="unclosedSalesCount() > 0" class="closure-form" style="background: #fff; border: 1px solid var(--app-border-color); border-radius: 0.75rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <h4 style="margin: 0; font-weight: 700; font-size: 1.05rem; color: var(--app-text-color);">Shift Register Reconciliation</h4>
            <p style="font-size: 0.8rem; color: var(--app-muted-text-color); margin: -0.75rem 0 0.25rem 0;">Count and verify the physical cash drawer and mobile money wallet balances below.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group mb-0">
                <label>Physical Cash Counted (GHS) <span style="color: var(--app-danger-color);">*</span></label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="cashCountedInput"
                  (ngModelChange)="onCashCountedChange($event)"
                  placeholder="₵0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div class="form-group mb-0">
                <label>Physical Momo Counted (GHS) <span style="color: var(--app-danger-color);">*</span></label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="momoCountedInput"
                  (ngModelChange)="onMomoCountedChange($event)"
                  placeholder="₵0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <!-- Discrepancy checker banner -->
            <div *ngIf="isInputEntered()" style="border-radius: 0.65rem; padding: 0.85rem 1.15rem; font-size: 0.85rem; font-weight: 600; display: flex; flex-direction: column; gap: 0.15rem; border: 1px solid transparent; transition: all 0.2s;"
                 [class.stock-alert-ok]="discrepancy() === 0"
                 [style.borderColor]="discrepancy() === 0 ? 'rgba(27,94,32,0.15)' : null"
                 [class.stock-alert-warning]="discrepancy() > 0"
                 [style.borderColor]="discrepancy() > 0 ? 'rgba(245,127,23,0.15)' : null"
                 [class.expiry-critical]="discrepancy() < 0"
                 [style.borderColor]="discrepancy() < 0 ? 'rgba(198,40,40,0.15)' : null">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Physical Sum Counted:</span>
                <strong>₵{{ countedTotal().toFixed(2) }}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(0,0,0,0.08); margin-top: 0.35rem; padding-top: 0.35rem;">
                <span>Session Discrepancy:</span>
                <strong>
                  ₵{{ discrepancy() >= 0 ? '+' : '' }}{{ discrepancy().toFixed(2) }}
                </strong>
              </div>
              <div style="font-size: 0.75rem; font-weight: 500; margin-top: 0.4rem;" *ngIf="discrepancy() === 0">
                🎉 Perfect balance! The drawer matches expected sales. Ready to lock shift safely.
              </div>
              <div style="font-size: 0.75rem; font-weight: 500; margin-top: 0.4rem;" *ngIf="discrepancy() > 0">
                ⚠️ Cash Surplus detected. Please fill out shift notes below explaining why the drawer has extra funds.
              </div>
              <div style="font-size: 0.75rem; font-weight: 500; margin-top: 0.4rem;" *ngIf="discrepancy() < 0">
                ⚠️ Drawer Shortage detected. Please write reconciliation explanation remarks below before submission.
              </div>
            </div>

            <div class="form-group mb-0">
              <label>Reconciliation & Shift Notes <span *ngIf="discrepancy() !== 0" style="color: var(--app-danger-color);">* (Mandatory for variance)</span></label>
              <textarea
                class="form-control"
                style="min-height: 80px; font-family: inherit; font-size: 0.85rem;"
                [(ngModel)]="closureNotesInput"
                (ngModelChange)="closureNotes.set($event)"
                placeholder="Detail discrepancies, cash count breakdowns, register discrepancies or general comments..."
              ></textarea>
            </div>

            <button
              class="btn btn-primary btn-block"
              style="padding: 0.85rem;"
              [disabled]="isSubmittingClosure() || cashCounted() === null || momoCounted() === null || (discrepancy() !== 0 && !closureNotes().trim())"
              (click)="submitClosure()"
            >
              <span *ngIf="!isSubmittingClosure()">🔐 Reconcile Drawer & Close Shift (₵{{ countedTotal().toFixed(2) }})</span>
              <span *ngIf="isSubmittingClosure()">🔐 Closing and Locking Session...</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Thermal Shift Closure slip view -->
      <div class="panel" *ngIf="showThermalClosureSlip() && completedClosure()" style="justify-content: center; align-items: center; background: transparent; border: none; box-shadow: none; padding: 0;">
        <div class="pharmacy-receipt-thermal" style="width: 76mm; border: 1px solid #a0aec0;">
          <div class="header">
            <div style="display: flex; justify-content: center; margin-bottom: 0.25rem;" *ngIf="settings()?.logo">
              <img [src]="settings().logo" alt="Clinic Logo" style="max-height: 40px; max-width: 140px; object-fit: contain; filter: grayscale(100%);" />
            </div>
            <h2>SHIFT CLOSURE SLIP</h2>
            <p>{{ settings()?.clinicName || 'ANTIGRAVITY CLINICAL PHARMACY' }}</p>
            <p>Drawer Reconciled & Shift Terminated</p>
          </div>
          
          <div class="meta">
            <div>CLOSURE ID: CL-{{ completedClosure().id.slice(-6).toUpperCase() }}</div>
            <div>DATE: {{ completedClosure().closureDate | date:'yyyy-MM-dd HH:mm' }}</div>
            <div>USER: {{ completedClosure().closedByUser?.fullName || completedClosure().closedByUser?.username }}</div>
            <div>STATUS: CLOSED & LOCKED</div>
          </div>
          
          <table class="item-table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th class="num">System</th>
                <th class="num">Counted</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cash Drawer</td>
                <td class="num">₵{{ unclosedCashTotalBackup.toFixed(2) }}</td>
                <td class="num">₵{{ completedClosure().cashCounted.toFixed(2) }}</td>
              </tr>
              <tr>
                <td>Momo Wallet</td>
                <td class="num">₵{{ unclosedMomoTotalBackup.toFixed(2) }}</td>
                <td class="num">₵{{ completedClosure().momoCounted.toFixed(2) }}</td>
              </tr>
              <tr style="border-top: 1px dashed #000; font-weight: bold;">
                <td>TOTAL</td>
                <td class="num">₵{{ completedClosure().totalSalesAmount.toFixed(2) }}</td>
                <td class="num">₵{{ completedClosure().totalCounted.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="totals">
            <div class="grand" [style.color]="completedClosure().discrepancy == 0 ? '#1b5e20' : '#c62828'">
              <span>DISCREPANCY:</span>
              <span>₵{{ completedClosure().discrepancy >= 0 ? '+' : '' }}{{ completedClosure().discrepancy.toFixed(2) }}</span>
            </div>
            <div style="font-size: 10px; margin-top: 4px;">
              <span>Total sales count:</span>
              <span>{{ completedClosure().totalSalesCount }} transactions</span>
            </div>
          </div>
          
          <div *ngIf="completedClosure().notes" style="font-size: 9px; border: 1px dashed #000; padding: 6px; margin-top: 5px; background: #fafafa;">
            <strong>Pharmacist Notes:</strong>
            <p style="margin: 2px 0 0 0; font-style: italic;">"{{ completedClosure().notes }}"</p>
          </div>
          
          <div class="footer">
            <p>Shift has been audited and finalized in database system.</p>
            <p style="margin-top: 20px;">Signature: ______________________</p>
            
            <div class="no-print mt-3" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 15px;">
              <button class="btn btn-success btn-sm" (click)="printThermalReceipt()">
                🖨️ Print Slip
              </button>
              <button class="btn btn-secondary btn-sm" (click)="closeClosureSlip()">
                ❌ Back to POS
              </button>
            </div>
          </div>
        </div>
      </div>

        <div class="pos-cart-panel">
          <h3>Shopping Checkout Cart</h3>
          
          <div class="cart-items-list" *ngIf="cart().length > 0; else emptyCart">
            <div *ngFor="let item of cart()" class="cart-item-row">
              <div class="item-info">
                <div class="name">{{ item.productName }}</div>
                <div class="batch">Batch: {{ item.batchNumber }} • Price: ₵{{ item.sellingPrice.toFixed(2) }}</div>
              </div>
              
              <div class="item-actions">
                <button (click)="updateQuantity(item, -1)">-</button>
                <span>{{ item.quantity }}</span>
                <button (click)="updateQuantity(item, 1)">+</button>
              </div>

              <div class="item-price">
                ₵{{ (item.sellingPrice * item.quantity).toFixed(2) }}
              </div>
            </div>
          </div>

          <ng-template #emptyCart>
            <div class="empty-state" style="padding: 2.5rem 1rem;">
              <div class="empty-icon">🛒</div>
              <p>Your shopping checkout cart is currently empty.</p>
            </div>
          </ng-template>

          <div class="cart-summary-card" *ngIf="cart().length > 0">
            <div class="line">
              <span>Selected Lines:</span>
              <strong>{{ cart().length }} items</strong>
            </div>
            <div class="line grand">
              <span>Total Bill (GHS):</span>
              <strong>₵{{ cartTotal().toFixed(2) }}</strong>
            </div>
          </div>

          <!-- Checkout payment form -->
          <div class="checkout-form" *ngIf="cart().length > 0" style="display: flex; flex-direction: column; gap: 0.75rem;">
            
            <div class="form-group mb-2">
              <label>Walk-In Customer Name (Optional)</label>
              <input type="text" class="form-control form-control-sm" [(ngModel)]="customerName" placeholder="e.g. Ama Serwaa" />
            </div>

            <div class="form-group mb-2">
              <label>Payment Method</label>
              <div style="display: flex; gap: 0.5rem;">
                <button
                  class="btn"
                  style="flex: 1; padding: 0.5rem;"
                  [class.btn-primary]="paymentMethod() === 'cash'"
                  [class.btn-secondary]="paymentMethod() !== 'cash'"
                  (click)="paymentMethod.set('cash')"
                >
                  💵 Cash
                </button>
                <button
                  class="btn"
                  style="flex: 1; padding: 0.5rem;"
                  [class.btn-primary]="paymentMethod() === 'mobile_money'"
                  [class.btn-secondary]="paymentMethod() !== 'mobile_money'"
                  (click)="paymentMethod.set('mobile_money')"
                >
                  📱 Momo
                </button>
              </div>
            </div>

            <button class="btn btn-success btn-block" [disabled]="isSubmittingCheckout()" (click)="checkoutPOS()">
              <span *ngIf="!isSubmittingCheckout()">✓ Finalize POS Checkout (₵{{ cartTotal().toFixed(2) }})</span>
              <span *ngIf="isSubmittingCheckout()">Dispensing Inventory...</span>
            </button>
          </div>
        </div>

      <!-- Thermal Receipt Print View -->
      <div class="pharmacy-receipt-thermal" *ngIf="showThermalReceipt()">
        <div class="header">
          <div style="display: flex; justify-content: center; margin-bottom: 0.25rem;" *ngIf="settings()?.logo">
            <img [src]="settings().logo" alt="Clinic Logo" style="max-height: 40px; max-width: 140px; object-fit: contain; filter: grayscale(100%);" />
          </div>
          <h2>{{ settings()?.clinicName || 'ANTIGRAVITY PHARMACY' }}</h2>
          <p>{{ settings()?.tagline || 'Separate Pharmacy Inventory & diagnostics Care' }}</p>
          <p>Phone: {{ settings()?.phone || '+233 24 123 4567' }} • {{ settings()?.location || 'Accra' }}</p>
        </div>
        
        <div class="meta">
          <div>TXN ID: PH-{{ completedSaleId().slice(-6).toUpperCase() }}</div>
          <div>DATE: {{ receiptDateTime | date:'yyyy-MM-dd HH:mm' }}</div>
          <div>CUST: {{ customerName() || 'Walk-In Customer' }}</div>
          <div>PAY: {{ paymentMethod() | uppercase }}</div>
          <div *ngIf="activePrescriptionId()">SOURCE: Clinic Prescription</div>
        </div>

        <table class="item-table">
          <thead>
            <tr>
              <th>Item / Batch</th>
              <th class="num">Qty</th>
              <th class="num">Unit</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of cart()">
              <td>
                {{ item.productName }}
                <div style="font-size: 9px; color:#555;">[Batch: {{ item.batchNumber }}]</div>
              </td>
              <td class="num">{{ item.quantity }}</td>
              <td class="num">₵{{ item.sellingPrice.toFixed(2) }}</td>
              <td class="num">₵{{ (item.sellingPrice * item.quantity).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="grand">
            <span>TOTAL GHS:</span>
            <span>₵{{ cartTotal().toFixed(2) }}</span>
          </div>
          <div>
            <span>PAID:</span>
            <span>₵{{ cartTotal().toFixed(2) }}</span>
          </div>
          <div>
            <span>CHANGE DUE:</span>
            <span>₵0.00</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your patronage!</p>
          <p>Medicines sold are non-returnable.</p>
          
          <div class="no-print mt-3" style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-success btn-sm" (click)="printThermalReceipt()">
              🖨️ Print Slip
            </button>
            <button class="btn btn-secondary btn-sm" (click)="closeReceipt()">
              ❌ Close POS
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styleUrl: './pharmacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PharmacyPosSalesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly settings = signal<any>(null);

  readonly activeTab = signal<'walk_in' | 'referred' | 'end_of_day'>('walk_in');
  readonly products = signal<any[]>([]);
  readonly prescriptions = signal<any[]>([]);
  readonly cart = signal<CartItem[]>([]);
  
  readonly searchQuery = signal('');
  readonly selectingProductId = signal('');
  
  // Checkout controls
  readonly customerName = signal('');
  readonly paymentMethod = signal<'cash' | 'mobile_money'>('cash');
  readonly isSubmittingCheckout = signal(false);
  
  // Receipt controls
  readonly showThermalReceipt = signal(false);
  readonly completedSaleId = signal('');
  readonly activePrescriptionId = signal<string | null>(null);
  
  readonly receiptDateTime = new Date();

  // Daily closure signals & bindings
  readonly unclosedSalesCount = signal(0);
  readonly unclosedSalesTotal = signal(0);
  readonly unclosedCashTotal = signal(0);
  readonly unclosedMomoTotal = signal(0);
  readonly unclosedSales = signal<any[]>([]);
  readonly isSubmittingClosure = signal(false);
  readonly showThermalClosureSlip = signal(false);
  readonly completedClosure = signal<any>(null);

  readonly cashCounted = signal<number | null>(null);
  readonly momoCounted = signal<number | null>(null);
  readonly closureNotes = signal('');

  // Dual backups for rendering in final slip after resetting
  unclosedCashTotalBackup = 0;
  unclosedMomoTotalBackup = 0;

  cashCountedInput: number | null = null;
  momoCountedInput: number | null = null;
  closureNotesInput = '';

  readonly Math = Math;

  readonly cartTotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  });

  readonly countedTotal = computed(() => {
    const cash = this.cashCounted() ?? 0;
    const momo = this.momoCounted() ?? 0;
    return cash + momo;
  });

  readonly discrepancy = computed(() => {
    const expected = this.unclosedSalesTotal();
    const cash = this.cashCounted() ?? 0;
    const momo = this.momoCounted() ?? 0;
    const actual = cash + momo;
    return actual - expected;
  });

  readonly isInputEntered = computed(() => {
    return this.cashCounted() !== null || this.momoCounted() !== null;
  });

  onCashCountedChange(val: number | null): void {
    this.cashCounted.set(val);
  }

  onMomoCountedChange(val: number | null): void {
    this.momoCounted.set(val);
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    // Fetch products
    this.api.getPharmacyProducts().subscribe({
      next: (res) => {
        this.products.set(res);
      },
      error: (err) => console.error('Error fetching pharmacy products', err)
    });

    // Fetch active referred queue
    this.api.getPharmacyPrescriptions().subscribe({
      next: (res) => {
        this.prescriptions.set(res);
      },
      error: (err) => console.error('Error fetching prescriptions queue', err)
    });

    // Fetch settings
    this.api.getSettings().subscribe({
      next: (res) => {
        this.settings.set(res);
      },
      error: (err) => console.error('Error fetching settings', err)
    });
  }

  loadUnclosedSales(): void {
    this.api.getPharmacyUnclosedSales().subscribe({
      next: (res) => {
        this.unclosedSalesCount.set(res.salesCount);
        this.unclosedSalesTotal.set(res.salesTotal);
        this.unclosedCashTotal.set(res.cashTotal);
        this.unclosedMomoTotal.set(res.momoTotal);
        this.unclosedSales.set(res.sales);
      },
      error: (err) => console.error('Error fetching unclosed sales summary', err)
    });
  }

  setTab(tab: 'walk_in' | 'referred' | 'end_of_day'): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    if (tab === 'end_of_day') {
      this.loadUnclosedSales();
      this.cashCounted.set(null);
      this.momoCounted.set(null);
      this.cashCountedInput = null;
      this.momoCountedInput = null;
      this.closureNotesInput = '';
      this.closureNotes.set('');
      this.showThermalClosureSlip.set(false);
    }
  }


  readonly filteredProducts = computed(() => {
    const text = this.searchQuery().toLowerCase().trim();
    if (!text) return this.products();
    return this.products().filter(p => p.name.toLowerCase().includes(text));
  });

  getProductMinPrice(p: any): number {
    if (!p.batches || p.batches.length === 0) return 0;
    return Math.min(...p.batches.map((b: any) => b.sellingPrice));
  }

  getProductMaxPrice(p: any): number {
    if (!p.batches || p.batches.length === 0) return 0;
    return Math.max(...p.batches.map((b: any) => b.sellingPrice));
  }

  openBatchSelect(p: any): void {
    if (this.selectingProductId() === p.id) {
      this.selectingProductId.set('');
    } else {
      this.selectingProductId.set(p.id);
    }
  }

  addToCartFromSelect(p: any, batchId: string): void {
    const batch = p.batches.find((b: any) => b.id === batchId);
    if (!batch) return;

    if (batch.quantityRemaining <= 0) {
      alert('Selected batch has no stock remaining.');
      return;
    }

    // Add to cart signal
    this.cart.update(items => {
      const idx = items.findIndex(item => item.batchId === batchId);
      if (idx > -1) {
        const currentQty = items[idx].quantity;
        if (currentQty >= batch.quantityRemaining) {
          alert('Cannot exceed available batch stock level.');
          return items;
        }
        const updated = [...items];
        updated[idx] = { ...updated[idx], quantity: currentQty + 1 };
        return updated;
      }

      return [...items, {
        productId: p.id,
        productName: p.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        sellingPrice: batch.sellingPrice,
        quantity: 1,
        maxQuantity: batch.quantityRemaining
      }];
    });

    this.selectingProductId.set('');
  }

  updateQuantity(item: CartItem, delta: number): void {
    this.cart.update(items => {
      const idx = items.findIndex(x => x.batchId === item.batchId);
      if (idx === -1) return items;

      const newQty = items[idx].quantity + delta;
      if (newQty <= 0) {
        return items.filter(x => x.batchId !== item.batchId);
      }
      
      if (newQty > item.maxQuantity) {
        alert('Cannot exceed available batch stock level.');
        return items;
      }

      const updated = [...items];
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
  }

  loadPrescriptionIntoCart(script: any): void {
    // Pull available inventory batches for items suggested in text
    // (This matches standard dispenser logic mapping prescription keywords to active products)
    const scriptText = script.prescriptionText.toLowerCase();
    
    // Auto-fill patient name
    this.customerName.set(`${script.visit.patient.surname}, ${script.visit.patient.firstName}`);
    this.activePrescriptionId.set(script.id);

    // Let's sweep the medicine catalog to find product names that exist in prescription text
    let loadedAny = false;
    this.products().forEach(p => {
      if (scriptText.includes(p.name.toLowerCase().split(' ')[0])) {
        // Find best active batch (e.g. oldest batch with stock)
        const activeBatch = p.batches
          .filter((b: any) => b.quantityRemaining > 0)
          .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];

        if (activeBatch) {
          this.cart.update(items => {
            if (items.some(x => x.batchId === activeBatch.id)) return items;
            return [...items, {
              productId: p.id,
              productName: p.name,
              batchId: activeBatch.id,
              batchNumber: activeBatch.batchNumber,
              sellingPrice: activeBatch.sellingPrice,
              quantity: 1,
              maxQuantity: activeBatch.quantityRemaining
            }];
          });
          loadedAny = true;
        }
      }
    });

    if (loadedAny) {
      alert('Prescription medication recognized! Auto-loaded oldest matching active batches into checkout cart.');
      this.setTab('walk_in');
    } else {
      alert('No exact medicine matches found in active catalog. Please search and add manually to cart.');
      this.setTab('walk_in');
    }
  }

  checkoutPOS(): void {
    if (this.cart().length === 0) return;

    this.isSubmittingCheckout.set(true);

    const payload = {
      saleSource: this.activePrescriptionId() ? 'clinic_referred' : 'walk_in',
      prescriptionId: this.activePrescriptionId(),
      customerName: this.customerName().trim() || null,
      paymentMethod: this.paymentMethod(),
      items: this.cart().map(item => ({
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity
      }))
    };

    this.api.processPharmacySale(payload).subscribe({
      next: (res) => {
        this.isSubmittingCheckout.set(false);
        this.completedSaleId.set(res.id);
        
        // Open receipt preview
        this.showThermalReceipt.set(true);
      },
      error: (err) => {
        console.error('POS Checkout failed', err);
        this.isSubmittingCheckout.set(false);
        alert(err?.error?.message ?? 'Failed to complete POS transaction.');
      }
    });
  }

  printThermalReceipt(): void {
    window.print();
  }

  closeReceipt(): void {
    this.showThermalReceipt.set(false);
    this.cart.set([]);
    this.customerName.set('');
    this.activePrescriptionId.set(null);
    this.loadInitialData();
  }

  submitClosure(): void {
    if (this.unclosedSalesCount() === 0) return;

    const cash = this.cashCounted() ?? 0;
    const momo = this.momoCounted() ?? 0;
    const notes = this.closureNotes().trim();

    // Cache unclosed totals for the printed receipt before resetting unclosed states
    this.unclosedCashTotalBackup = this.unclosedCashTotal();
    this.unclosedMomoTotalBackup = this.unclosedMomoTotal();

    this.isSubmittingClosure.set(true);

    const payload = {
      cashCounted: cash,
      momoCounted: momo,
      notes: notes || null
    };

    this.api.closePharmacySales(payload).subscribe({
      next: (res) => {
        this.isSubmittingClosure.set(false);
        this.completedClosure.set(res);
        this.showThermalClosureSlip.set(true);
      },
      error: (err) => {
        console.error('Shift closure failed', err);
        this.isSubmittingClosure.set(false);
        alert(err?.error?.message ?? 'Failed to reconcile drawer and close shift.');
      }
    });
  }

  closeClosureSlip(): void {
    this.showThermalClosureSlip.set(false);
    this.completedClosure.set(null);
    this.setTab('walk_in');
  }
}

