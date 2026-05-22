import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export interface WorkspacePageData {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly highlights: readonly string[];
}

@Component({
  selector: 'app-workspace-page',
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly page = this.route.snapshot.data['page'] as WorkspacePageData;
}
