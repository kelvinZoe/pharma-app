import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { SessionService, PharmacyLocation } from '../../../core/auth/session.service';
import { ApiService } from '../../../core/services/api.service';

interface PharmacyStaffOption {
  id: string;
  name: string;
  fullName?: string;
  username: string;
  role: number;
  roles?: number[];
  active: boolean;
}

interface LocationMembership {
  userId: string;
  isDefault: boolean;
  user: PharmacyStaffOption;
}

@Component({
  selector: 'app-pharmacy-locations-page',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="locations-page">
      <header class="locations-page__header">
        <div>
          <span class="eyebrow">Pharmacy network</span>
          <h1>Locations</h1>
          <p>Each shop keeps independent stock, registers, sales and reconciliation while sharing the tenant medicine catalogue.</p>
        </div>
        @if (isAdmin()) {
          <button type="button" class="primary-action" (click)="formOpen.set(!formOpen())">
            {{ formOpen() ? 'Close form' : 'Add location' }}
          </button>
        }
      </header>

      <div class="network-summary" aria-label="Pharmacy network summary">
        <div>
          <span>Active shops</span>
          <strong>{{ locations().length }}</strong>
        </div>
        <div>
          <span>Current shop</span>
          <strong>{{ activeLocationName() }}</strong>
        </div>
        <div>
          <span>Catalogue model</span>
          <strong>Shared across tenant</strong>
        </div>
      </div>

      @if (assignmentError()) {
        <p class="form-message form-message--error" role="alert">{{ assignmentError() }}</p>
      }

      @if (formOpen() && isAdmin()) {
        <form class="location-form" [formGroup]="locationForm" (ngSubmit)="createLocation()">
          <div class="location-form__heading">
            <div>
              <span class="eyebrow">New operating shop</span>
              <h2>Register pharmacy location</h2>
            </div>
            <p>Use the branch's licensed operating identity. Stock cannot move between locations without a transfer.</p>
          </div>

          <div class="location-form__grid">
            <label>
              <span>Location code</span>
              <input formControlName="code" placeholder="EAST" autocomplete="off" />
              <small>2-20 letters or numbers. Used on receipts and transfers.</small>
            </label>
            <label>
              <span>Location name</span>
              <input formControlName="name" placeholder="East Legon Pharmacy" autocomplete="organization" />
            </label>
            <label class="wide">
              <span>Address</span>
              <input formControlName="address" placeholder="Street, area and city" autocomplete="street-address" />
            </label>
            <label>
              <span>Phone</span>
              <input formControlName="phone" placeholder="+233 ..." autocomplete="tel" />
            </label>
            <label>
              <span>Licence number</span>
              <input formControlName="licenceNumber" placeholder="Pharmacy Council licence" autocomplete="off" />
            </label>
          </div>

          @if (formError()) {
            <p class="form-message form-message--error" role="alert">{{ formError() }}</p>
          }

          <div class="location-form__actions">
            <button type="button" class="secondary-action" (click)="closeForm()">Cancel</button>
            <button type="submit" class="primary-action" [disabled]="locationForm.invalid || submitting()">
              {{ submitting() ? 'Creating location...' : 'Create location' }}
            </button>
          </div>
        </form>
      }

      @if (loading()) {
        <div class="location-list" aria-label="Loading pharmacy locations">
          @for (placeholder of [1, 2, 3]; track placeholder) {
            <div class="location-card location-card--loading"></div>
          }
        </div>
      } @else if (loadError()) {
        <div class="empty-state">
          <strong>Locations could not be loaded</strong>
          <p>{{ loadError() }}</p>
          <button type="button" class="secondary-action" (click)="loadLocations()">Try again</button>
        </div>
      } @else {
        <div class="location-list">
          @for (location of locations(); track location.id) {
            <article class="location-card" [class.location-card--active]="location.id === activeLocationId()">
              <div class="location-card__identity">
                <span class="location-code">{{ location.code }}</span>
                @if (location.id === activeLocationId()) {
                  <span class="active-badge">Current shop</span>
                }
              </div>
              <div>
                <h2>{{ location.name }}</h2>
                <p>{{ location.address || 'Address not added' }}</p>
              </div>
              <dl>
                <div>
                  <dt>Phone</dt>
                  <dd>{{ location.phone || 'Not added' }}</dd>
                </div>
                <div>
                  <dt>Licence</dt>
                  <dd>{{ location.licenceNumber || 'Not added' }}</dd>
                </div>
              </dl>
              @if (isAdmin()) {
                <div class="staff-access">
                  <div class="staff-access__heading">
                    <span>Staff access</span>
                    <small>{{ locationUsers()[location.id]?.length || 0 }} assigned</small>
                  </div>
                  <div class="staff-chips">
                    @for (membership of locationUsers()[location.id] || []; track membership.userId) {
                      <span>{{ membership.user.fullName || membership.user.name }}{{ membership.isDefault ? ' · default' : '' }}</span>
                    } @empty {
                      <small>No pharmacy staff assigned yet.</small>
                    }
                  </div>
                  <div class="staff-access__assign">
                    <select
                      [value]="selectedStaff()[location.id] || ''"
                      (change)="selectStaff(location.id, $event)"
                      [attr.aria-label]="'Select staff for ' + location.name">
                      <option value="">Select pharmacy staff</option>
                      @for (staffUser of pharmacyStaff(); track staffUser.id) {
                        <option [value]="staffUser.id">{{ staffUser.name }} · {{ staffUser.username }}</option>
                      }
                    </select>
                    <button
                      type="button"
                      class="secondary-action"
                      [disabled]="!selectedStaff()[location.id] || assigningLocationId() === location.id"
                      (click)="assignStaff(location.id)">
                      {{ assigningLocationId() === location.id ? 'Assigning...' : 'Assign' }}
                    </button>
                  </div>
                </div>
              }
              @if (location.id !== activeLocationId()) {
                <button type="button" class="location-card__switch" (click)="switchLocation(location.id)">Work from this shop</button>
              }
            </article>
          } @empty {
            <div class="empty-state">
              <strong>No pharmacy location is assigned</strong>
              <p>An administrator must create or assign an operating shop before pharmacy work can begin.</p>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .locations-page { display: grid; gap: 1.4rem; max-width: 1380px; margin: 0 auto; }
    .locations-page__header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding: 0.3rem 0 1.25rem; border-bottom: 1px solid var(--app-border-color); }
    .eyebrow { display: block; margin-bottom: 0.35rem; color: var(--app-primary-color); font-size: 12px; font-weight: 850; letter-spacing: 0.12em; text-transform: uppercase; }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 0.45rem; color: var(--app-text-color); font-size: clamp(1.8rem, 3vw, 2.6rem); letter-spacing: -0.045em; }
    .locations-page__header p { max-width: 68ch; margin-bottom: 0; color: var(--app-muted-text-color); line-height: 1.6; }
    button { font: inherit; }
    .primary-action, .secondary-action { min-height: 2.65rem; padding: 0.65rem 1rem; border-radius: 0.6rem; font-size: 0.84rem; font-weight: 780; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease; }
    .primary-action { border: 1px solid var(--app-primary-color); background: var(--app-primary-color); color: white; }
    .secondary-action { border: 1px solid var(--app-border-color); background: white; color: var(--app-text-color); }
    button:active { transform: translateY(1px); }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    button:focus-visible, input:focus-visible { outline: 3px solid color-mix(in srgb, var(--app-primary-color), transparent 78%); outline-offset: 2px; }
    .network-summary { display: grid; grid-template-columns: 0.7fr 1.2fr 1fr; border-block: 1px solid var(--app-border-color); }
    .network-summary > div { display: grid; gap: 0.3rem; padding: 1rem 1.2rem; border-right: 1px solid var(--app-border-color); }
    .network-summary > div:last-child { border-right: 0; }
    .network-summary span, dt { color: var(--app-muted-text-color); font-size: 12px; font-weight: 750; letter-spacing: 0.05em; text-transform: uppercase; }
    .network-summary strong { color: var(--app-text-color); font-size: 1rem; }
    .location-form { display: grid; gap: 1.2rem; padding: 1.35rem; border: 1px solid color-mix(in srgb, var(--app-primary-color), white 72%); border-radius: 0.85rem; background: color-mix(in srgb, var(--app-primary-soft-color), white 58%); }
    .location-form__heading { display: flex; justify-content: space-between; gap: 2rem; }
    .location-form__heading h2 { margin-bottom: 0; font-size: 1.2rem; }
    .location-form__heading p { max-width: 48ch; margin-bottom: 0; color: var(--app-muted-text-color); font-size: 0.82rem; line-height: 1.5; }
    .location-form__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .location-form label { display: grid; gap: 0.4rem; }
    .location-form label.wide { grid-column: 1 / -1; }
    .location-form label > span { font-size: 0.76rem; font-weight: 780; }
    .location-form input { min-height: 2.65rem; padding: 0 0.75rem; border: 1px solid var(--app-border-color); border-radius: 0.55rem; background: white; color: var(--app-text-color); }
    .location-form small { color: var(--app-muted-text-color); font-size: 12px; }
    .location-form__actions { display: flex; justify-content: flex-end; gap: 0.7rem; }
    .form-message { margin: 0; padding: 0.7rem 0.85rem; border-radius: 0.5rem; font-size: 0.8rem; }
    .form-message--error { border: 1px solid #e4b4ae; background: #fff2f0; color: #8e3028; }
    .location-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .location-card { display: grid; gap: 1rem; min-height: 250px; padding: 1.2rem; border: 1px solid var(--app-border-color); border-radius: 0.85rem; background: var(--app-surface-color); box-shadow: 0 10px 28px -24px rgba(23, 56, 52, 0.45); }
    .location-card--active { border-color: color-mix(in srgb, var(--app-primary-color), white 52%); box-shadow: inset 4px 0 0 var(--app-primary-color); }
    .location-card--loading { min-height: 250px; background: linear-gradient(90deg, #f3f6f6 25%, #fbfcfc 50%, #f3f6f6 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
    .location-card__identity { display: flex; justify-content: space-between; align-items: center; }
    .location-code { color: var(--app-primary-color); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; font-weight: 850; letter-spacing: 0.08em; }
    .active-badge { padding: 0.28rem 0.55rem; border-radius: 999px; background: var(--app-primary-soft-color); color: var(--app-primary-color); font-size: 12px; font-weight: 800; }
    .location-card h2 { margin-bottom: 0.35rem; font-size: 1.15rem; }
    .location-card p { margin-bottom: 0; color: var(--app-muted-text-color); font-size: 0.82rem; }
    .location-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 0; padding-top: 0.9rem; border-top: 1px solid var(--app-border-color); }
    .location-card dl > div { display: grid; gap: 0.25rem; }
    .location-card dd { margin: 0; color: var(--app-text-color); font-size: 0.8rem; font-weight: 650; }
    .staff-access { display: grid; gap: 0.65rem; padding-top: 0.9rem; border-top: 1px solid var(--app-border-color); }
    .staff-access__heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .staff-access__heading > span { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .staff-access small { color: var(--app-muted-text-color); font-size: 12px; }
    .staff-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; min-height: 1.6rem; }
    .staff-chips span { padding: 0.28rem 0.5rem; border-radius: 999px; background: var(--app-primary-soft-color); color: var(--app-primary-color); font-size: 12px; font-weight: 750; }
    .staff-access__assign { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; }
    .staff-access__assign select { min-width: 0; min-height: 2.65rem; padding: 0 0.65rem; border: 1px solid var(--app-border-color); border-radius: 0.55rem; background: white; color: var(--app-text-color); }
    .location-card__switch { justify-self: start; align-self: end; padding: 0; border: 0; background: transparent; color: var(--app-primary-color); font-size: 0.78rem; font-weight: 800; cursor: pointer; }
    .empty-state { grid-column: 1 / -1; display: grid; justify-items: start; gap: 0.45rem; padding: 2rem; border: 1px dashed var(--app-border-color); border-radius: 0.85rem; background: var(--app-surface-color); }
    .empty-state p { margin-bottom: 0.7rem; color: var(--app-muted-text-color); }
    @keyframes shimmer { to { background-position: -200% 0; } }
    @media (max-width: 760px) {
      .locations-page__header, .location-form__heading { align-items: stretch; flex-direction: column; }
      .network-summary, .location-list, .location-form__grid { grid-template-columns: 1fr; }
      .network-summary > div { border-right: 0; border-bottom: 1px solid var(--app-border-color); }
      .network-summary > div:last-child { border-bottom: 0; }
      .location-form label.wide { grid-column: auto; }
    }
  `,
})
export class PharmacyLocationsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly formBuilder = inject(FormBuilder);

  readonly isAdmin = this.session.isAdmin;
  readonly activeLocationId = this.session.activePharmacyLocationId;
  readonly locations = signal<readonly PharmacyLocation[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly formOpen = signal(false);
  readonly formError = signal('');
  readonly submitting = signal(false);
  readonly pharmacyStaff = signal<readonly PharmacyStaffOption[]>([]);
  readonly locationUsers = signal<Record<string, readonly LocationMembership[]>>({});
  readonly selectedStaff = signal<Record<string, string>>({});
  readonly assigningLocationId = signal('');
  readonly assignmentError = signal('');

  readonly locationForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{2,20}$/)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: [''],
    phone: [''],
    licenceNumber: [''],
  });

  ngOnInit(): void {
    this.loadLocations();
    if (this.isAdmin()) this.loadPharmacyStaff();
  }

  activeLocationName(): string {
    return this.locations().find((location) => location.id === this.activeLocationId())?.name ?? 'Not selected';
  }

  loadLocations(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getPharmacyLocations().subscribe({
      next: (locations) => {
        this.locations.set(locations ?? []);
        this.loading.set(false);
        if (this.isAdmin()) {
          for (const location of locations ?? []) this.loadLocationUsers(location.id);
        }
      },
      error: (error) => {
        this.loadError.set(error?.error?.message ?? 'Please check your connection and try again.');
        this.loading.set(false);
      },
    });
  }

  createLocation(): void {
    if (this.locationForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.formError.set('');
    this.api.createPharmacyLocation(this.locationForm.getRawValue()).subscribe({
      next: (location) => {
        this.locations.update((items) => [...items, location].sort((left, right) => left.code.localeCompare(right.code)));
        this.loadLocationUsers(location.id);
        this.locationForm.reset({ code: '', name: '', address: '', phone: '', licenceNumber: '' });
        this.formOpen.set(false);
        this.submitting.set(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pharma:locations-changed'));
        }
      },
      error: (error) => {
        this.formError.set(error?.error?.message ?? 'The location could not be created.');
        this.submitting.set(false);
      },
    });
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
  }

  switchLocation(locationId: string): void {
    this.session.setActivePharmacyLocation(locationId);
  }

  selectStaff(locationId: string, event: Event): void {
    const userId = (event.target as HTMLSelectElement).value;
    this.selectedStaff.update((selected) => ({ ...selected, [locationId]: userId }));
  }

  assignStaff(locationId: string): void {
    const userId = this.selectedStaff()[locationId];
    if (!userId || this.assigningLocationId()) return;
    this.assigningLocationId.set(locationId);
    this.assignmentError.set('');
    this.api.assignPharmacyLocationUser(locationId, userId).subscribe({
      next: (memberships) => {
        this.locationUsers.update((current) => ({ ...current, [locationId]: memberships }));
        this.selectedStaff.update((selected) => ({ ...selected, [locationId]: '' }));
        this.assigningLocationId.set('');
      },
      error: (error) => {
        this.assignmentError.set(error?.error?.message ?? 'Staff access could not be assigned.');
        this.assigningLocationId.set('');
      },
    });
  }

  private loadPharmacyStaff(): void {
    this.api.getUsers(1, 200, '').subscribe({
      next: (response) => {
        const users: PharmacyStaffOption[] = Array.isArray(response) ? response : response?.data ?? [];
        this.pharmacyStaff.set(users.filter((staffUser) => {
          const roles = staffUser.roles?.length ? staffUser.roles : [staffUser.role];
          return staffUser.active && (roles.includes(0) || roles.includes(4));
        }));
      },
    });
  }

  private loadLocationUsers(locationId: string): void {
    this.api.getPharmacyLocationUsers(locationId).subscribe({
      next: (memberships) => {
        this.locationUsers.update((current) => ({ ...current, [locationId]: memberships }));
      },
    });
  }
}
