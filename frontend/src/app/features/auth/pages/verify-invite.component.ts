import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  return password && confirmPassword && password.value === confirmPassword.value ? null : { mismatch: true };
};

@Component({
  selector: 'app-verify-invite',
  imports: [ReactiveFormsModule],
  templateUrl: './verify-invite.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyInviteComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly token = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly errorState = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly inviteeName = signal('');
  readonly inviteeEmail = signal('');

  readonly inviteForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  async ngOnInit(): Promise<void> {
    const params = await firstValueFrom(this.route.queryParams);
    const inviteToken = params['token'];
    
    if (!inviteToken) {
      this.errorState.set(true);
      this.errorMessage.set('Security handshake failed: Invitation token is missing.');
      this.isLoading.set(false);
      return;
    }

    this.token.set(inviteToken);

    try {
      const res = await firstValueFrom(this.session.verifyInvite(inviteToken));
      this.inviteeName.set(res.fullName);
      this.inviteeEmail.set(res.email);
    } catch (err: any) {
      console.error('Verify invite error:', err);
      this.errorState.set(true);
      const msg = err?.error?.message ?? 'Invitation token is invalid or has expired.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitInvite(): Promise<void> {
    if (this.inviteForm.invalid || !this.token()) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const formValue = this.inviteForm.getRawValue();
      const sessionUser = await firstValueFrom(
        this.session.completeInvite({
          token: this.token()!,
          password: formValue.password
        })
      );

      // Redirect to designated dashboard
      await this.router.navigateByUrl(this.session.getDefaultRoute(sessionUser.role));
    } catch (err: any) {
      console.error('Complete invite error:', err);
      const msg = err?.error?.message ?? 'Failed to activate clinician credentials.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async goToLogin(): Promise<void> {
    await this.router.navigate(['/login']);
  }
}
