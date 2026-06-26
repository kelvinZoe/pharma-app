import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ROLE_LABELS } from '../../../core/auth/role-labels';
import { SessionService } from '../../../core/auth/session.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="profile-page">
      <header class="profile-hero">
        <div class="profile-avatar-large">{{ initials() }}</div>
        <div class="profile-heading">
          <span class="profile-eyebrow">My Profile</span>
          <h2>{{ currentUser()?.name || 'Profile settings' }}</h2>
          <p>Update your contact details and keep your account access secure.</p>
        </div>
        <div class="profile-meta-card">
          <span>Workspace</span>
          <strong>{{ currentUser()?.tenantName || 'PharmaFlow Clinic' }}</strong>
        </div>
      </header>

      <div class="profile-grid">
        <form class="profile-panel" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">Account Details</span>
              <h3>Personal information</h3>
            </div>
            <span class="status-pill">Active</span>
          </div>

          <div class="readonly-strip">
            <div>
              <span>Username</span>
              <strong>{{ currentUser()?.username || 'Not assigned' }}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{{ roleLabel() }}</strong>
            </div>
            <div>
              <span>Module</span>
              <strong>{{ currentUser()?.module || 'Workspace' }}</strong>
            </div>
          </div>

          <label class="field-block">
            <span>Full name</span>
            <input formControlName="name" type="text" autocomplete="name" />
            @if (profileForm.controls.name.touched && profileForm.controls.name.invalid) {
              <small>Full name must be at least 2 characters.</small>
            }
          </label>

          <label class="field-block">
            <span>Email address</span>
            <input formControlName="email" type="email" autocomplete="email" />
            @if (profileForm.controls.email.touched && profileForm.controls.email.invalid) {
              <small>Enter a valid email address.</small>
            }
          </label>

          <label class="field-block">
            <span>Phone number</span>
            <input formControlName="phone" type="tel" autocomplete="tel" placeholder="Optional" />
          </label>

          <button class="primary-action" type="submit" [disabled]="isSavingProfile() || profileForm.invalid">
            {{ isSavingProfile() ? 'Saving profile...' : 'Save profile changes' }}
          </button>
        </form>

        <form class="profile-panel security-panel" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">Security</span>
              <h3>Change password</h3>
            </div>
          </div>

          <p class="security-copy">
            Use this when you know your current password. If you forgot it, use the password reset email flow from the login page.
          </p>

          <label class="field-block">
            <span>Current password</span>
            <input formControlName="currentPassword" type="password" autocomplete="current-password" />
            @if (passwordForm.controls.currentPassword.touched && passwordForm.controls.currentPassword.invalid) {
              <small>Current password is required.</small>
            }
          </label>

          <label class="field-block">
            <span>New password</span>
            <input formControlName="newPassword" type="password" autocomplete="new-password" />
            @if (passwordForm.controls.newPassword.touched && passwordForm.controls.newPassword.invalid) {
              <small>New password must be at least 6 characters.</small>
            }
          </label>

          <label class="field-block">
            <span>Confirm new password</span>
            <input formControlName="confirmPassword" type="password" autocomplete="new-password" />
            @if (passwordForm.touched && passwordForm.errors?.['mismatch']) {
              <small>Passwords do not match.</small>
            }
          </label>

          <button class="secondary-action" type="submit" [disabled]="isSavingPassword() || passwordForm.invalid">
            {{ isSavingPassword() ? 'Updating password...' : 'Update password' }}
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [`
    .profile-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .profile-hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 1.25rem;
      padding: 1.4rem;
      border: 1px solid var(--app-border-color);
      border-radius: 1.25rem;
      background:
        radial-gradient(circle at top right, rgba(13, 148, 136, 0.12), transparent 34%),
        var(--app-surface-color);
      box-shadow: 0 16px 40px -30px rgba(15, 23, 42, 0.45);
    }

    .profile-avatar-large {
      width: 4.25rem;
      height: 4.25rem;
      border-radius: 1.1rem;
      display: grid;
      place-items: center;
      background: var(--app-primary-soft-color);
      color: var(--app-primary-color);
      border: 1.5px solid color-mix(in srgb, var(--app-primary-color), white 78%);
      font-weight: 900;
      font-size: 1.25rem;
    }

    .profile-heading {
      min-width: 0;
    }

    .profile-eyebrow,
    .panel-kicker,
    .profile-meta-card span,
    .readonly-strip span,
    .field-block span {
      color: var(--app-muted-text-color);
      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .profile-heading h2,
    .panel-heading h3 {
      margin: 0.15rem 0 0;
      color: var(--app-text-color);
      font-weight: 850;
      letter-spacing: -0.03em;
    }

    .profile-heading p {
      margin: 0.35rem 0 0;
      color: var(--app-muted-text-color);
      font-size: 0.9rem;
    }

    .profile-meta-card {
      min-width: 13rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--app-border-color);
      border-radius: 0.9rem;
      background: rgba(255, 255, 255, 0.72);
    }

    .profile-meta-card strong {
      display: block;
      margin-top: 0.25rem;
      color: var(--app-text-color);
      font-size: 0.92rem;
    }

    .profile-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      gap: 1.25rem;
      align-items: start;
    }

    .profile-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.25rem;
      border: 1px solid var(--app-border-color);
      border-radius: 1.1rem;
      background: var(--app-surface-color);
      box-shadow: 0 16px 40px -34px rgba(15, 23, 42, 0.45);
    }

    .panel-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .status-pill {
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      font-size: 0.72rem;
      font-weight: 850;
    }

    .readonly-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      padding: 0.85rem;
      border: 1px solid var(--app-border-color);
      border-radius: 0.85rem;
      background: var(--app-bg-color);
    }

    .readonly-strip strong {
      display: block;
      margin-top: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--app-text-color);
      font-size: 0.86rem;
    }

    .field-block {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .field-block input {
      min-height: 2.7rem;
      padding: 0.7rem 0.85rem;
      border: 1px solid var(--app-border-color);
      border-radius: 0.75rem;
      color: var(--app-text-color);
      background: #fff;
      font: inherit;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .field-block input:focus {
      border-color: var(--app-primary-color);
      box-shadow: 0 0 0 3px var(--app-primary-soft-color);
    }

    .field-block small {
      color: var(--app-danger-color);
      font-weight: 700;
      font-size: 0.75rem;
    }

    .security-copy {
      margin: 0;
      padding: 0.8rem;
      border-radius: 0.8rem;
      background: #f8fafc;
      color: var(--app-muted-text-color);
      font-size: 0.84rem;
      line-height: 1.5;
    }

    .primary-action,
    .secondary-action {
      min-height: 2.8rem;
      border: none;
      border-radius: 0.8rem;
      font-weight: 850;
      cursor: pointer;
      transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
    }

    .primary-action {
      background: var(--app-primary-color);
      color: #fff;
      box-shadow: 0 12px 24px -16px var(--app-primary-color);
    }

    .secondary-action {
      background: #0f172a;
      color: #fff;
      box-shadow: 0 12px 24px -18px #0f172a;
    }

    .primary-action:hover:not(:disabled),
    .secondary-action:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .primary-action:active:not(:disabled),
    .secondary-action:active:not(:disabled) {
      transform: scale(0.985);
    }

    .primary-action:disabled,
    .secondary-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    @media (max-width: 960px) {
      .profile-hero,
      .profile-grid,
      .readonly-strip {
        grid-template-columns: 1fr;
      }

      .profile-meta-card {
        min-width: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.session.currentUser;
  readonly isSavingProfile = signal(false);
  readonly isSavingPassword = signal(false);

  readonly initials = computed(() => {
    const name = this.currentUser()?.name ?? 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  readonly roleLabel = computed(() => {
    const user = this.currentUser();
    return user ? ROLE_LABELS[user.role] : 'Staff';
  });

  readonly profileForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['']
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: (group) => {
      const next = group.get('newPassword')?.value;
      const confirm = group.get('confirmPassword')?.value;
      return next && confirm && next !== confirm ? { mismatch: true } : null;
    }
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    try {
      const user = await firstValueFrom(this.session.getProfile());
      this.profileForm.patchValue({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? ''
      });
    } catch (err) {
      console.error('Failed to load profile', err);
      this.toast.error('Failed to load your profile.');
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    try {
      const value = this.profileForm.getRawValue();
      await firstValueFrom(this.session.updateProfile({
        name: value.name.trim(),
        email: value.email.trim().toLowerCase(),
        phone: value.phone.trim() || null
      }));
      this.toast.success('Profile updated successfully.');
    } catch (err: any) {
      console.error('Failed to update profile', err);
      this.toast.error(err?.error?.message ?? 'Failed to update profile.');
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isSavingPassword.set(true);
    try {
      const value = this.passwordForm.getRawValue();
      await firstValueFrom(this.session.updatePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword
      }));
      this.passwordForm.reset();
      this.toast.success('Password updated successfully.');
    } catch (err: any) {
      console.error('Failed to update password', err);
      this.toast.error(err?.error?.message ?? 'Failed to update password.');
    } finally {
      this.isSavingPassword.set(false);
    }
  }
}
