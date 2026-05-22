import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-frontdesk-page',
  standalone: true,
  templateUrl: './frontdesk-page.component.html',
  styleUrl: './frontdesk-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrontdeskPageComponent {}
