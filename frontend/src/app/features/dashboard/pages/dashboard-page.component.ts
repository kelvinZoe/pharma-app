import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [StatCardComponent, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  readonly stats = [
    {
      label: 'Today Visits',
      value: '0',
      hint: 'No patients checked in yet'
    },
    {
      label: 'Clinic Revenue (GHS)',
      value: '0.00',
      hint: 'Cash + Mobile Money'
    },
    {
      label: 'Pharmacy Sales (GHS)',
      value: '0.00',
      hint: 'Separate receipt stream'
    },
    {
      label: 'Pending Department Tasks',
      value: '0',
      hint: 'Laboratory + Scanning'
    }
  ];

  readonly steps = [
    {
      title: 'Frontdesk Module',
      description: 'Patient search, register, and create visit',
      route: '/frontdesk'
    },
    {
      title: 'Service Catalog',
      description: 'Service setup and quick price lookup',
      route: '/services'
    },
    {
      title: 'Department Worklist',
      description: 'Result capture and done/not-done tracking',
      route: '/worklist'
    },
    {
      title: 'Clinic Billing',
      description: 'Invoice generation and full payment flow',
      route: '/billing'
    },
    {
      title: 'Pharmacy POS',
      description: 'Inventory, batch tracking, and sales',
      route: '/pharmacy'
    }
  ];
}
