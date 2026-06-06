import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { SettingsService, ClinicSettings } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  @Post()
  async saveSettings(@Req() req: any, @Body() body: Partial<ClinicSettings>) {
    this.ensureAdmin(req.user);
    return await this.settingsService.saveSettings(body);
  }

  private ensureAdmin(user: any) {
    if (!user || user.role !== 0) {
      throw new ForbiddenException('Only admin accounts can modify system-wide settings');
    }
  }
}
