import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';

export interface ModuleMenuItem {
  readonly label: string;
  readonly path: string;
  readonly exact?: boolean;
}

export interface ModuleShellData {
  readonly title: string;
  readonly subtitle: string;
  readonly menu: readonly ModuleMenuItem[];
}

@Component({
  selector: 'app-module-shell',
  imports: [RouterOutlet],
  templateUrl: './module-shell.component.html',
  styleUrl: './module-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleShellComponent {
  private readonly route = inject(ActivatedRoute);
  readonly data = this.route.snapshot.data as ModuleShellData;
}
