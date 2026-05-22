import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-billing-invoices-page',
  standalone: true,
  template: `
    <section class="placeholder">
      <h3>Invoices</h3>
      <p>Generate invoices from completed visit services and review invoice line details.</p>
    </section>
  `,
  styles: `
    .placeholder { padding: 0.25rem; }
    h3 { margin: 0; }
    p { margin: 0.45rem 0 0; color: var(--app-muted-text-color); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillingInvoicesPageComponent {}
