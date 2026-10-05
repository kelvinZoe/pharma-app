import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { AuthShellComponent } from '../ui/auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './forgot-password.component.html',
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
      const msg = err?.error?.message ?? 'We could not request a password reset. Please try again.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
