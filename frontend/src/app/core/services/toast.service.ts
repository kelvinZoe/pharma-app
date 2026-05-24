import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private nextId = 0;

  show(type: ToastType, message: string, duration: number = 4000) {
    const id = ++this.nextId;
    this.toasts.update(t => [...t, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }
  
  success(message: string, duration?: number) { this.show('success', message, duration); }
  error(message: string, duration?: number) { this.show('error', message, duration); }
  warning(message: string, duration?: number) { this.show('warning', message, duration); }
  info(message: string, duration?: number) { this.show('info', message, duration); }

  remove(id: number) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
