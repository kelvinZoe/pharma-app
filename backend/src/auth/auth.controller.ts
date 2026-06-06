import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Role-based check
    if (body.role !== undefined) {
      const selectedRole = Number(body.role);
      // Admin (role 0) can log into any module/role for administration/testing override
      if (user.role !== 0 && user.role !== selectedRole) {
        throw new UnauthorizedException('You do not have access to this module');
      }
      
      // If admin logs in as another role, we temporarily map their active session module/role
      if (user.role === 0 && selectedRole !== 0) {
        const adminAsOther = {
          ...user,
          role: selectedRole,
          module: this.resolveModule(selectedRole)
        };
        return this.authService.login(adminAsOther);
      }
    }

    return this.authService.login(user);
  }

  @Get('profile')
  async getProfile(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const user = await this.authService.verifyToken(token);
    
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      module: user.module,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? 'default',
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

  private resolveModule(role: number): string {
    switch (role) {
      case 0: return 'admin';
      case 1: return 'frontdesk';
      case 2: return 'laboratory';
      case 3: return 'scanning';
      case 4: return 'pharmacy';
      case 5:
      default: return 'accounting';
    }
  }
}
