import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, DestroyRef, inject, computed, model, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dropdown-wrapper">
      
      <!-- Trigger Button -->
      <button 
        type="button" 
        class="dropdown-trigger" 
        [class.dropdown-trigger-active]="isOpen()"
        [class.dropdown-trigger-disabled]="loading() || disabled()"
        (click)="toggleOpen()" 
        [disabled]="loading() || disabled()">
        
        <span class="dropdown-trigger-label" [class.is-placeholder]="!selectedItemLabel()">
          {{ selectedItemLabel() || placeholder() }}
        </span>

        <!-- Loading spinner or chevron -->
        <span class="dropdown-trigger-icon-area">
          <svg *ngIf="loading()" class="spinner-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"></path>
          </svg>
          <svg *ngIf="!loading()" class="chevron-icon" [class.rotate-180]="isOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      <!-- Options Dropdown Panel -->
      <div class="dropdown-options-panel" [class.is-open]="isOpen()">
        
        <!-- Search Input Wrapper (Visible if items list >= 10 OR if server-side search is enabled) -->
        <div class="dropdown-search-wrapper" *ngIf="showSearchInput()">
          <svg class="search-magnifier" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            #searchInput
            type="text"
            class="dropdown-search-control"
            [placeholder]="searchPlaceholder()"
            [value]="localSearchQuery()"
            (input)="onSearchInput(searchInput.value)"
            (click)="$event.stopPropagation()"
          />
          <button 
            *ngIf="localSearchQuery()"
            type="button" 
            class="search-clear-btn" 
            (click)="clearSearch($event); searchInput.focus()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Options Roster List -->
        <div class="dropdown-options-list" (click)="$event.stopPropagation()">
          
          <!-- Shimmer Skeletal Loader (Backend Query Fetches) -->
          <ng-container *ngIf="loading()">
            <div class="shimmer-wrapper">
              <div class="shimmer-row" *ngFor="let dummy of [1, 2, 3]">
                <div class="skeleton-shimmer"></div>
              </div>
            </div>
          </ng-container>

          <!-- Standard Option Items Roster -->
          <ng-container *ngIf="!loading()">
            <button
              *ngFor="let item of filteredItems()"
              type="button"
              class="dropdown-option-item"
              [class.is-selected]="getItemValue(item) === value()"
              (click)="selectItem(item)">
              
              <span class="option-text">{{ getItemLabel(item) }}</span>
              
              <!-- Checkmark indicator -->
              <span class="option-check-icon" *ngIf="getItemValue(item) === value()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            </button>
          </ng-container>

          <!-- Empty State Screen -->
          <div class="dropdown-empty-state" *ngIf="!loading() && filteredItems().length === 0">
            <svg class="empty-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <p>No options matched your query</p>
          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 100%;
    }

    .dropdown-wrapper {
      position: relative;
      width: 100%;
      user-select: none;
    }

    /* Trigger Control */
    .dropdown-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 38px;
      padding: 0 1rem;
      background-color: var(--white);
      border: 1px solid var(--slate-200);
      border-radius: 6px;
      color: var(--slate-700);
      font-size: 0.875rem;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.1s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dropdown-trigger:hover:not(.dropdown-trigger-disabled) {
      border-color: var(--slate-300);
      background-color: var(--slate-50);
    }

    .dropdown-trigger:focus:not(.dropdown-trigger-disabled) {
      border-color: var(--teal-500);
    }

    .dropdown-trigger:active:not(.dropdown-trigger-disabled) {
      transform: scale(0.99);
    }

    .dropdown-trigger-active {
      border-color: var(--teal-500) !important;
      background-color: var(--white) !important;
    }

    .dropdown-trigger-disabled {
      cursor: not-allowed;
      opacity: 0.65;
      background-color: var(--slate-50);
    }

    .dropdown-trigger-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-trigger-label.is-placeholder {
      color: var(--slate-400);
      font-weight: 500;
    }

    .dropdown-trigger-icon-area {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 0.5rem;
      width: 18px;
      height: 18px;
      color: var(--slate-400);
    }

    .chevron-icon {
      width: 16px;
      height: 16px;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s;
    }

    .rotate-180 {
      transform: rotate(180deg);
      color: var(--teal-500);
    }

    .spinner-icon {
      width: 14px;
      height: 14px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Options Panel absolute container */
    .dropdown-options-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      background-color: var(--white);
      border: 1px solid var(--slate-200);
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      box-shadow: none; /* Borders-only design */
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dropdown-options-panel.is-open {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* Search input area */
    .dropdown-search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      padding: 0.5rem;
      border-bottom: 1px solid var(--slate-100);
    }

    .search-magnifier {
      position: absolute;
      left: 1rem;
      width: 14px;
      height: 14px;
      color: var(--slate-400);
      pointer-events: none;
    }

    .dropdown-search-control {
      width: 100%;
      height: 32px;
      padding: 0 2rem;
      border: 1px solid var(--slate-200);
      border-radius: 4px;
      font-size: 0.8rem;
      color: var(--slate-700);
      background-color: var(--slate-50);
      outline: none;
      transition: border-color 0.15s ease;
    }

    .dropdown-search-control:focus {
      border-color: var(--teal-500);
      background-color: var(--white);
    }

    .search-clear-btn {
      position: absolute;
      right: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      background: none;
      color: var(--slate-400);
      cursor: pointer;
      padding: 0;
    }

    .search-clear-btn:hover {
      color: var(--slate-600);
    }

    .search-clear-btn svg {
      width: 12px;
      height: 12px;
    }

    /* Roster Options List */
    .dropdown-options-list {
      max-height: 240px;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    /* Individual option buttons */
    .dropdown-option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0.6rem 1rem;
      border: none;
      background: none;
      color: var(--slate-600);
      font-size: 0.825rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .dropdown-option-item:hover {
      background-color: var(--slate-50);
      color: var(--slate-800);
    }

    .dropdown-option-item.is-selected {
      background-color: var(--teal-50);
      color: var(--teal-700);
      font-weight: 750;
    }

    .option-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .option-check-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 0.5rem;
      width: 14px;
      height: 14px;
      color: var(--teal-500);
    }

    .option-check-icon svg {
      width: 14px;
      height: 14px;
    }

    /* Empty State */
    .dropdown-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      color: var(--slate-400);
      text-align: center;
    }

    .empty-box-icon {
      width: 24px;
      height: 24px;
      color: var(--slate-300);
      margin-bottom: 0.5rem;
    }

    .dropdown-empty-state p {
      font-size: 0.75rem;
      margin: 0;
      font-weight: 600;
    }

    /* Shimmer loader options */
    .shimmer-wrapper {
      padding: 0.25rem 0.75rem;
    }

    .shimmer-row {
      padding: 0.5rem 0;
    }

    .skeleton-shimmer {
      width: 100%;
      height: 16px;
      background: linear-gradient(90deg, var(--slate-50) 25%, var(--slate-100) 50%, var(--slate-50) 75%);
      background-size: 200% 100%;
      border-radius: 4px;
      animation: shimmer-swipe 1.5s infinite linear;
    }

    @keyframes shimmer-swipe {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppDropdownComponent implements OnInit {
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  // Model & Core Input Signals
  readonly value = model<any>(null);
  readonly items = input<any[]>([]);
  readonly labelKey = input<string>('name');
  readonly valueKey = input<string>('id');
  readonly placeholder = input<string>('-- Select option --');
  readonly loading = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly serverSearch = input<boolean>(false);
  readonly searchPlaceholder = input<string>('Search options...');

  // Event Outputs
  readonly onSearch = output<string>();

  // State Signals
  readonly isOpen = signal(false);
  readonly localSearchQuery = signal('');

  // Server search debouncer stream
  private readonly searchSubject = new Subject<string>();

  constructor() {
    // Setup 300ms debouncing logic for server search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => {
      this.onSearch.emit(query);
    });
  }

  ngOnInit(): void {}

  // Automatically toggles the search input: displays if items >= 10 or if server search is explicitly true
  readonly showSearchInput = computed(() => {
    return this.serverSearch() || this.items().length >= 10;
  });

  // Dynamically resolves label/value mapping supporting both strings and custom object properties
  getItemLabel(item: any): string {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string') return item;
    const key = this.labelKey();
    return item[key] !== undefined ? item[key] : JSON.stringify(item);
  }

  getItemValue(item: any): any {
    if (item === null || item === undefined) return null;
    if (typeof item === 'string') return item;
    const key = this.valueKey();
    return item[key] !== undefined ? item[key] : item;
  }

  // Active item resolver computed signal
  readonly selectedItemLabel = computed(() => {
    const val = this.value();
    if (val === null || val === undefined || val === '') return '';
    const found = this.items().find(item => this.getItemValue(item) === val);
    return found ? this.getItemLabel(found) : '';
  });

  // Client-side items filtering signal reactive computed loop
  readonly filteredItems = computed(() => {
    const list = this.items();
    const query = this.localSearchQuery().toLowerCase().trim();
    if (this.serverSearch() || !query) {
      return list;
    }
    return list.filter(item => this.getItemLabel(item).toLowerCase().includes(query));
  });

  // Toggle dropdown drawer open
  toggleOpen(): void {
    if (this.loading() || this.disabled()) return;
    this.isOpen.update(open => !open);
    if (!this.isOpen()) {
      this.resetSearch();
    }
  }

  // Dismiss if click outside detected
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.isOpen()) {
        this.isOpen.set(false);
        this.resetSearch();
      }
    }
  }

  // Dismiss if Escape key pressed
  @HostListener('window:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.resetSearch();
    }
  }

  // Event trigger on typing
  onSearchInput(value: string): void {
    this.localSearchQuery.set(value);
    if (this.serverSearch()) {
      this.searchSubject.next(value);
    }
  }

  // Action select item
  selectItem(item: any): void {
    const val = this.getItemValue(item);
    this.value.set(val);
    this.isOpen.set(false);
    this.resetSearch();
  }

  // Reset search signals
  clearSearch(event: MouseEvent): void {
    event.stopPropagation();
    this.localSearchQuery.set('');
    if (this.serverSearch()) {
      this.searchSubject.next('');
    }
  }

  private resetSearch(): void {
    if (this.localSearchQuery()) {
      this.localSearchQuery.set('');
      if (this.serverSearch()) {
        this.searchSubject.next('');
      }
    }
  }
}
