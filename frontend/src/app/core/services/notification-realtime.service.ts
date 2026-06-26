import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface RealtimeNotification {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly type?: 'info' | 'success' | 'warning' | 'danger';
  readonly module?: string | null;
  readonly targetRole?: number | null;
  readonly targetUserId?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly route?: string | null;
  readonly isRead?: boolean;
  readonly createdAt: string;
}

const TOKEN_STORAGE_KEY = 'pharma.token';

const getRealtimeUrl = () => {
  if (typeof window === 'undefined') return '';

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3000/notifications';
  }

  return 'https://pharma-app-oenk.onrender.com/notifications';
};

@Injectable({
  providedIn: 'root'
})
export class NotificationRealtimeService {
  private socket: Socket | null = null;
  private activeToken: string | null = null;
  private readonly notificationSubject = new Subject<RealtimeNotification>();

  readonly connected = signal(false);
  readonly notifications$ = this.notificationSubject.asObservable();

  connect(): void {
    if (typeof localStorage === 'undefined') return;

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.socket?.connected && this.activeToken === token) return;

    this.disconnect();
    this.activeToken = token;
    this.socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000
    });

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('connect_error', (error) => {
      this.connected.set(false);
      console.warn('Notification socket connection failed', error.message);
    });
    this.socket.on('notification:new', (notification: RealtimeNotification) => {
      this.notificationSubject.next(notification);
    });
  }

  disconnect(): void {
    this.connected.set(false);
    this.activeToken = null;
    this.socket?.disconnect();
    this.socket = null;
  }
}
