import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findAll(page?: number, limit?: number, search?: string) {
    const rolesMapper = (u: any) => ({
      ...u,
      roles: u.roles ? u.roles.split(',').map(Number) : [u.role],
    });

    if (page === undefined && limit === undefined && search === undefined) {
      const data = await this.prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          email: true,
          role: true,
          roles: true,
          module: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return data.map(rolesMapper);
    }

    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const limitNum = limit ? Math.max(1, Number(limit)) : 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          email: true,
          role: true,
          roles: true,
          module: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map(rolesMapper),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async create(data: any) {
    if (!data.email || !data.fullName) {
      throw new BadRequestException('Email and full name are required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email is already taken');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Generate dummy password hash so it can't be logged into until verified
    const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    // Resolve roles array to primary role and module
    let primaryRole = Number(data.role ?? 1);
    let rolesArray: number[] = [primaryRole];
    if (Array.isArray(data.roles) && data.roles.length > 0) {
      rolesArray = data.roles.map(Number);
      primaryRole = rolesArray[0];
    }
    const rolesStr = rolesArray.join(',');
    const moduleResolved = this.resolveModule(primaryRole);
    const username = await this.generateUsername(data.fullName);

    let newUser: any;
    try {
      newUser = await this.prisma.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          username,
          passwordHash: dummyPasswordHash,
          phone: data.phone ?? null,
          role: primaryRole,
          roles: rolesStr,
          module: moduleResolved,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          isVerified: false,
          inviteToken,
          inviteExpires,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          email: true,
          role: true,
          roles: true,
          module: true,
          isActive: true,
          inviteToken: true,
        },
      });
    } catch (err: any) {
      // Prisma unique constraint violation
      if (err?.code === 'P2002') {
        const fields: string[] = err?.meta?.constraint?.fields ?? [];
        if (fields.some((f: string) => f.includes('username'))) {
          throw new ConflictException('Could not generate a unique username. Please try again.');
        }
        if (fields.some((f: string) => f.includes('email'))) {
          throw new ConflictException('A staff account with this email already exists.');
        }
        throw new ConflictException('A duplicate value was detected. Please check the username and email.');
      }
      throw err;
    }

    // Send the email invite
    await this.emailService.sendStaffInvitation(data.email, data.fullName, inviteToken);

    return {
      ...newUser,
      roles: rolesStr.split(',').map(Number),
    };
  }

  async resendInvitation(id: string) {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('This staff account has already been verified.');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        inviteToken,
        inviteExpires,
      },
    });

    await this.emailService.sendStaffInvitation(user.email, user.fullName, inviteToken);

    return {
      message: 'Staff invitation resent successfully.',
      inviteToken,
      inviteExpires,
    };
  }

  async remove(id: string) {
    const tenantId = TenantContextService.getTenantId();
    this.logger.log(`Deleting user ${id}${tenantId ? ` in tenant ${tenantId}` : ''}`);

    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Safeguard: prevent deleting the last admin account
    if (user.role === 0) {
      const adminCount = await this.prisma.user.count({ where: { role: 0 } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last administrator account');
      }
    }

    const deleted = await this.prisma.user.deleteMany({ where: { id } });
    if (deleted.count === 0) {
      throw new NotFoundException('User not found');
    }
    return { message: 'Staff account removed successfully' };
  }

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSessionProfile(user);
  }

  async updateProfile(id: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};
    if (data.name !== undefined || data.fullName !== undefined) {
      const fullName = String(data.name ?? data.fullName ?? '').trim();
      if (fullName.length < 2) {
        throw new BadRequestException('Full name must be at least 2 characters');
      }
      updateData.fullName = fullName;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone ? String(data.phone).trim() : null;
    }

    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      if (!email || !email.includes('@')) {
        throw new BadRequestException('A valid email address is required');
      }
      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== id) {
          throw new BadRequestException('Email is already taken');
        }
      }
      updateData.email = email;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { tenant: true },
    });

    return this.toSessionProfile(updated);
  }

  async updateOwnPassword(id: string, data: any) {
    const currentPassword = String(data.currentPassword ?? '');
    const newPassword = String(data.newPassword ?? data.password ?? '');

    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      include: { tenant: true },
    });

    return this.toSessionProfile(updated);
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    // Handle roles array update
    if (Array.isArray(data.roles) && data.roles.length > 0) {
      const rolesArray = data.roles.map(Number);
      const primaryRole = rolesArray[0];
      updateData.roles = rolesArray.join(',');
      updateData.role = primaryRole;
      updateData.module = this.resolveModule(primaryRole);
    } else if (data.role !== undefined) {
      updateData.role = Number(data.role);
      updateData.roles = String(data.role);
      updateData.module = this.resolveModule(Number(data.role));
    }
    if (data.module !== undefined) updateData.module = data.module;

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    // Check email change
    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new BadRequestException('Email is already taken');
      }
      updateData.email = data.email;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        email: true,
        role: true,
        roles: true,
        module: true,
        isActive: true,
      },
    });

    return {
      ...updated,
      roles: updated.roles ? String(updated.roles).split(',').map(Number) : [updated.role],
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

  private toSessionProfile(user: any) {
    const roles = user.roles ? String(user.roles).split(',').map(Number) : [user.role];
    return {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      phone: user.phone,
      role: user.role,
      roles,
      module: user.module,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? 'default',
      tenantName: user.tenant?.name ?? 'PharmaFlow Clinic',
    };
  }

  private async generateUsername(fullName: string): Promise<string> {
    const tenantId = TenantContextService.getTenantId();
    const tenantSlug = TenantContextService.getTenantSlug();
    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, slug: true },
        })
      : null;
    const tenantCode = this.buildTenantCode(tenantSlug ?? tenant?.slug ?? tenant?.name ?? 'clinic');
    const nameCode = this.buildNameCode(fullName);
    const baseUsername = `${tenantCode}-${nameCode}`;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = attempt === 0 ? baseUsername : `${baseUsername}${attempt + 1}`;
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "username" = ${candidate} LIMIT 1
      `;
      if (existing.length === 0) {
        return candidate;
      }
    }

    return `${baseUsername}-${crypto.randomBytes(3).toString('hex')}`;
  }

  private buildTenantCode(value: string): string {
    const normalized = this.slugify(value);
    const parts = normalized.split('-').filter(Boolean);
    const code = parts.length > 1
      ? parts.map((part) => part[0]).join('')
      : normalized.slice(0, 5);
    return code.slice(0, 6) || 'clinic';
  }

  private buildNameCode(fullName: string): string {
    const parts = this.slugify(fullName).split('-').filter(Boolean);
    if (parts.length === 0) return 'staff';
    if (parts.length === 1) return parts[0].slice(0, 12);
    return `${parts[0][0]}${parts[parts.length - 1]}`.slice(0, 16);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
