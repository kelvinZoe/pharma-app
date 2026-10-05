import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions(Permission.StaffRead)
  @Get()
  async getAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;
    return this.usersService.findAll(pageNum, limitNum, search);
  }

  @RequirePermissions(Permission.StaffManage)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.usersService.create(body, req.user.id);
  }

  @RequirePermissions(Permission.ProfileRead)
  @Get('me')
  async getProfile(@Req() req: any) {
    return this.usersService.findProfile(req.user.id);
  }

  @RequirePermissions(Permission.ProfileUpdate)
  @Put('me')
  async updateProfile(@Req() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @RequirePermissions(Permission.PasswordChange)
  @Put('me/password')
  async updatePassword(@Req() req: any, @Body() body: any) {
    return this.usersService.updateOwnPassword(req.user.id, body);
  }

  @RequirePermissions(Permission.StaffManage)
  @Post(':id/resend-invitation')
  async resendInvitation(@Req() req: any, @Param('id') id: string) {
    return this.usersService.resendInvitation(id, req.user.id);
  }

  @RequirePermissions(Permission.StaffManage)
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body, req.user.id);
  }

  @RequirePermissions(Permission.StaffManage)
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    if (req.user.id === id || req.user.userId === id || req.user.sub === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    return this.usersService.remove(id, req.user.id);
  }
}
