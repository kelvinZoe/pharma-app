import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  module?: string;
  targetRole?: number;
  targetRoles?: number[];
  targetUserId?: string;
  entityType?: string;
  entityId?: string;
  route?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const roles = input.targetRoles?.length ? input.targetRoles : [input.targetRole];
    const targetRoles = roles.filter((role): role is number => role !== undefined && role !== null);

    if (targetRoles.length > 0) {
      const notifications = await Promise.all(
        targetRoles.map((targetRole) => this.createOne({ ...input, targetRole })),
      );
      return notifications;
    }

    return this.createOne(input);
  }

  async findMine(user: any, limit = 20) {
    const roles = this.extractRoles(user);
    return (this.prisma as any).notification.findMany({
      where: {
        OR: [
          { targetUserId: user.id },
          { targetRole: { in: roles } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 20, 1), 50),
    });
  }

  async unreadCount(user: any) {
    const roles = this.extractRoles(user);
    const count = await (this.prisma as any).notification.count({
      where: {
        isRead: false,
        OR: [
          { targetUserId: user.id },
          { targetRole: { in: roles } },
        ],
      },
    });
    return { count };
  }

  async markRead(id: string, user: any) {
    const notification = await this.findAccessibleNotification(id, user);
    return (this.prisma as any).notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
  }

  async markAllRead(user: any) {
    const roles = this.extractRoles(user);
    await (this.prisma as any).notification.updateMany({
      where: {
        isRead: false,
        OR: [
          { targetUserId: user.id },
          { targetRole: { in: roles } },
        ],
      },
      data: { isRead: true },
    });
    return { success: true };
  }

  private async createOne(input: CreateNotificationInput) {
    const notification = await (this.prisma as any).notification.create({
      data: {
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
        module: input.module ?? null,
        targetRole: input.targetRole ?? null,
        targetUserId: input.targetUserId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        route: input.route ?? null,
      },
    });

    this.notificationsGateway.emitNotification(notification);
    return notification;
  }

  private async findAccessibleNotification(id: string, user: any) {
    const roles = this.extractRoles(user);
    return (this.prisma as any).notification.findFirstOrThrow({
      where: {
        id,
        OR: [
          { targetUserId: user.id },
          { targetRole: { in: roles } },
        ],
      },
    });
  }

  private extractRoles(user: any): number[] {
    const rawRoles = user?.roles;
    if (Array.isArray(rawRoles)) return rawRoles.map(Number);
    if (rawRoles) return String(rawRoles).split(',').map(Number);
    return [Number(user?.role ?? 1)];
  }
}
