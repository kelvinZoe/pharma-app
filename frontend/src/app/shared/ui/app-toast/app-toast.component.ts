import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toastService.toasts()" class="toast-card" [ngClass]="toast.type">
        <div class="toast-icon">
          <svg *ngIf="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
          <svg *ngIf="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          <svg *ngIf="toast.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <svg *ngIf="toast.type === 'info'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button class="toast-close" (click)="toastService.remove(toast.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .toast-card {
      min-width: 300px;
      max-width: 450px;
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-left: 4px solid transparent;
    }
    .toast-card.success { border-color: #10b981; }
    .toast-card.error { border-color: #ef4444; }
    .toast-card.warning { border-color: #f59e0b; }
    .toast-card.info { border-color: #3b82f6; }
    
    .toast-card.success .toast-icon { color: #10b981; }
    .toast-card.error .toast-icon { color: #ef4444; }
    .toast-card.warning .toast-icon { color: #f59e0b; }
    .toast-card.info .toast-icon { color: #3b82f6; }

    .toast-icon svg {
      width: 24px;
      height: 24px;
    }
    .toast-message {
      flex: 1;
      font-size: 0.95rem;
      color: #334155;
      font-weight: 600;
    }
    .toast-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s, color 0.2s;
    }
    .toast-close:hover {
      color: #475569;
      background-color: #f1f5f9;
    }
    .toast-close svg {
      width: 18px;
      height: 18px;
    }
    @keyframes slideIn {
      from { transform: translateX(100%) scale(0.95); opacity: 0; }
      to { transform: translateX(0) scale(1); opacity: 1; }
    }
  `]
})
export class AppToastComponent {
  toastService = inject(ToastService);
}
// Trigger rebuild
