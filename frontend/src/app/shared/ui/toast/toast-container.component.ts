import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [CommonModule],
  template: `
    <div class="toast-container-fixed">
      <div 
        *ngFor="let toast of toastService.toasts()" 
        class="toast-item" 
        [ngClass]="'toast-item--' + toast.type"
        (click)="toastService.remove(toast.id)">
        
        <div class="toast-icon">
          <!-- Success Icon -->
          <svg *ngIf="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <!-- Error Icon -->
          <svg *ngIf="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <!-- Info Icon -->
          <svg *ngIf="toast.type === 'info'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>

        <div class="toast-content">
          {{ toast.message }}
        </div>

        <button class="toast-close" type="button" (click)="$event.stopPropagation(); toastService.remove(toast.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container-fixed {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: min(100% - 3rem, 24rem);
      pointer-events: none;
    }

    .toast-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 0.75rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      pointer-events: auto;
      animation: toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: all 0.2s ease;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.12);
      }
    }

    .toast-icon {
      flex-shrink: 0;
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.1rem;
      
      svg {
        width: 100%;
        height: 100%;
      }
    }

    .toast-content {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.4;
      color: #1e293b;
    }

    .toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      padding: 0;
      width: 1.25rem;
      height: 1.25rem;
      color: #94a3b8;
      cursor: pointer;
      transition: color 0.15s ease;
      
      &:hover {
        color: #64748b;
      }
      
      svg {
        width: 100%;
        height: 100%;
      }
    }

    /* Success Theme (Teal/Green clinical tone) */
    .toast-item--success {
      background: rgba(240, 253, 250, 0.95);
      border-color: rgba(13, 148, 136, 0.3);
      
      .toast-icon {
        color: #0d9488;
      }
      .toast-content {
        color: #0f766e;
      }
    }

    /* Error Theme (Soft red tone) */
    .toast-item--error {
      background: rgba(254, 242, 242, 0.95);
      border-color: rgba(239, 68, 68, 0.3);
      
      .toast-icon {
        color: #dc2626;
      }
      .toast-content {
        color: #991b1b;
      }
    }

    /* Info Theme (Soft slate tone) */
    .toast-item--info {
      background: rgba(248, 250, 252, 0.95);
      border-color: rgba(148, 163, 184, 0.3);
      
      .toast-icon {
        color: #475569;
      }
      .toast-content {
        color: #334155;
      }
    }

    @keyframes toast-slide-in {
      from {
        opacity: 0;
        transform: translateY(-1rem) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
