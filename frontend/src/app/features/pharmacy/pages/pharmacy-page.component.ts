import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-pharmacy-page',
  standalone: true,
  templateUrl: './pharmacy-page.component.html',
  styleUrl: './pharmacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PharmacyPageComponent {}
