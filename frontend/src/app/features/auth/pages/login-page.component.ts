import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { AuthShellComponent } from '../ui/auth-shell.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly mode = signal<'login' | 'register'>('login');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showLoginPassword = signal(false);
  readonly showRegisterPassword = signal(false);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly registerForm = this.formBuilder.nonNullable.group({
    clinicName: ['', [Validators.required, Validators.minLength(3)]],
    clinicSlug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    adminName: ['', [Validators.required, Validators.minLength(3)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPhone: ['', [Validators.required]],
    adminPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  toggleMode(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (this.mode() === 'login') {
      this.mode.set('register');
      this.registerForm.reset();
    } else {
      this.mode.set('login');
      this.loginForm.reset();
    }
  }

  onClinicNameChange(name: string): void {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    this.registerForm.patchValue({ clinicSlug: slug });
  }

  toggleLoginPassword(): void {
    this.showLoginPassword.update((visible) => !visible);
  }

  toggleRegisterPassword(): void {
    this.showRegisterPassword.update((visible) => !visible);
  }

  async submitLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const formValue = this.loginForm.getRawValue();
      const sessionUser = await firstValueFrom(
        this.session.login({
          identifier: formValue.email.trim().toLowerCase(),
          password: formValue.password
        })
      );

      await this.router.navigateByUrl(this.session.getDefaultRoute(sessionUser.role));
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err?.error?.message ?? 'We could not sign you in. Check your details and try again.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async submitRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const formValue = this.registerForm.getRawValue();
      await firstValueFrom(
        this.session.registerClinic({
          clinicName: formValue.clinicName.trim(),
          clinicSlug: formValue.clinicSlug.trim().toLowerCase(),
          adminName: formValue.adminName.trim(),
          adminEmail: formValue.adminEmail.trim().toLowerCase(),
          adminPhone: formValue.adminPhone.trim(),
          adminPassword: formValue.adminPassword
        })
      );

      this.loginForm.patchValue({ email: formValue.adminEmail });
      this.mode.set('login');
      this.successMessage.set(`${formValue.clinicName} is ready. Sign in with your administrator account.`);
    } catch (err: any) {
      console.error('Clinic registration error:', err);
      const msg = err?.error?.message ?? 'Failed to complete clinic registration.';
      this.errorMessage.set(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
