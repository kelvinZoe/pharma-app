import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-service-price-lookup-page',
  standalone: true,
  template: `
    <section class="placeholder">
      <h3>Price Lookup</h3>
      <p>Quickly search service prices for frontdesk and department enquiries.</p>
    </section>
  `,
  styles: `
    .placeholder { padding: 0.25rem; }
    h3 { margin: 0; }
    p { margin: 0.45rem 0 0; color: var(--app-muted-text-color); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServicePriceLookupPageComponent {}
