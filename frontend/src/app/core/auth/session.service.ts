import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, map, of, tap, timeout } from 'rxjs';
import { setClientClockOffset } from '../utils/clock';

export type UserRoleCode = 0 | 1 | 2 | 3 | 4 | 5;
export type ModuleKey = 'admin' | 'frontdesk' | 'laboratory' | 'scanning' | 'pharmacy' | 'accounting';

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly username: string;
  readonly phone?: string | null;
  readonly role: UserRoleCode;
  readonly roles: UserRoleCode[];
  readonly module: ModuleKey;
  readonly tenantId?: string;
  readonly tenantSlug?: string;
  readonly tenantName?: string;
}

export interface PharmacyLocation {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly licenceNumber?: string | null;
  readonly isActive: boolean;
}

export interface ModuleOption {
  readonly key: ModuleKey;
  readonly label: string;
  readonly route: string;
}

const SESSION_STORAGE_KEY = 'pharma.session';
const TOKEN_STORAGE_KEY = 'pharma.token';
const PHARMACY_LOCATION_STORAGE_KEY = 'pharma.pharmacy.location';
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
  private readonly activePharmacyLocationIdState = signal<string | null>(this.restorePharmacyLocationId());

  constructor() {
    this.syncClock();
  }

  private syncClock(): void {
    const start = Date.now();
    this.http.get<{ timestamp: string }>(`${API_URL}/health`).subscribe({
      next: (res) => {
        const duration = Date.now() - start;
        const serverTime = new Date(res.timestamp).getTime();
        const adjustedServerTime = serverTime + Math.round(duration / 2);
        const offset = adjustedServerTime - Date.now();
        setClientClockOffset(offset);
        console.log(`[Clock] Synced frontend clock with server. Offset: ${offset} ms`);
      },
      error: (err) => console.warn('[Clock] Failed to sync clock with server', err)
    });
  }

  readonly currentUser = this.currentUserState.asReadonly();
  readonly activePharmacyLocationId = this.activePharmacyLocationIdState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => {
    const user = this.currentUser();
    return user ? (Number(user.role) === 0 || user.username === 'admin') : false;
  });
  readonly availableModules = computed(() => {
    const user = this.currentUser();
    if (!user) return [];

    // Admin always sees all modules
    if (this.isAdmin()) {
      return MODULE_OPTIONS;
    }

    // For multi-role users, show all modules matching their assigned roles
    const userRoles: number[] = Array.isArray(user.roles) ? user.roles : [user.role];
    const roleToModule: Record<number, ModuleKey> = {
      0: 'admin', 1: 'frontdesk', 2: 'laboratory', 3: 'scanning', 4: 'pharmacy', 5: 'accounting'
    };

    const assignedModuleKeys = userRoles
      .map(r => roleToModule[r])
      .filter((k): k is ModuleKey => !!k);

    return MODULE_OPTIONS.filter(m => assignedModuleKeys.includes(m.key));
  });

  getDefaultRoute(role: UserRoleCode): string {
    return ROLE_HOME[role];
  }

  login(payload: { readonly identifier: string; readonly password?: string }): Observable<SessionUser> {
    return this.http.post<{ accessToken: string; user: SessionUser }>(`${API_URL}/auth/login`, payload).pipe(
      tap((res) => {
        this.clearActivePharmacyLocation();
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
        this.clearActivePharmacyLocation();
        this.currentUserState.set(res.user);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.user));
        }
      }),
      map((res) => res.user)
    );
  }

  requestPasswordReset(payload: { readonly identifier: string }): Observable<any> {
    return this.http.post<any>(`${API_URL}/auth/forgot-password`, payload);
  }

  verifyPasswordReset(token: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/auth/reset-password?token=${encodeURIComponent(token)}`);
  }

  completePasswordReset(payload: { readonly token: string; readonly password?: string }): Observable<SessionUser> {
    return this.http.post<{ accessToken: string; user: SessionUser }>(`${API_URL}/auth/reset-password`, payload).pipe(
      tap((res) => {
        this.clearActivePharmacyLocation();
        this.currentUserState.set(res.user);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.user));
        }
      }),
      map((res) => res.user)
    );
  }

  getProfile(): Observable<SessionUser> {
    return this.http.get<SessionUser>(`${API_URL}/users/me`).pipe(
      tap((user) => this.persistSessionUser(user))
    );
  }

  updateProfile(payload: { readonly name: string; readonly email: string; readonly phone?: string | null }): Observable<SessionUser> {
    return this.http.put<SessionUser>(`${API_URL}/users/me`, payload).pipe(
      tap((user) => this.persistSessionUser(user))
    );
  }

  updatePassword(payload: { readonly currentPassword: string; readonly newPassword: string }): Observable<SessionUser> {
    return this.http.put<SessionUser>(`${API_URL}/users/me/password`, payload).pipe(
      tap((user) => this.persistSessionUser(user))
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
      timeout(4000),
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
    this.activePharmacyLocationIdState.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(PHARMACY_LOCATION_STORAGE_KEY);
    }
  }

  setActivePharmacyLocation(locationId: string): void {
    const normalizedLocationId = String(locationId ?? '').trim();
    this.activePharmacyLocationIdState.set(normalizedLocationId || null);
    if (typeof localStorage !== 'undefined') {
      if (normalizedLocationId) {
        localStorage.setItem(PHARMACY_LOCATION_STORAGE_KEY, normalizedLocationId);
      } else {
        localStorage.removeItem(PHARMACY_LOCATION_STORAGE_KEY);
      }
    }
  }

  clearActivePharmacyLocation(): void {
    this.setActivePharmacyLocation('');
  }

  updateTenantName(name: string): void {
    const user = this.currentUserState();
    if (user) {
      const updated = { ...user, tenantName: name };
      this.currentUserState.set(updated);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      }
    }
  }

  private persistSessionUser(user: SessionUser): void {
    this.currentUserState.set(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    }
  }

  canAccessModule(moduleKey: ModuleKey): boolean {
    if (this.isAdmin()) {
      return true;
    }

    const user = this.currentUser();
    if (!user) return false;

    const userRoles: number[] = Array.isArray(user.roles) ? user.roles : [user.role];
    const moduleRoleMap: Record<ModuleKey, number> = {
      admin: 0, frontdesk: 1, laboratory: 2, scanning: 3, pharmacy: 4, accounting: 5
    };
    const requiredRole = moduleRoleMap[moduleKey];

    return userRoles.includes(requiredRole);
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

  private restorePharmacyLocationId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(PHARMACY_LOCATION_STORAGE_KEY);
  }
}
