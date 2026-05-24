import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

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

        <form (ngSubmit)="saveSettings()" #settingsForm="ngForm" class="settings-grid" *ngIf="settings()">
          
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSettingsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

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
        this.toast.success('System settings saved successfully!');
      },
      error: (err) => {
        console.error('Failed to save settings', err);
        this.isSaving.set(false);
        this.toast.error('Failed to save clinic settings on the server.');
      }
    });
  }
}
