import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @RequirePermissions(Permission.NotificationsRead)
  @Get()
  async findMine(@Req() req: any, @Query('limit') limit?: string) {
    return this.notificationsService.findMine(req.user, limit ? Number(limit) : 20);
  }

  @RequirePermissions(Permission.NotificationsRead)
  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    return this.notificationsService.unreadCount(req.user);
  }

  @RequirePermissions(Permission.NotificationsUpdate)
  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user);
  }

  @RequirePermissions(Permission.NotificationsUpdate)
  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user);
  }
}
