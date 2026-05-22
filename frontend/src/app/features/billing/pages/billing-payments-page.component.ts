import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-billing-payments-page',
  standalone: true,
  template: `
    <section class="placeholder">
      <h3>Payments</h3>
      <p>Capture full payments by cash or mobile money and issue final clinic receipts.</p>
    </section>
  `,
  styles: `
    .placeholder { padding: 0.25rem; }
    h3 { margin: 0; }
    p { margin: 0.45rem 0 0; color: var(--app-muted-text-color); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingPaymentsPageComponent {}
