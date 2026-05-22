import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  name: string;
  description?: string;
  reorderLevel: number;
  qtyOnHand: number;
  batches: PharmacyBatch[];
  expanded?: boolean;
}

@Component({
  selector: 'app-pharmacy-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="pharmacy-workspace pharmacy-inventory-grid">
      <!-- Products Table Panel -->
      <div class="panel">
        <div class="panel-header">
          <h2>Medicine Stock Inventory</h2>
          <button class="btn btn-secondary btn-sm" (click)="loadProducts()">
            🔄 Refresh List
          </button>
        </div>

        <div class="search-box">
          <input
            type="text"
            placeholder="Search medicine catalog by name..."
            [(ngModel)]="searchQuery"
            class="form-control search-input"
          />
          <span class="search-icon">🔍</span>
        </div>

        <table class="premium-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Description</th>
              <th class="number-col">Min Threshold</th>
              <th class="number-col">On Hand Qty</th>
              <th class="number-col">Active Batches</th>
              <th>Oversight Status</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filteredProducts(); track p.id) {
              <!-- Product main row -->
              <tr style="cursor: pointer;" (click)="toggleExpand(p)">
                <td>
                  <strong>{{ p.name }}</strong>
                  <span class="ml-2 text-muted" style="font-size: 0.75rem;">(Click to view batches)</span>
                </td>
                <td>{{ p.description || 'N/A' }}</td>
                <td class="number-col">{{ p.reorderLevel }} units</td>
                <td class="number-col" style="font-weight: 700;">
                  {{ p.qtyOnHand }} units
                </td>
                <td class="number-col">{{ p.batches.length }} batch(es)</td>
                <td>
                  <span class="stock-pill" [class]="getStockLevelClass(p)">
                    {{ getStockLevelLabel(p) }}
                  </span>
                </td>
              </tr>
              
              <!-- Expanded batches row -->
              <tr *ngIf="p.expanded" class="batches-expanded-row">
                <td colspan="6">
                  <div class="expanded-batches-container">
                    <h5 style="margin: 0 0 0.75rem; font-size: 0.85rem; font-weight: 700; color: var(--app-text-color);">
                      Active Inventory Batches for {{ p.name }}
                    </h5>
                    
                    <div class="batches-grid" *ngIf="p.batches && p.batches.length > 0; else noBatches">
                      <div *ngFor="let b of p.batches" class="batch-mini-card">
                        <div class="batch-num">Batch: {{ b.batchNumber }}</div>
                        <div class="batch-qty">Qty: <strong>{{ b.quantityRemaining }}</strong> / {{ b.quantityReceived }} left</div>
                        <div class="batch-qty">Cost: ₵{{ b.purchasePrice.toFixed(2) }} | POS: ₵{{ b.sellingPrice.toFixed(2) }}</div>
                        <span class="batch-expiry" [class]="getExpiryClass(b.expiryDate)">
                          Exp: {{ b.expiryDate | date:'mediumDate' }} • {{ getExpiryLabel(b.expiryDate) }}
                        </span>
                      </div>
                    </div>
                    
                    <ng-template #noBatches>
                      <p class="text-muted small">No stock batches registered for this product. Use the form on the right to add intake batches.</p>
                    </ng-template>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center py-4">No products found matching the search.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Add Product & Add Batch Sidebar Panels -->
      <div class="sidebar-container" style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Intake Batch Form -->
        <div class="panel">
          <div class="panel-header">
            <h3>➕ Record Stock Intake Batch</h3>
          </div>
          
          <form [formGroup]="batchForm" (ngSubmit)="submitBatch()" class="sidebar-form">
            <div class="form-group">
              <label for="batchProduct">Select Medicine <span class="text-danger">*</span></label>
              <select id="batchProduct" formControlName="productId" class="form-control">
                <option value="">-- Choose Medicine --</option>
                <option *ngFor="let p of products()" [value]="p.id">{{ p.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="batchNumber">Batch Number <span class="text-danger">*</span></label>
              <input id="batchNumber" type="text" formControlName="batchNumber" class="form-control" placeholder="e.g. B-10029" />
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label for="qtyReceived">Qty Received <span class="text-danger">*</span></label>
                <input id="qtyReceived" type="number" formControlName="quantityReceived" class="form-control" placeholder="100" min="1" />
              </div>
              <div class="form-group">
                <label for="expiryDate">Expiry Date <span class="text-danger">*</span></label>
                <input id="expiryDate" type="date" formControlName="expiryDate" class="form-control" />
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label for="purchasePrice">Unit Purchase ₵ <span class="text-danger">*</span></label>
                <input id="purchasePrice" type="number" step="0.01" formControlName="purchasePrice" class="form-control" placeholder="4.50" min="0" />
              </div>
              <div class="form-group">
                <label for="sellingPrice">Unit Selling ₵ <span class="text-danger">*</span></label>
                <input id="sellingPrice" type="number" step="0.01" formControlName="sellingPrice" class="form-control" placeholder="8.00" min="0" />
              </div>
            </div>

            <button class="btn btn-success btn-block" [disabled]="batchForm.invalid || isSubmittingBatch()">
              Record Batch Intake
            </button>
          </form>
        </div>

        <!-- Add Product Form -->
        <div class="panel">
          <div class="panel-header">
            <h3>📦 Register New Medicine</h3>
          </div>
          
          <form [formGroup]="productForm" (ngSubmit)="submitProduct()" class="sidebar-form">
            <div class="form-group">
              <label for="prodName">Medicine Name <span class="text-danger">*</span></label>
              <input id="prodName" type="text" formControlName="name" class="form-control" placeholder="e.g. Amoxicillin 250mg Capsules" />
            </div>

            <div class="form-group">
              <label for="prodDesc">Description (Optional)</label>
              <input id="prodDesc" type="text" formControlName="description" class="form-control" placeholder="e.g. Antibiotic, pack of 100" />
            </div>

            <div class="form-group">
              <label for="prodReorder">Reorder Threshold Level <span class="text-danger">*</span></label>
              <input id="prodReorder" type="number" formControlName="reorderLevel" class="form-control" placeholder="25" min="0" />
            </div>

            <button class="btn btn-primary btn-block" [disabled]="productForm.invalid || isSubmittingProduct()">
              Register Medicine Catalog
            </button>
          </form>
        </div>

      </div>
    </div>
  `,
  styleUrl: './pharmacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PharmacyInventoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly products = signal<PharmacyProduct[]>([]);
  readonly searchQuery = signal('');
  
  readonly isSubmittingProduct = signal(false);
  readonly isSubmittingBatch = signal(false);

  readonly productForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    reorderLevel: [20, [Validators.required, Validators.min(0)]]
  });

  readonly batchForm = this.fb.group({
    productId: ['', [Validators.required]],
    batchNumber: ['', [Validators.required]],
    expiryDate: ['', [Validators.required]],
    purchasePrice: [null as number | null, [Validators.required, Validators.min(0)]],
    sellingPrice: [null as number | null, [Validators.required, Validators.min(0)]],
    quantityReceived: [null as number | null, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.api.getPharmacyProducts().subscribe({
      next: (res) => {
        // Retain expand statuses on reload if matching product
        const oldState = this.products();
        const mapped = res.map((p: any) => {
          const old = oldState.find(x => x.id === p.id);
          return {
            ...p,
            expanded: old ? old.expanded : false
          };
        });
        this.products.set(mapped);
      },
      error: (err) => console.error('Error fetching pharmacy products', err)
    });
  }

  toggleExpand(p: PharmacyProduct): void {
    this.products.update(list =>
      list.map(item => (item.id === p.id ? { ...item, expanded: !item.expanded } : item))
    );
  }

  readonly filteredProducts = computed(() => {
    const text = this.searchQuery().toLowerCase().trim();
    if (!text) return this.products();
    return this.products().filter(p => p.name.toLowerCase().includes(text));
  });

  getStockLevelClass(p: PharmacyProduct): string {
    if (p.qtyOnHand === 0) return 'stock-alert-warning';
    return p.qtyOnHand <= p.reorderLevel ? 'stock-alert-warning' : 'stock-alert-ok';
  }

  getStockLevelLabel(p: PharmacyProduct): string {
    if (p.qtyOnHand === 0) return 'OUT OF STOCK';
    return p.qtyOnHand <= p.reorderLevel ? 'LOW STOCK' : 'STOCKED';
  }

  getExpiryClass(dateStr: string): string {
    const exp = new Date(dateStr);
    const now = new Date();
    const diffMonths = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
    
    if (diffMonths < 3) return 'expiry-critical';
    if (diffMonths <= 6) return 'expiry-warning';
    return 'expiry-normal';
  }

  getExpiryLabel(dateStr: string): string {
    const exp = new Date(dateStr);
    const now = new Date();
    const diffMonths = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
    
    if (diffMonths < 0) return 'EXPIRED';
    if (diffMonths < 3) return 'CRITICAL';
    if (diffMonths <= 6) return 'WARNING';
    return 'SAFE';
  }

  submitProduct(): void {
    if (this.productForm.invalid) return;

    this.isSubmittingProduct.set(true);
    const data = this.productForm.getRawValue();

    this.api.createPharmacyProduct({
      name: (data.name ?? '').trim(),
      description: (data.description ?? '').trim() || null,
      reorderLevel: Number(data.reorderLevel)
    }).subscribe({
      next: (res) => {
        this.isSubmittingProduct.set(false);
        this.productForm.reset({ name: '', description: '', reorderLevel: 20 });
        this.loadProducts();
        alert('Product registered successfully in catalog.');
      },
      error: (err) => {
        console.error('Error creating product', err);
        this.isSubmittingProduct.set(false);
        alert(err?.error?.message ?? 'Failed to create product.');
      }
    });
  }

  submitBatch(): void {
    if (this.batchForm.invalid) return;

    this.isSubmittingBatch.set(true);
    const data = this.batchForm.getRawValue();
    const productId = data.productId;
    if (!productId) {
      this.isSubmittingBatch.set(false);
      return;
    }

    const payload = {
      batchNumber: (data.batchNumber ?? '').trim(),
      expiryDate: new Date(data.expiryDate || '').toISOString(),
      purchasePrice: Number(data.purchasePrice),
      sellingPrice: Number(data.sellingPrice),
      quantityReceived: Number(data.quantityReceived)
    };

    this.api.addPharmacyBatch(productId, payload).subscribe({
      next: (res) => {
        this.isSubmittingBatch.set(false);
        this.batchForm.reset({ productId: '', batchNumber: '', expiryDate: '', purchasePrice: null, sellingPrice: null, quantityReceived: null });
        this.loadProducts();
        alert('Inventory intake batch registered and stocked successfully.');
      },
      error: (err) => {
        console.error('Error creating batch', err);
        this.isSubmittingBatch.set(false);
        alert(err?.error?.message ?? 'Failed to record batch intake.');
      }
    });
  }
}
