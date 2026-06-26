import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter, map, startWith } from 'rxjs';

import { ROLE_LABELS } from '../auth/role-labels';
import { MODULE_OPTIONS, SessionService } from '../auth/session.service';
import { ApiService } from '../services/api.service';
import { NotificationRealtimeService, RealtimeNotification } from '../services/notification-realtime.service';

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

const NOTIFICATION_SOUND_KEY = 'pharma.notifications.sound';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppToastComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly notificationRealtime = inject(NotificationRealtimeService);
  private readonly realtimeSubscription = new Subscription();
  private audioContext: AudioContext | null = null;

  readonly currentUser = this.session.currentUser;
  readonly isAdmin = this.session.isAdmin;
  readonly availableModules = this.session.availableModules;
  readonly mobileSidebarOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly notifications = signal<any[]>([]);
  readonly unreadNotifications = signal(0);
  readonly loadingNotifications = signal(false);
  readonly realtimeConnected = this.notificationRealtime.connected;
  readonly soundEnabled = signal(this.restoreSoundPreference());
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

    effect(() => {
      if (this.currentUser()) {
        this.notificationRealtime.connect();
        this.loadNotificationCount();
      } else {
        this.notificationRealtime.disconnect();
      }
    });

    this.realtimeSubscription.add(
      this.notificationRealtime.notifications$.subscribe((notification) => {
        this.receiveRealtimeNotification(notification);
      })
    );
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

  toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
    if (this.notificationsOpen()) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.loadingNotifications.set(true);
    this.api.getNotifications(20).subscribe({
      next: (items) => {
        this.notifications.set(items ?? []);
        this.unreadNotifications.set((items ?? []).filter((item) => !item.isRead).length);
        this.loadingNotifications.set(false);
      },
      error: (err) => {
        console.error('Failed to load notifications', err);
        this.loadingNotifications.set(false);
      }
    });
  }

  loadNotificationCount(): void {
    this.api.getUnreadNotificationCount().subscribe({
      next: (res) => this.unreadNotifications.set(Number(res?.count ?? 0)),
      error: (err) => console.error('Failed to load notification count', err)
    });
  }

  toggleNotificationSound(): void {
    this.soundEnabled.update((enabled) => !enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIFICATION_SOUND_KEY, this.soundEnabled() ? '1' : '0');
    }
    if (this.soundEnabled()) {
      this.playNotificationSound();
    }
  }

  async openNotification(notification: any): Promise<void> {
    if (!notification.isRead) {
      this.api.markNotificationRead(notification.id).subscribe({
        next: () => {
          this.notifications.update((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
          this.unreadNotifications.update((count) => Math.max(0, count - 1));
        },
        error: (err) => console.error('Failed to mark notification as read', err)
      });
    }

    this.notificationsOpen.set(false);
    if (notification.route) {
      await this.router.navigateByUrl(notification.route);
    }
  }

  markAllNotificationsRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update((items) => items.map((item) => ({ ...item, isRead: true })));
        this.unreadNotifications.set(0);
      },
      error: (err) => console.error('Failed to mark notifications as read', err)
    });
  }

  notificationAge(createdAt: string): string {
    const timestamp = new Date(createdAt).getTime();
    if (!Number.isFinite(timestamp)) return '';
    const diffMs = Date.now() - timestamp;
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  ngOnDestroy(): void {
    this.realtimeSubscription.unsubscribe();
    this.notificationRealtime.disconnect();
    this.audioContext?.close().catch(() => undefined);
  }

  async logout(): Promise<void> {
    this.session.logout();
    this.notificationRealtime.disconnect();
    await this.router.navigateByUrl('/login');
  }

  private receiveRealtimeNotification(notification: RealtimeNotification): void {
    if (!notification?.id) return;

    this.unreadNotifications.update((count) => count + 1);

    if (this.notificationsOpen()) {
      this.notifications.update((items) => {
        if (items.some((item) => item.id === notification.id)) return items;
        return [{ ...notification, isRead: false }, ...items].slice(0, 20);
      });
    }

    this.playNotificationSound();
  }

  private restoreSoundPreference(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(NOTIFICATION_SOUND_KEY) !== '0';
  }

  private playNotificationSound(): void {
    if (!this.soundEnabled() || typeof window === 'undefined') return;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      this.audioContext ??= new AudioContextCtor();
      const context = this.audioContext;
      if (context.state === 'suspended') {
        context.resume().catch(() => undefined);
      }

      this.playTone(context, 880, 0, 0.12);
      this.playTone(context, 1175, 0.14, 0.18);
    } catch {
      // Browsers may block audio until the user interacts with the page.
    }
  }

  private playTone(context: AudioContext, frequency: number, delay: number, duration: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + delay;
    const stopAt = startAt + duration;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt);
  }
}
