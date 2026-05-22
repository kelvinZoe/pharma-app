import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiButton, TuiTitle } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [TuiTitle, TuiBadge, TuiButton],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppHeaderComponent {
  readonly clinicName = input<string>('Radiography Clinic System');
  readonly activeModuleLabel = input<string>('');
  readonly userName = input<string>('');
  readonly roleLabel = input<string>('');
  readonly showModuleSwitch = input(false);
  readonly moduleToggle = output<void>();
  readonly logoutClick = output<void>();

  onModuleToggle(): void {
    this.moduleToggle.emit();
  }

  onLogout(): void {
    this.logoutClick.emit();
  }
}
