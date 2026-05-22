import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-department-worklist-page',
  standalone: true,
  templateUrl: './department-worklist-page.component.html',
  styleUrl: './department-worklist-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentWorklistPageComponent {}
