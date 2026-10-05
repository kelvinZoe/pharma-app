import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { AuthShellComponent } from '../ui/auth-shell.component';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './reset-password.component.html',
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
  readonly showPasswords = signal(false);

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
      this.errorMessage.set('This password reset link is incomplete. Request a new one to continue.');
      this.isVerifying.set(false);
      return;
    }

    this.token.set(token);

    try {
      const res = await firstValueFrom(this.session.verifyPasswordReset(token));
      this.inviteeName.set(res.fullName);
    } catch (err: any) {
      console.error('Verify password reset error:', err);
      const msg = err?.error?.message ?? 'This password reset link is invalid or has expired.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isVerifying.set(false);
    }
  }

  togglePasswords(): void {
    this.showPasswords.update((visible) => !visible);
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
      this.successMessage.set('Your password has been updated. Opening your workspace now.');
      await this.router.navigateByUrl(this.session.getDefaultRoute(user.role));
    } catch (err: any) {
      console.error('Complete password reset error:', err);
      const msg = err?.error?.message ?? 'We could not update your password. Please try again.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
