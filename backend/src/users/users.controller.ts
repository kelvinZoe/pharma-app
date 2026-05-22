import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
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

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.usersService.update(id, body);
  }

  private ensureAdmin(user: any) {
    // Admin (role 0) can manage users
    if (!user || user.role !== 0) {
      throw new ForbiddenException('Only admin accounts can access user management');
    }
  }
}
