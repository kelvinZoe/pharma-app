import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { ToastContainerComponent } from './shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
