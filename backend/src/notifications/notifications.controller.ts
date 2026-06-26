import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findMine(@Req() req: any, @Query('limit') limit?: string) {
    return this.notificationsService.findMine(req.user, limit ? Number(limit) : 20);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    return this.notificationsService.unreadCount(req.user);
  }

  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user);
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user);
  }
}
