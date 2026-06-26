import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-page">
      <div class="login-page__panel login-page__panel--intro">
        <div class="intro-glass-card">
          <div class="intro-badge">
            <span class="pulse-dot"></span>
            Secure Reset
          </div>
          <h1>Set a fresh password.</h1>
          <p class="intro-subtitle">
            Create a new password for your Pharma Flow account. The reset link is single-use and expires automatically.
          </p>
        </div>
      </div>

      <div class="login-page__panel login-page__panel--form">
        <div class="login-card-container">
          <div class="login-card-header">
            <p class="login-card-eyebrow">Account Recovery</p>
            <h2>Reset Password</h2>
            <p class="login-card-instruction">
              @if (inviteeName()) {
                Welcome back, <strong>{{ inviteeName() }}</strong>. Enter your new password below.
              } @else {
                Validating your reset link...
              }
            </p>
          </div>

          @if (errorMessage()) {
            <div class="login-error-banner">
              <div class="banner-text">{{ errorMessage() }}</div>
            </div>
          }

          @if (!errorMessage()) {
            <form class="login-form" [formGroup]="resetForm" (ngSubmit)="submit()">
              <div class="input-block" [class.input-block--error]="resetForm.controls.password.touched && resetForm.controls.password.invalid">
                <span class="input-label">New Password</span>
                <div class="input-wrapper">
                  <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input formControlName="password" type="password" placeholder="••••••••" autocomplete="new-password" />
                </div>
                @if (resetForm.controls.password.touched && resetForm.controls.password.invalid) {
                  <span class="error-msg">Password must be at least 6 characters.</span>
                }
              </div>

              <div class="input-block" [class.input-block--error]="resetForm.controls.confirmPassword.touched && resetForm.controls.confirmPassword.invalid || (resetForm.touched && resetForm.errors?.['mismatch'])">
                <span class="input-label">Confirm Password</span>
                <div class="input-wrapper">
                  <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 12l2 2 4-4" />
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                  </svg>
                  <input formControlName="confirmPassword" type="password" placeholder="••••••••" autocomplete="new-password" />
                </div>
                @if (resetForm.controls.confirmPassword.touched && resetForm.controls.confirmPassword.invalid) {
                  <span class="error-msg">Please confirm your new password.</span>
                }
                @if (resetForm.touched && resetForm.errors?.['mismatch']) {
                  <span class="error-msg">Passwords do not match.</span>
                }
              </div>

              @if (successMessage()) {
                <div class="login-success-banner">
                  <div class="banner-text">{{ successMessage() }}</div>
                </div>
              }

              <button class="clinician-submit-btn" type="submit" [disabled]="isSubmitting() || isVerifying() || resetForm.invalid">
                @if (isSubmitting()) {
                  <span class="loader-dot-container">
                    <span class="loader-dot"></span>
                    <span class="loader-dot"></span>
                    <span class="loader-dot"></span>
                  </span>
                  <span>Updating password...</span>
                } @else {
                  <span>Reset Password</span>
                }
              </button>
            </form>
          }

          <div class="auth-toggle-link-container">
            <a class="auth-toggle-link" routerLink="/login">Back to Sign In</a>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly token = signal('');
  readonly inviteeName = signal('');
  readonly isVerifying = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly resetForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: (group) => {
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
    }
  });

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.errorMessage.set('Password reset token is missing.');
      this.isVerifying.set(false);
      return;
    }

    this.token.set(token);

    try {
      const res = await firstValueFrom(this.session.verifyPasswordReset(token));
      this.inviteeName.set(res.fullName);
    } catch (err: any) {
      console.error('Verify password reset error:', err);
      const msg = err?.error?.message ?? 'Password reset link is invalid or expired.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isVerifying.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.resetForm.invalid || !this.token()) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const formValue = this.resetForm.getRawValue();
      const user = await firstValueFrom(this.session.completePasswordReset({
        token: this.token(),
        password: formValue.password
      }));
      this.successMessage.set('Password reset successfully. Redirecting...');
      await this.router.navigateByUrl(this.session.getDefaultRoute(user.role));
    } catch (err: any) {
      console.error('Complete password reset error:', err);
      const msg = err?.error?.message ?? 'Failed to reset password.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
