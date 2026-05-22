import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';

export interface DashboardPageData {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly stats: readonly {
    readonly label: string;
    readonly value: string;
    readonly hint: string;
  }[];
  readonly actions: readonly {
    readonly title: string;
    readonly description: string;
    readonly route: string;
  }[];
}

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
  readonly trendPositive?: boolean;
  readonly hint: string;
}

interface ActivityLog {
  readonly title: string;
  readonly time: string;
  readonly status: 'success' | 'warning' | 'info' | 'pending';
  readonly statusLabel: string;
}

interface ChartBar {
  readonly label: string;
  readonly heightPercent: number;
  readonly count: number;
}

@Component({
  selector: 'app-role-dashboard-page',
  imports: [RouterLink],
  templateUrl: './role-dashboard-page.component.html',
  styleUrl: './role-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleDashboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);

  readonly page = this.route.snapshot.data['page'];
  readonly currentUser = this.session.currentUser;

  // Personal greeting details
  readonly clinicianName = computed(() => this.currentUser()?.name ?? 'Clinician');
  readonly currentDate = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // Dynamic status card mapping derived from routes
  readonly statCards = computed<readonly StatCard[]>(() => {
    const rawStats = this.page?.stats ?? [];
    return rawStats.map((stat: any, idx: number) => {
      // Mock some realistic trend indicators for visual wow factor
      let trend = '+14.2%';
      let trendPositive = true;
      if (idx === 1) {
        trend = '+3.5%';
      } else if (idx === 2) {
        trend = 'Active';
      } else if (idx === 3) {
        trend = stat.value === '0' || stat.value === '0.00' ? 'Healthy' : 'Requires review';
        trendPositive = stat.value === '0' || stat.value === '0.00';
      }
      return {
        label: stat.label,
        value: stat.value,
        trend,
        trendPositive,
        hint: stat.hint
      };
    });
  });

  // Mocking realistic interactive charts
  readonly weeklyChart = computed<readonly ChartBar[]>(() => {
    const key = this.session.currentUser()?.module ?? 'admin';
    const datasets: Record<string, number[]> = {
      admin: [44, 55, 78, 62, 90, 32, 20],
      frontdesk: [23, 45, 67, 89, 72, 30, 15],
      laboratory: [12, 34, 45, 23, 56, 15, 8],
      scanning: [8, 15, 22, 19, 28, 10, 5],
      pharmacy: [85, 96, 120, 110, 145, 60, 40],
      accounting: [35, 42, 60, 50, 75, 25, 10]
    };

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = datasets[key] ?? datasets['admin'];
    const maxVal = Math.max(...counts);

    return days.map((day, idx) => {
      const count = counts[idx];
      return {
        label: day,
        heightPercent: maxVal > 0 ? Math.round((count / maxVal) * 100) : 0,
        count
      };
    });
  });

  // Completion Gauge values
  readonly completionPercent = computed(() => {
    const key = this.session.currentUser()?.module ?? 'admin';
    const percentages: Record<string, number> = {
      admin: 92,
      frontdesk: 85,
      laboratory: 78,
      scanning: 88,
      pharmacy: 95,
      accounting: 100
    };
    return percentages[key] ?? 85;
  });

  // Stroke Dasharray for SVG progress circle
  readonly strokeDashOffset = computed(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius; // ~339.29
    const percent = this.completionPercent();
    return circumference - (percent / 100) * circumference;
  });

  // Mocking role-specific activity feeds
  readonly activities = computed<readonly ActivityLog[]>(() => {
    const key = this.session.currentUser()?.module ?? 'admin';
    const logs: Record<string, ActivityLog[]> = {
      admin: [
        { title: 'New frontdesk staff registered (Dr. Anita Appiah)', time: '20 mins ago', status: 'success', statusLabel: 'Done' },
        { title: 'Price config modified for "Chest X-Ray A/P" (₵180.00)', time: '1 hour ago', status: 'success', statusLabel: 'Done' },
        { title: 'Daily financial export completed by Accountant', time: '3 hours ago', status: 'info', statusLabel: 'Export' },
        { title: 'System security audit log archived', time: '1 day ago', status: 'success', statusLabel: 'Secure' }
      ],
      frontdesk: [
        { title: 'Patient registered & routed (Yaw Mensah)', time: '5 mins ago', status: 'success', statusLabel: 'Registered' },
        { title: 'Invoice #10492 payment processed via Cash (₵340.00)', time: '15 mins ago', status: 'success', statusLabel: 'Paid' },
        { title: 'Check-in ticket generated (Sarah Boateng)', time: '40 mins ago', status: 'pending', statusLabel: 'In Progress' },
        { title: 'Patient file updated (Charles Bako)', time: '2 hours ago', status: 'info', statusLabel: 'Updated' }
      ],
      laboratory: [
        { title: 'Lab diagnostics completed (Yaw Mensah - FBC)', time: '8 mins ago', status: 'success', statusLabel: 'Finalized' },
        { title: 'Test template loaded successfully (Urine Culture)', time: '22 mins ago', status: 'info', statusLabel: 'Ready' },
        { title: 'WBC Reagent critical stock alert (< 10% remaining)', time: '1 hour ago', status: 'warning', statusLabel: 'Refill' },
        { title: 'Marked service "Lipids" as Not Done (No specimen)', time: '3 hours ago', status: 'warning', statusLabel: 'Cancelled' }
      ],
      scanning: [
        { title: 'Imaging report finalized (Chest X-Ray - John Osei)', time: '10 mins ago', status: 'success', statusLabel: 'Finalized' },
        { title: 'Ultrasound request queued (Rita Cobbah)', time: '30 mins ago', status: 'pending', statusLabel: 'Queued' },
        { title: 'Transferred scan records to Frontdesk checkout', time: '1 hour ago', status: 'success', statusLabel: 'Synced' },
        { title: 'Scan template default presets reset to standard', time: '1 day ago', status: 'info', statusLabel: 'Config' }
      ],
      pharmacy: [
        { title: 'POS Walk-in sale complete (Paracetamol 500mg - ₵4.50)', time: '3 mins ago', status: 'success', statusLabel: 'Sold' },
        { title: 'Referred prescription fulfilled for Yaw Mensah', time: '12 mins ago', status: 'success', statusLabel: 'Dispensed' },
        { title: 'Amoxicillin near-expiry alert (Batch AMX-09 - 23 days)', time: '1 hour ago', status: 'warning', statusLabel: 'Warning' },
        { title: 'Recorded intake of batch PAR-44 (1,000 tablets)', time: '4 hours ago', status: 'success', statusLabel: 'Intake' }
      ],
      accounting: [
        { title: 'Reconciliation verified for Frontdesk cashier', time: '1 hour ago', status: 'success', statusLabel: 'Verified' },
        { title: 'Pharmacy POS ledger stream audited (₵850.00)', time: '3 hours ago', status: 'success', statusLabel: 'Audited' },
        { title: 'Financial statement draft saved to Cloud', time: '6 hours ago', status: 'info', statusLabel: 'Draft' },
        { title: 'Monthly audit reports prepared for Admin oversight', time: '1 day ago', status: 'success', statusLabel: 'Done' }
      ]
    };
    return logs[key] ?? logs['admin'];
  });
}
