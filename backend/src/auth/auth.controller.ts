import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('Username and password are required');
    }

    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
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
      username: user.username,
      role: user.role,
      module: user.module,
    };
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
