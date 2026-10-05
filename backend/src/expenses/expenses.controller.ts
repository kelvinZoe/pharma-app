import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';

@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @RequirePermissions(Permission.ExpenseCreate)
  @Post()
  async create(@Req() req: any, @Body() data: any) {
    return this.expensesService.createExpense(data, req.user.id);
  }

  @RequirePermissions(Permission.ExpenseRead)
  @Get()
  async findAll(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.expensesService.findAllExpenses(startDate, endDate, pageNum, limitNum);
  }

  @RequirePermissions(Permission.ExpenseVoid)
  @Post(':id/void')
  async voidExpense(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.expensesService.voidExpense(id, req.user.id, reason);
  }
}
