import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { ROLE_LABELS } from '../auth/role-labels';
import { MODULE_OPTIONS, SessionService } from '../auth/session.service';

interface SidebarItem {
  readonly label: string;
  readonly path: string;
  readonly exact?: boolean;
  readonly icon: string;
}

const MENUS: Record<string, readonly SidebarItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Users & Roles', path: '/admin/users', icon: 'users' },
    { label: 'Service Setup', path: '/admin/services', icon: 'services' },
    { label: 'Template Builder', path: '/admin/templates', icon: 'results' },
    { label: 'General Templates', path: '/admin/general-templates', icon: 'reports' },
    { label: 'Financial Summary', path: '/admin/financials', icon: 'financials' }
  ],
  frontdesk: [
    { label: 'Dashboard', path: '/frontdesk/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Clients', path: '/frontdesk/clients', icon: 'clients' },
    { label: 'Visits', path: '/frontdesk/visits', icon: 'visits' },
    { label: 'New Registration', path: '/frontdesk/new-registration', icon: 'registration' },
    { label: 'Billing Desk', path: '/frontdesk/billing-desk', icon: 'billing' }
  ],
  laboratory: [
    { label: 'Dashboard', path: '/laboratory/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Active Queue', path: '/laboratory/queue', icon: 'visits' },
    { label: 'Visits & History', path: '/laboratory/history', icon: 'results' }
  ],
  scanning: [
    { label: 'Dashboard', path: '/scanning/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Active Queue', path: '/scanning/queue', icon: 'visits' },
    { label: 'Visits & History', path: '/scanning/history', icon: 'reports' }
  ],
  pharmacy: [
    { label: 'Dashboard', path: '/pharmacy/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Inventory', path: '/pharmacy/inventory', icon: 'inventory' },
    { label: 'POS Sales', path: '/pharmacy/pos-sales', icon: 'pos' },
    { label: 'Clinic Prescriptions', path: '/pharmacy/clinic-prescriptions', icon: 'prescriptions' }
  ],
  accounting: [
    { label: 'Dashboard', path: '/accounting/dashboard', exact: true, icon: 'dashboard' },
    { label: 'Clinic Stream', path: '/accounting/clinic-stream', icon: 'financials' },
    { label: 'Pharmacy Stream', path: '/accounting/pharmacy-stream', icon: 'pos' },
    { label: 'Reports', path: '/accounting/reports', icon: 'reports' }
  ]
};

import { AppToastComponent } from '../../shared/ui/app-toast/app-toast.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppToastComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly currentUser = this.session.currentUser;
  readonly isAdmin = this.session.isAdmin;
  readonly availableModules = this.session.availableModules;
  readonly mobileSidebarOpen = signal(false);
  private readonly workspaceModuleKeys = new Set(MODULE_OPTIONS.map((moduleOption) => moduleOption.key));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly lastWorkspaceModuleKey = signal(this.resolveInitialWorkspaceModule());

  constructor() {
    effect(() => {
      const segment = this.currentUrl().split('/').filter(Boolean)[0];
      if (this.workspaceModuleKeys.has(segment as any)) {
        this.lastWorkspaceModuleKey.set(segment);
      }
    });
  }

  readonly activeModuleKey = computed(() => {
    const url = this.currentUrl();
    const segment = url.split('/').filter(Boolean)[0];
    if (!segment || !this.workspaceModuleKeys.has(segment as any)) {
      return this.lastWorkspaceModuleKey();
    }
    return segment || 'admin';
  });

  readonly currentModuleLabel = computed(() => {
    const key = this.activeModuleKey();
    return MODULE_OPTIONS.find((m) => m.key === key)?.label ?? 'Workspace';
  });

  readonly currentRoleLabel = computed(() => {
    const user = this.currentUser();
    return user ? ROLE_LABELS[user.role] : '';
  });

  readonly activeMenu = computed<readonly SidebarItem[]>(() => {
    const key = this.activeModuleKey();
    return MENUS[key] ?? [];
  });

  readonly activePageLabel = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/profile')) {
      return 'Profile';
    }
    const menu = this.activeMenu();
    
    // Exact match first
    const exactMatch = menu.find((item) => item.path === url);
    if (exactMatch) {
      return exactMatch.label;
    }

    // Prefix match
    const prefixMatch = menu.find((item) => url.startsWith(item.path));
    if (prefixMatch) {
      return prefixMatch.label;
    }

    return 'Overview';
  });

  readonly userInitials = computed(() => {
    const name = this.currentUser()?.name ?? 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  private resolveInitialWorkspaceModule(): string {
    const segment = this.router.url.split('/').filter(Boolean)[0];
    if (this.workspaceModuleKeys.has(segment as any)) {
      return segment;
    }
    return this.currentUser()?.module ?? 'admin';
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((state) => !state);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  async onModuleChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    const moduleOption = MODULE_OPTIONS.find((m) => m.key === key);
    if (moduleOption) {
      await this.router.navigateByUrl(moduleOption.route);
      this.closeMobileSidebar();
    }
  }

  async logout(): Promise<void> {
    this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}
