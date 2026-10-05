import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { APP_BRAND } from '../../../core/config/brand.config';

@Component({
  selector: 'app-brand',
  template: `
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <rect x="2" y="2" width="44" height="44" rx="14" fill="currentColor" />
        <path d="M14.5 13V24.5C14.5 31.3 18 35 24 35C30 35 33.5 31.3 33.5 24.5V13" stroke="white" stroke-width="4" stroke-linecap="round" />
        <path d="M36 9.5V16.5M32.5 13H39.5" stroke="#F2A65A" stroke-width="2.8" stroke-linecap="round" />
      </svg>
    </span>
    <span class="brand-copy">
      <strong>{{ brand.name }}</strong>
      @if (!compact()) {
        <span>{{ brand.descriptor }}</span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      color: #123a34;
    }

    :host(.is-inverse) {
      color: #ffffff;
    }

    .brand-mark {
      display: grid;
      width: 2.75rem;
      height: 2.75rem;
      flex: 0 0 auto;
      color: #0f5a4f;
    }

    .brand-mark svg {
      width: 100%;
      height: 100%;
    }

    .brand-copy {
      display: grid;
      min-width: 0;
      gap: 0.15rem;
    }

    .brand-copy strong {
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.025em;
    }

    .brand-copy span {
      overflow: hidden;
      color: #62756f;
      font-size: 12px;
      font-weight: 550;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host(.is-inverse) .brand-copy span {
      color: #b9d2ca;
    }

    :host(.size-sm) {
      gap: 0.6rem;
    }

    :host(.size-sm) .brand-mark {
      width: 2.25rem;
      height: 2.25rem;
    }

    :host(.size-sm) .brand-copy strong {
      font-size: 1.1rem;
    }

    :host(.size-lg) {
      gap: 0.9rem;
    }

    :host(.size-lg) .brand-mark {
      width: 3.25rem;
      height: 3.25rem;
    }

    :host(.size-lg) .brand-copy strong {
      font-size: 1.6rem;
    }
  `],
  host: {
    '[class.is-inverse]': 'inverse()',
    '[class.size-sm]': 'size() === "sm"',
    '[class.size-md]': 'size() === "md"',
    '[class.size-lg]': 'size() === "lg"'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {
  readonly inverse = input(false);
  readonly compact = input(false);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly brand = APP_BRAND;
}
