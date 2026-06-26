import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-page">
      <div class="login-page__panel login-page__panel--intro">
        <div class="intro-glass-card">
          <div class="intro-badge">
            <span class="pulse-dot"></span>
            Account Recovery
          </div>
          <h1>Recover access securely.</h1>
          <p class="intro-subtitle">
            Enter your staff email or username and Pharma Flow will send a protected password reset link to your registered inbox.
          </p>
        </div>
      </div>

      <div class="login-page__panel login-page__panel--form">
        <div class="login-card-container">
          <div class="login-card-header">
            <p class="login-card-eyebrow">Password Reset</p>
            <h2>Forgot Password</h2>
            <p class="login-card-instruction">We will email a reset link if the account is active and verified.</p>
          </div>

          <form class="login-form" [formGroup]="forgotForm" (ngSubmit)="submit()">
            <div class="input-block" [class.input-block--error]="forgotForm.controls.identifier.touched && forgotForm.controls.identifier.invalid">
              <span class="input-label">Email Address or Username</span>
              <div class="input-wrapper">
                <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input formControlName="identifier" type="text" placeholder="support@clinic.com or sfc-karthur" autocomplete="username" />
              </div>
              @if (forgotForm.controls.identifier.touched && forgotForm.controls.identifier.invalid) {
                <span class="error-msg">Email address or username is required.</span>
              }
            </div>

            @if (errorMessage()) {
              <div class="login-error-banner">
                <div class="banner-text">{{ errorMessage() }}</div>
              </div>
            }

            @if (successMessage()) {
              <div class="login-success-banner">
                <div class="banner-text">{{ successMessage() }}</div>
              </div>
            }

            <button class="clinician-submit-btn" type="submit" [disabled]="isSubmitting() || forgotForm.invalid">
              @if (isSubmitting()) {
                <span class="loader-dot-container">
                  <span class="loader-dot"></span>
                  <span class="loader-dot"></span>
                  <span class="loader-dot"></span>
                </span>
                <span>Sending reset link...</span>
              } @else {
                <span>Send Reset Link</span>
              }
            </button>
          </form>

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
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly session = inject(SessionService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly forgotForm = this.formBuilder.nonNullable.group({
    identifier: ['', [Validators.required]]
  });

  async submit(): Promise<void> {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const formValue = this.forgotForm.getRawValue();
      const res = await firstValueFrom(this.session.requestPasswordReset({
        identifier: formValue.identifier.trim().toLowerCase()
      }));
      this.successMessage.set(res?.message ?? 'If an account exists, a password reset email has been sent.');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const msg = err?.error?.message ?? 'Failed to request password reset.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
