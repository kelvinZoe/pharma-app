import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
        : ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4202', 'http://localhost:3000'];

      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.authService.verifyToken(token);
      const tenantId = user.tenantId;
      const roles = this.extractRoles(user);

      client.data.user = user;
      client.data.tenantId = tenantId;
      client.data.roles = roles;

      if (tenantId) {
        client.join(this.tenantRoom(tenantId));
        client.join(this.userRoom(tenantId, user.id));
        roles.forEach((role) => client.join(this.roleRoom(tenantId, role)));
      }

      client.emit('notifications:connected', { ok: true });
    } catch (error) {
      this.logger.warn(`Rejected notification socket: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      this.logger.debug(`Notification socket disconnected for user ${userId}`);
    }
  }

  @SubscribeMessage('notifications:ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    client.emit('notifications:pong', { ok: true, at: new Date().toISOString(), body });
  }

  emitNotification(notification: any): void {
    const tenantId = notification?.tenantId;
    if (!tenantId) return;

    const rooms = new Set<string>();
    if (notification.targetUserId) rooms.add(this.userRoom(tenantId, notification.targetUserId));
    if (notification.targetRole !== null && notification.targetRole !== undefined) {
      rooms.add(this.roleRoom(tenantId, Number(notification.targetRole)));
    }
    if (rooms.size === 0) rooms.add(this.tenantRoom(tenantId));

    for (const room of rooms) {
      this.server.to(room).emit('notification:new', notification);
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }

    return null;
  }

  private extractRoles(user: any): number[] {
    const rawRoles = user?.roles;
    if (Array.isArray(rawRoles)) return rawRoles.map(Number);
    if (rawRoles) return String(rawRoles).split(',').map(Number);
    return [Number(user?.role ?? 1)];
  }

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }

  private userRoom(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:user:${userId}`;
  }

  private roleRoom(tenantId: string, role: number): string {
    return `tenant:${tenantId}:role:${role}`;
  }
}
