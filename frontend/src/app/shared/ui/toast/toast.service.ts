import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string, duration = 4000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): void {
    this.show(message, 'error', duration);
  }

  info(message: string, duration = 4000): void {
    this.show(message, 'info', duration);
  }

  private show(message: string, type: 'success' | 'error' | 'info', duration: number): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  remove(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
