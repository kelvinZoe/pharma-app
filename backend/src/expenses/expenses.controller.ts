import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(@Req() req: any, @Body() data: any) {
    this.ensureRoles(req.user, [0, 5]);
    return this.expensesService.createExpense(data, req.user.id);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureRoles(req.user, [0, 5]);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.expensesService.findAllExpenses(startDate, endDate, pageNum, limitNum);
  }

  @Post(':id/void')
  async voidExpense(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    this.ensureRoles(req.user, [0, 5]);
    return this.expensesService.voidExpense(id, req.user.id, reason);
  }

  private ensureRoles(user: any, allowedRoles: number[]): void {
    const roles = Array.isArray(user?.roles)
      ? user.roles.map(Number)
      : String(user?.roles ?? user?.role ?? '').split(',').map(Number);
    if (!roles.some((role: number) => allowedRoles.includes(role))) {
      throw new ForbiddenException('Only accounting or admin users can manage expenses');
    }
  }
}
