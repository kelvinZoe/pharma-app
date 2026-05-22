import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-service-catalog-page',
  standalone: true,
  templateUrl: './service-catalog-page.component.html',
  styleUrl: './service-catalog-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceCatalogPageComponent {}
