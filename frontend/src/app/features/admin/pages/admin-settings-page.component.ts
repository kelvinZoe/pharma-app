import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { SessionService } from '../../../core/auth/session.service';

@Component({
  selector: 'app-admin-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modern-page-header">
      <div class="header-content">
        <h2>System Settings</h2>
        <p>Manage KELVIN clinic branding, printable receipt headers, and clinical outcomes contact details.</p>
      </div>
      <div class="header-decoration">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </div>
    </div>

    <div class="settings-workspace">
      <div class="panel modern-glass-panel">
        <div class="panel-header-section">
          <h3>Branding & Identity</h3>
          <p class="section-desc">These properties dynamically pre-populate A4 clinical reports and patient invoice print headers.</p>
        </div>

        <form (ngSubmit)="saveSettings()" #settingsForm="ngForm" class="settings-grid" *ngIf="settings(); else loadingState">
          
          <!-- Logo Upload Container -->
          <div class="form-group full-width logo-upload-container">
            <label>Clinic Logo / Letterhead Symbol</label>
            <div class="logo-upload-workspace">
              <div class="logo-preview-frame">
                <img *ngIf="settings().logo" [src]="settings().logo" alt="Clinic Logo Preview" />
                <div *ngIf="!settings().logo" class="logo-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>No Logo</span>
                </div>
              </div>
              
              <div class="logo-upload-actions">
                <p class="upload-hint">Upload a transparent PNG or high-contrast JPEG logo. Recommended dimensions: 300x100px. Maximum size: 1.5MB.</p>
                <div class="btn-action-row">
                  <label class="modern-btn-secondary" for="logo-file-input">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 15px; height: 15px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Choose Image
                  </label>
                  <input
                    id="logo-file-input"
                    type="file"
                    (change)="onLogoChange($event)"
                    accept="image/*"
                    style="display: none;"
                  />
                  <button
                    type="button"
                    *ngIf="settings().logo"
                    class="modern-btn-danger"
                    (click)="clearLogo()"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 15px; height: 15px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Clear Logo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group full-width">
            <label for="clinicName">Clinic / Pharmacy Name <span class="text-danger">*</span></label>
            <input
              id="clinicName"
              type="text"
              class="form-control"
              [(ngModel)]="settings().clinicName"
              name="clinicName"
              required
              placeholder="e.g. KELVIN CLINICAL DIAGNOSTICS & PHARMACY"
            />
          </div>

          <div class="form-group full-width">
            <label for="tagline">Clinical Tagline / Core Focus <span class="text-danger">*</span></label>
            <input
              id="tagline"
              type="text"
              class="form-control"
              [(ngModel)]="settings().tagline"
              name="tagline"
              required
              placeholder="e.g. Pathology, Diagnostic Imaging, & Premium Pharmaceutical Care"
            />
          </div>

          <div class="form-group">
            <label for="location">Location / Location Address <span class="text-danger">*</span></label>
            <input
              id="location"
              type="text"
              class="form-control"
              [(ngModel)]="settings().location"
              name="location"
              required
              placeholder="e.g. Accra, Ghana"
            />
          </div>

          <div class="form-group">
            <label for="phone">Billing Phone Contact <span class="text-danger">*</span></label>
            <input
              id="phone"
              type="text"
              class="form-control"
              [(ngModel)]="settings().phone"
              name="phone"
              required
              placeholder="e.g. +233 (0) 30 220 9999"
            />
          </div>

          <div class="form-group">
            <label for="email">Reconciled Cashier Email <span class="text-danger">*</span></label>
            <input
              id="email"
              type="email"
              class="form-control"
              [(ngModel)]="settings().email"
              name="email"
              required
              placeholder="e.g. billing@kelvinpharma.com"
            />
          </div>

          <div class="form-group">
            <label for="tollFree">Toll-Free Helpline / Assistance</label>
            <input
              id="tollFree"
              type="text"
              class="form-control"
              [(ngModel)]="settings().tollFree"
              name="tollFree"
              placeholder="e.g. 0800-KELVIN"
            />
          </div>

          <div class="form-group">
            <label for="labEmail">Pathology Lab Email <span class="text-danger">*</span></label>
            <input
              id="labEmail"
              type="email"
              class="form-control"
              [(ngModel)]="settings().labEmail"
              name="labEmail"
              required
              placeholder="e.g. lab@kelvinpharma.com"
            />
          </div>

          <div class="form-group">
            <label for="accreditationId">Diagnostics Accreditation ID <span class="text-danger">*</span></label>
            <input
              id="accreditationId"
              type="text"
              class="form-control"
              [(ngModel)]="settings().accreditationId"
              name="accreditationId"
              required
              placeholder="e.g. KPL-2026-991A"
            />
          </div>

          <div class="form-submit-section full-width">
            <button
              type="submit"
              class="modern-btn-primary"
              [disabled]="isSaving() || !settingsForm.valid"
            >
              <span *ngIf="!isSaving()" style="display: flex; align-items: center; gap: 0.5rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Clinic Settings
              </span>
              <span *ngIf="isSaving()">Saving settings...</span>
            </button>
          </div>

        </form>

        <ng-template #loadingState>
          <div class="settings-loading-workspace">
            <div class="skeleton-shimmer logo-upload-skeleton"></div>
            <div class="settings-skeleton-grid">
              <div class="skeleton-shimmer input-skeleton full-width"></div>
              <div class="skeleton-shimmer input-skeleton full-width"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
              <div class="skeleton-shimmer input-skeleton"></div>
            </div>
            <div class="skeleton-spinner-overlay">
              <div class="premium-spinner"></div>
              <span>Synchronizing settings...</span>
            </div>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .modern-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding: 1.25rem 2rem;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.6));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      border-radius: 1rem;
      position: relative;
      overflow: hidden;

      .header-content {
        position: relative;
        z-index: 2;

        h2 {
          margin: 0;
          font-size: 1.6rem;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: -0.5px;
        }
        
        p {
          margin: 0.35rem 0 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }
      }

      .header-decoration {
        position: absolute;
        right: -1rem;
        top: -1.5rem;
        color: #f0fdfa;
        opacity: 0.8;
        z-index: 1;

        svg {
          width: 140px;
          height: 140px;
          transform: rotate(-15deg);
        }
      }
    }

    .settings-workspace {
      max-width: 900px;
      margin: 0 auto;
    }

    .modern-glass-panel {
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 1);
      box-shadow: 0 8px 32px rgba(15, 23, 42, 0.04);
      border-radius: 1.25rem;
      padding: 2.25rem;
      
      .panel-header-section {
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 1.25rem;
        margin-bottom: 2rem;

        h3 {
          margin: 0 0 0.35rem;
          font-size: 1.3rem;
          font-weight: 800;
          color: #1e293b;
        }

        p.section-desc {
          margin: 0;
          font-size: 0.85rem;
          color: #64748b;
        }
      }
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;

      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      &.full-width {
        grid-column: 1 / -1;
      }

      label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #334155;
      }

      .form-control {
        width: 100%;
        padding: 0.65rem 0.85rem;
        font-size: 0.9rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        outline: none;
        background-color: #f8fafc;
        color: #0f172a;
        transition: all 0.2s ease;

        &:focus {
          border-color: #0d9488;
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }
      }
    }

    .form-submit-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1.5rem;
    }

    .modern-btn-primary {
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: #fff;
      border: none;
      padding: 0.85rem 1.75rem;
      border-radius: 0.75rem;
      font-weight: 800;
      font-size: 0.95rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.25);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover:not(:disabled) {
        transform: translateY(-1.5px);
        box-shadow: 0 6px 18px rgba(20, 184, 166, 0.35);
      }

      &:disabled {
        background: #e2e8f0;
        color: #94a3b8;
        box-shadow: none;
        cursor: not-allowed;
      }
    }

    .logo-upload-container {
      margin-bottom: 0.5rem;
    }

    .logo-upload-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 0.75rem;
      padding: 1.25rem;
      align-items: center;
      transition: all 0.2s ease;
      width: 100%;

      @media (min-width: 640px) {
        flex-direction: row;
        align-items: center;
      }

      &:hover {
        border-color: #0d9488;
        background: #f0fdfa;
      }
    }

    .logo-preview-frame {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 70px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);

      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        padding: 0.35rem;
      }

      .logo-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        color: #94a3b8;
        font-size: 12px;
        text-align: center;
        font-weight: 600;

        svg {
          width: 1.5rem;
          height: 1.5rem;
        }
      }
    }

    .logo-upload-actions {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex-grow: 1;
      justify-content: center;

      .upload-hint {
        margin: 0;
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.4;
      }

      .btn-action-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
    }

    .modern-btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.45rem 1rem;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.15s ease;

      &:hover {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #0f172a;
      }
    }

    .modern-btn-danger {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      padding: 0.45rem 1rem;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.15s ease;

      &:hover {
        background: #fee2e2;
        border-color: #f87171;
        color: #991b1b;
      }
    }

    /* Shimmer Skeleton & Preloader Styles */
    .settings-loading-workspace {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      width: 100%;
      opacity: 0.65;
      padding: 0.5rem 0;
    }

    .skeleton-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer-anim 1.5s infinite linear;
      border-radius: 0.75rem;
    }

    @keyframes shimmer-anim {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    .logo-upload-skeleton {
      height: 96px;
      width: 100%;
    }

    .settings-skeleton-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;

      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .input-skeleton {
      height: 44px;
      width: 100%;
      border-radius: 0.5rem;

      &.full-width {
        grid-column: 1 / -1;
      }
    }

    .skeleton-spinner-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(2px);
      border-radius: 1rem;
      color: #0d9488;
      font-weight: 700;
      font-size: 0.9rem;
    }

    .premium-spinner {
      border: 3.5px solid #e2e8f0;
      border-top: 3.5px solid #0d9488;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      animation: spin-settings-loader 0.85s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }

    @keyframes spin-settings-loader {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSettingsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly sessionService = inject(SessionService);

  readonly settings = signal<any | null>(null);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: (res) => {
        this.settings.set(res);
      },
      error: (err) => {
        console.error('Error loading settings', err);
        this.toast.error('Failed to load clinic settings from server.');
      }
    });
  }

  saveSettings(): void {
    const data = this.settings();
    if (!data) return;

    this.isSaving.set(true);
    this.api.updateSettings(data).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.settings.set(res);
        this.sessionService.updateTenantName(res.clinicName);
        this.toast.success('System settings saved successfully!');
      },
      error: (err) => {
        console.error('Failed to save settings', err);
        this.isSaving.set(false);
        this.toast.error('Failed to save clinic settings on the server.');
      }
    });
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please select a valid image file (PNG/JPEG).');
      return;
    }

    // Size limit: 1.5MB
    if (file.size > 1.5 * 1024 * 1024) {
      this.toast.error('Logo file size must be under 1.5MB to prevent database bloat.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      const current = this.settings();
      if (current) {
        this.settings.set({ ...current, logo: base64String });
      }
    };
    reader.readAsDataURL(file);
  }

  clearLogo(): void {
    const current = this.settings();
    if (current) {
      this.settings.set({ ...current, logo: null });
    }
    // Also clear the file input value so same file can be re-selected if cleared
    const fileInput = document.getElementById('logo-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}
