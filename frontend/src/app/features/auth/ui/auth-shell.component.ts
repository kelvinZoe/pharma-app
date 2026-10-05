import { ChangeDetectionStrategy, Component } from '@angular/core';

import { APP_BRAND } from '../../../core/config/brand.config';
import { BrandComponent } from '../../../shared/ui/brand/brand.component';

@Component({
  selector: 'app-auth-shell',
  imports: [BrandComponent],
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthShellComponent {
  readonly brand = APP_BRAND;
}
