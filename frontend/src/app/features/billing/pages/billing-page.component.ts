import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-billing-page',
  standalone: true,
  templateUrl: './billing-page.component.html',
  styleUrl: './billing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingPageComponent {}
