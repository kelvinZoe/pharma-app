import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    this.ensureAdmin(req.user);
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;
    return this.usersService.findAll(pageNum, limitNum, search);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.usersService.create(body);
  }

  @Post(':id/resend-invitation')
  async resendInvitation(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req.user);
    return this.usersService.resendInvitation(id);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req.user);
    // Prevent admins from deleting their own account
    if (req.user.userId === id || req.user.sub === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    return this.usersService.remove(id);
  }

  private ensureAdmin(user: any) {
    // Admin (role 0) can manage users
    if (!user || user.role !== 0) {
      throw new ForbiddenException('Only admin accounts can access user management');
    }
  }
}
