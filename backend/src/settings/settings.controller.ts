import { Controller, Get, Post, Body, UseGuards, Req, } from '@nestjs/common';
import { SettingsService, ClinicSettings } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequirePermissions(Permission.SettingsRead)
  @Get()
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  @RequirePermissions(Permission.SettingsManage)
  @Post()
  async saveSettings(@Req() req: any, @Body() body: Partial<ClinicSettings>) {
    return await this.settingsService.saveSettings(body);
  }
}
