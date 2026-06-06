import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';

export type UserRoleCode = 0 | 1 | 2 | 3 | 4 | 5;
export type ModuleKey = 'admin' | 'frontdesk' | 'laboratory' | 'scanning' | 'pharmacy' | 'accounting';

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: UserRoleCode;
  readonly module: ModuleKey;
}

export interface ModuleOption {
  readonly key: ModuleKey;
  readonly label: string;
  readonly route: string;
}

const SESSION_STORAGE_KEY = 'pharma.session';
const TOKEN_STORAGE_KEY = 'pharma.token';
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
  }
  return '/api';
};
const API_URL = getApiUrl();

export const ROLE_HOME: Record<UserRoleCode, string> = {
  0: '/admin/dashboard',
  1: '/frontdesk/dashboard',
  2: '/laboratory/dashboard',
  3: '/scanning/dashboard',
  4: '/pharmacy/dashboard',
  5: '/accounting/dashboard'
};

export const MODULE_OPTIONS: readonly ModuleOption[] = [
  { key: 'admin', label: 'Admin', route: '/admin/dashboard' },
  { key: 'frontdesk', label: 'Frontdesk', route: '/frontdesk/dashboard' },
  { key: 'laboratory', label: 'Laboratory', route: '/laboratory/dashboard' },
  { key: 'scanning', label: 'Scanning', route: '/scanning/dashboard' },
  { key: 'pharmacy', label: 'Pharmacy', route: '/pharmacy/dashboard' },
  { key: 'accounting', label: 'Accounting', route: '/accounting/dashboard' }
] as const;

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly currentUserState = signal<SessionUser | null>(this.restore());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => {
    const user = this.currentUser();
    return user ? (Number(user.role) === 0 || user.username === 'admin') : false;
  });
  readonly availableModules = computed(() => {
    if (this.isAdmin()) {
      return MODULE_OPTIONS;
    }

    const moduleKey = this.currentUser()?.module;

    return MODULE_OPTIONS.filter((moduleItem) => moduleItem.key === moduleKey);
  });

  getDefaultRoute(role: UserRoleCode): string {
    return ROLE_HOME[role];
  }

  login(payload: { readonly email: string; readonly password?: string }): Observable<SessionUser> {
    return this.http.post<{ accessToken: string; user: SessionUser }>(`${API_URL}/auth/login`, payload).pipe(
      tap((res) => {
        this.currentUserState.set(res.user);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.user));
        }
      }),
      map((res) => res.user)
    );
  }

  registerClinic(payload: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/auth/register-clinic`, payload);
  }

  verifyInvite(token: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/auth/verify-invite?token=${encodeURIComponent(token)}`);
  }

  completeInvite(payload: { readonly token: string; readonly password?: string }): Observable<any> {
    return this.http.post<{ accessToken: string; user: SessionUser }>(`${API_URL}/auth/complete-invite`, payload).pipe(
      tap((res) => {
        this.currentUserState.set(res.user);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.user));
        }
      }),
      map((res) => res.user)
    );
  }

  initSession(): Observable<boolean> {
    if (typeof localStorage === 'undefined') {
      return of(false);
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return of(false);
    }

    return this.http.get<SessionUser>(`${API_URL}/auth/profile`).pipe(
      tap((user) => {
        this.currentUserState.set(user);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      }),
      map(() => true),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  logout(): void {
    this.currentUserState.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  canAccessModule(moduleKey: ModuleKey): boolean {
    if (this.isAdmin()) {
      return true;
    }

    return this.currentUser()?.module === moduleKey;
  }

  private restore(): SessionUser | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as SessionUser;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }
}
