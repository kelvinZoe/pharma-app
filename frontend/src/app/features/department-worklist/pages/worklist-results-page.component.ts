import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-worklist-results-page',
  standalone: true,
  template: `
    <section class="placeholder">
      <h3>Results</h3>
      <p>Capture template-based results and mark service lines as done or not done with reasons.</p>
    </section>
  `,
  styles: `
    .placeholder { padding: 0.25rem; }
    h3 { margin: 0; }
    p { margin: 0.45rem 0 0; color: var(--app-muted-text-color); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorklistResultsPageComponent {}
