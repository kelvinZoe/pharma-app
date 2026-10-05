import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './authorization/require-permissions.decorator';
import { getUserRoles, isRole, parseRole, Permission, Role } from './authorization/permissions';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const identifier = body.identifier ?? body.email ?? body.username;
    if (!identifier || !body.password) {
      throw new UnauthorizedException('Email/username and password are required');
    }

    const user = await this.authService.validateUser(identifier, body.password, body.tenantSlug);
    if (!user) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    // Role-based check
    if (body.role !== undefined) {
      const selectedRole = parseRole(body.role);
      if (!isRole(selectedRole)) {
        throw new UnauthorizedException('Select a valid workspace role');
      }
      // Parse user's roles array
      const userRoles = getUserRoles(user);

      // Admin (role 0) can log into any module/role for administration/testing override
      // Other users can only log into their assigned roles
      if (!userRoles.includes(Role.Admin) && !userRoles.includes(selectedRole)) {
        throw new UnauthorizedException('You do not have access to this module');
      }
      
      // If admin logs in as another role, we temporarily map their active session module/role
      if (userRoles.includes(Role.Admin) && selectedRole !== Role.Admin) {
        const adminAsOther = {
          ...user,
          role: selectedRole,
          module: this.resolveModule(selectedRole)
        };
        return this.authService.login(adminAsOther);
      }

      // If multi-role user selects a specific role, set that as their active session role
      if (!userRoles.includes(Role.Admin) && userRoles.includes(selectedRole) && selectedRole !== user.role) {
        const asSelectedRole = {
          ...user,
          role: selectedRole,
          module: this.resolveModule(selectedRole)
        };
        return this.authService.login(asSelectedRole);
      }
    }

    return this.authService.login(user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ProfileRead)
  async getProfile(@Req() req: any) {
    const user = req.user;
    const roles = getUserRoles(user);
    
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      username: user.username,
      phone: user.phone,
      role: user.role,
      roles,
      module: user.module,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? 'default',
      tenantName: user.tenant?.name ?? 'Clinic Workspace',
    };
  }

  @Post('register-clinic')
  async registerClinic(@Body() body: any) {
    return this.authService.registerClinic(body);
  }

  @Get('verify-invite')
  async verifyInvite(@Query('token') token: string) {
    return this.authService.verifyInvite(token);
  }

  @Post('complete-invite')
  async completeInvite(@Body() body: any) {
    return this.authService.completeInvite(body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: any) {
    return this.authService.requestPasswordReset(body);
  }

  @Get('reset-password')
  async verifyPasswordReset(@Query('token') token: string) {
    return this.authService.verifyPasswordReset(token);
  }

  @Post('reset-password')
  async completePasswordReset(@Body() body: any) {
    return this.authService.completePasswordReset(body);
  }

  private resolveModule(role: number): string {
    switch (role) {
      case Role.Admin: return 'admin';
      case Role.Frontdesk: return 'frontdesk';
      case Role.Laboratory: return 'laboratory';
      case Role.Scanning: return 'scanning';
      case Role.Pharmacy: return 'pharmacy';
      case Role.Accounting:
      default: return 'accounting';
    }
  }
}
