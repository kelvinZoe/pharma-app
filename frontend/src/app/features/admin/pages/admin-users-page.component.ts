import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AppTableComponent, TableColumn } from '../../../shared/ui/app-table/app-table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { SessionService } from '../../../core/auth/session.service';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: number;
  active: boolean;
}

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AppTableComponent],
  template: `
    <div class="admin-workspace">
      
      <!-- Users List Panel -->
      <div class="panel full-width">
        <div class="panel-header">
          <h2>Staff Account Directory</h2>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm" (click)="loadUsers()">
              <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh List
            </button>
            <button class="btn btn-primary btn-sm" (click)="openNewStaffModal()">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Register New Staff
            </button>
          </div>
        </div>

        <p class="section-desc">Manage system authorization keys. Numeric role codes restrict staff visibility strictly to their own operational models.</p>

        <!-- Reusable Paginated Table -->
        <app-table
          [columns]="columns"
          [data]="users()"
          [total]="total()"
          [page]="page()"
          [limit]="limit()"
          [loading]="loading()"
          exportFileName="staff_directory"
          (pageChange)="onPageChange($event)"
          (searchChange)="onSearchChange($event)"
          (actionClick)="onActionClick($event)"
        ></app-table>
      </div>

      <!-- Add/Edit User Centered Modal Overlay -->
      <div class="modal-backdrop" *ngIf="isModalOpen()" (click)="cancelEdit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-card-header">
            <h3>
              <span *ngIf="editingUser()">Edit Access Settings</span>
              <span *ngIf="!editingUser()">Register New Staff</span>
            </h3>
            <button class="modal-close-btn" (click)="cancelEdit()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="modal-body">
            <form [formGroup]="userForm" (ngSubmit)="submitUser()" class="sidebar-form">
              <div class="form-group">
                <label for="name">Full Name <span class="text-danger">*</span></label>
                <input id="name" type="text" formControlName="name" class="form-control" placeholder="e.g. Dr. Fred Boateng" />
                <div *ngIf="userForm.get('name')?.touched && userForm.get('name')?.invalid" class="text-danger small mt-1">
                  Full name is required.
                </div>
              </div>

              <div class="form-group">
                <label for="email">Email Address <span class="text-danger">*</span></label>
                <input id="email" type="email" formControlName="email" class="form-control" placeholder="e.g. employee&#64;clinic.com" [readOnly]="editingUser() !== null" />
                <div *ngIf="userForm.get('email')?.touched && userForm.get('email')?.invalid" class="text-danger small mt-1">
                  A valid email address is required.
                </div>
              </div>

              <div class="form-group">
                <label for="username">System Username <span class="text-danger">*</span></label>
                <input id="username" type="text" formControlName="username" class="form-control" placeholder="e.g. fboateng" [readOnly]="editingUser() !== null" />
                <div *ngIf="userForm.get('username')?.touched && userForm.get('username')?.invalid" class="text-danger small mt-1">
                  Username must be at least 3 characters.
                </div>
              </div>

              <div class="form-group" *ngIf="editingUser()">
                <label for="password">Reset Password</label>
                <input id="password" type="password" formControlName="password" class="form-control" placeholder="Leave blank to keep current password" />
                <div *ngIf="userForm.get('password')?.touched && userForm.get('password')?.invalid" class="text-danger small mt-1">
                  Password must be at least 4 characters.
                </div>
              </div>

              <div class="form-group">
                <label for="role">Clinic Module Authorization <span class="text-danger">*</span></label>
                <select id="role" formControlName="role" class="form-control">
                  <option value="">-- Choose Module --</option>
                  <option value="0">Role 0 - Full Administrator</option>
                  <option value="1">Role 1 - Frontdesk & Reception</option>
                  <option value="2">Role 2 - Laboratory Department</option>
                  <option value="3">Role 3 - Radiography Scanning</option>
                  <option value="4">Role 4 - Pharmacy & POS Clerk</option>
                  <option value="5">Role 5 - Financial Accountant</option>
                </select>
              </div>

              <div class="form-group" *ngIf="editingUser()">
                <label class="d-flex align-items-center" style="cursor: pointer; gap: 0.5rem; margin-top: 1rem;">
                  <input type="checkbox" formControlName="active" style="width: 18px; height: 18px;" />
                  <strong>Account Access is Active</strong>
                </label>
              </div>

              <div class="d-flex gap-2 justify-content-end mt-4">
                <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="userForm.invalid || isSubmitting()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  <span *ngIf="!isSubmitting()">{{ editingUser() ? 'Save Access' : 'Register Staff' }}</span>
                  <span *ngIf="isSubmitting()">Processing...</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div class="modal-backdrop" *ngIf="confirmDeleteUser() as target" (click)="confirmDeleteUser.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()" style="max-width: 420px; text-align: center; padding: 2rem 1.75rem; border-radius: 1.25rem;">
          <div style="color: #ef4444; margin-bottom: 1.25rem; display: flex; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 52px; height: 52px; background: #fee2e2; border-radius: 50%; padding: 12px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--slate-800); margin: 0 0 0.5rem 0;">Remove Staff Account?</h3>
          <p style="font-size: 0.875rem; color: var(--slate-500); margin: 0 0 1.75rem 0; line-height: 1.6;">
            You are about to permanently remove <strong style="color: var(--slate-700);">{{ target.name }}</strong>'s account.
            This action cannot be undone.
          </p>
          <div class="d-flex gap-2 justify-content-center">
            <button class="btn btn-secondary" (click)="confirmDeleteUser.set(null)">Cancel</button>
            <button class="btn btn-danger" (click)="removeUser()" style="background: #ef4444; border-color: #ef4444; color: #fff;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 5px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Remove Account
            </button>
          </div>
        </div>
      </div>

      <!-- Success / Invite Link Copy Dialog Modal -->
      <div class="modal-backdrop" *ngIf="activeInviteLink() as link" (click)="activeInviteLink.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()" style="max-width: 480px; text-align: center; padding: 2.5rem 2rem; border-radius: 1.25rem;">
          <div style="color: var(--app-primary-color); margin-bottom: 1.25rem; display: flex; justify-content: center; transform: scale(1.1);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 64px; height: 64px;">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--slate-800); margin: 0 0 0.5rem 0; letter-spacing: -0.5px;">Staff Account Created!</h3>
          <p style="font-size: 0.875rem; color: var(--slate-500); margin: 0 0 1.5rem 0; line-height: 1.5;">
            An onboarding email has been queued. You can also copy the activation link below and share it directly with the staff member:
          </p>

          <div style="display: flex; gap: 0.5rem; width: 100%; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 0.5rem; padding: 0.5rem; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
            <span style="font-family: monospace; font-size: 0.775rem; color: var(--slate-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: left; padding: 0 0.25rem;">
              {{ link }}
            </span>
            <button class="btn btn-secondary btn-sm" (click)="copyInviteLink(link)" style="flex-shrink: 0; padding: 0.35rem 0.65rem;">
              Copy
            </button>
          </div>

          <button class="btn btn-primary" (click)="activeInviteLink.set(null)" style="width: 100%; font-weight: 700; padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.95rem;">
            Close & Refresh
          </button>
        </div>
      </div>

    </div>
  `,
  styleUrl: './admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  // Table source signals
  readonly users = signal<StaffUser[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly loading = signal(false);
  readonly search = signal('');

  // Form overlay signals
  readonly isModalOpen = signal(false);
  readonly editingUser = signal<StaffUser | null>(null);
  readonly isSubmitting = signal(false);
  readonly activeInviteLink = signal<string | null>(null);

  // Remove confirmation signal
  readonly confirmDeleteUser = signal<StaffUser | null>(null);

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Employee Name', type: 'employee' },
    { key: 'email', label: 'Email Address', type: 'text' },
    { key: 'username', label: 'Username', type: 'code' },
    { key: 'roleLevelText', label: 'Clinic Role Level', type: 'text' },
    { key: 'roleName', label: 'Access Boundaries', type: 'badge' },
    { key: 'active', label: 'Access status', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions', actionLabel: 'Edit Access', showDelete: true }
  ];

  readonly userForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', []],
    role: ['', [Validators.required]],
    active: [true]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers(this.page(), this.limit(), this.search()).subscribe({
      next: (res) => {
        this.loading.set(false);
        let list: StaffUser[] = [];
        
        if (Array.isArray(res)) {
          list = res;
          this.total.set(res.length);
        } else if (res && res.data) {
          list = res.data;
          this.total.set(res.total || 0);
        }

        const mapped = list.map(u => ({
          ...u,
          roleLevelText: `Role Level ${u.role}`,
          roleName: this.getRoleName(u.role)
        }));
        this.users.set(mapped);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error fetching users', err);
      }
    });
  }

  getRoleName(role: number): string {
    switch (role) {
      case 0: return 'System Administrator';
      case 1: return 'Frontdesk Check-in';
      case 2: return 'Lab Specialist';
      case 3: return 'Scanning Specialist';
      case 4: return 'Pharmacy POS';
      case 5: return 'Accountant';
      default: return 'Operational User';
    }
  }

  openNewStaffModal(): void {
    this.cancelEdit();
    this.isModalOpen.set(true);
  }

  editUser(u: StaffUser): void {
    this.editingUser.set(u);
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.setValidators([Validators.minLength(4)]);
    
    this.userForm.patchValue({
      name: u.name,
      email: u.email ?? '',
      username: u.username,
      password: '',
      role: String(u.role),
      active: u.active
    });
    this.isModalOpen.set(true);
  }

  cancelEdit(): void {
    this.editingUser.set(null);
    this.isModalOpen.set(false);
    this.userForm.reset({
      name: '',
      email: '',
      username: '',
      password: '',
      role: '',
      active: true
    });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadUsers();
  }

  onSearchChange(search: string): void {
    this.search.set(search);
    this.page.set(1);
    this.loadUsers();
  }

  onActionClick(event: { action: string, row: any }): void {
    if (event.action === 'click') {
      this.editUser(event.row);
    } else if (event.action === 'delete') {
      const currentUser = this.session.currentUser();
      if (currentUser && currentUser.id === event.row.id) {
        this.toast.error('You cannot remove your own account.');
        return;
      }
      this.confirmDeleteUser.set(event.row);
    }
  }

  removeUser(): void {
    const target = this.confirmDeleteUser();
    if (!target) return;

    this.api.deleteUser(target.id).subscribe({
      next: () => {
        this.confirmDeleteUser.set(null);
        this.loadUsers();
        this.toast.success(`${target.name}'s account has been removed.`);
      },
      error: (err) => {
        console.error('Error removing user', err);
        this.confirmDeleteUser.set(null);
        this.toast.error(err?.error?.message ?? 'Failed to remove staff account.');
      }
    });
  }

  submitUser(): void {
    if (this.userForm.invalid) return;

    this.isSubmitting.set(true);
    const formVal = this.userForm.getRawValue();

    const payload: any = {
      name: (formVal.name ?? '').trim(),
      email: (formVal.email ?? '').trim().toLowerCase(),
      role: Number(formVal.role),
      active: !!formVal.active
    };

    if (formVal.password) {
      payload.password = formVal.password;
    }

    const editTarget = this.editingUser();
    if (editTarget) {
      this.api.updateUser(editTarget.id, payload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.cancelEdit();
          this.loadUsers();
          this.toast.success('Staff account access updated successfully.');
        },
        error: (err) => {
          console.error('Error updating user', err);
          this.isSubmitting.set(false);
          this.toast.error(err?.error?.message ?? 'Failed to edit staff account.');
        }
      });
    } else {
      payload.username = (formVal.username ?? '').trim();
      this.api.createUser(payload).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.cancelEdit();
          this.loadUsers();
          if (res && res.inviteToken) {
            const inviteLink = `${window.location.origin}/auth/verify-invite?token=${res.inviteToken}`;
            this.activeInviteLink.set(inviteLink);
          } else {
            this.toast.success('Staff invitation email sent successfully.');
          }
        },
        error: (err) => {
          console.error('Error creating user', err);
          this.isSubmitting.set(false);
          this.toast.error(err?.error?.message ?? 'Failed to register new user.');
        }
      });
    }
  }

  copyInviteLink(link: string): void {
    navigator.clipboard.writeText(link).then(() => {
      this.toast.success('Activation link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link', err);
      this.toast.error('Failed to copy to clipboard.');
    });
  }
}

