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

    const requestedPage = Number(page);
    const requestedLimit = Number(limit);
    const pageNum = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;
    const limitNum = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.trunc(requestedLimit)))
      : 20;
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

  async create(data: any, actorUserId: string) {
    const email = String(data.email ?? '').trim().toLowerCase();
    const fullName = String(data.fullName ?? '').trim();
    if (!email || !fullName) {
      throw new BadRequestException('Email and full name are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid email address is required');
    }
    if (fullName.length < 2) {
      throw new BadRequestException('Full name must be at least 2 characters');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException('Email is already taken');
    }

    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
      throw new BadRequestException('Active status must be true or false');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Generate dummy password hash so it can't be logged into until verified
    const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    // Resolve roles array to primary role and module
    const rolesArray = this.normalizeRoles(data.roles, data.role);
    const primaryRole = rolesArray[0];
    const rolesStr = rolesArray.join(',');
    const moduleResolved = this.resolveModule(primaryRole);
    const username = await this.generateUsername(fullName);

    let newUser: any;
    try {
      newUser = await this.prisma.user.create({
        data: {
          fullName,
          email,
          username,
          passwordHash: dummyPasswordHash,
          phone: data.phone ? String(data.phone).trim() : null,
          role: primaryRole,
          roles: rolesStr,
          module: moduleResolved,
          isActive: data.isActive ?? true,
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

    if (rolesArray.includes(0) || rolesArray.includes(4)) {
      const defaultLocation = await this.prisma.pharmacyLocation.findFirst({
        where: { isActive: true },
        orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
      });
      if (defaultLocation) {
        await this.prisma.userPharmacyLocation.create({
          data: {
            userId: newUser.id,
            locationId: defaultLocation.id,
            tenantId: defaultLocation.tenantId,
            role: rolesArray.includes(0) ? 'admin' : 'pharmacy',
            isDefault: true,
            isActive: true,
          },
        });
      }
    }

    // Send the email invite
    await this.emailService.sendStaffInvitation(email, fullName, inviteToken);

    await this.prisma.auditLog.create({
      data: {
        actionType: 'create',
        entityType: 'user',
        entityId: newUser.id,
        afterData: JSON.stringify({ roles: rolesArray, isActive: newUser.isActive, isVerified: false }),
        actorUserId,
      },
    });

    return {
      ...newUser,
      roles: rolesStr.split(',').map(Number),
    };
  }

  async resendInvitation(id: string, actorUserId: string) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          inviteToken,
          inviteExpires,
        },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'resend_invitation',
          entityType: 'user',
          entityId: id,
          afterData: JSON.stringify({ inviteExpires }),
          actorUserId,
        },
      });
    });

    await this.emailService.sendStaffInvitation(user.email, user.fullName, inviteToken);

    return {
      message: 'Staff invitation resent successfully.',
      expiresAt: inviteExpires,
    };
  }

  async remove(id: string, actorUserId: string) {
    const tenantId = TenantContextService.getTenantId();
    this.logger.log(`Deleting user ${id}${tenantId ? ` in tenant ${tenantId}` : ''}`);

    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Safeguard: prevent deleting the last admin account
    if (this.hasAdminRole(user) && !(await this.hasAnotherActiveAdmin(id))) {
      throw new BadRequestException('Cannot remove the last active administrator account');
    }

    if (!user.isActive) {
      return { message: 'Staff account is already inactive' };
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id, isActive: true },
        data: { isActive: false },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Staff account changed. Refresh and try again.');
      }
      await tx.auditLog.create({
        data: {
          actionType: 'deactivate',
          entityType: 'user',
          entityId: id,
          beforeData: JSON.stringify({ isActive: true, role: user.role, roles: user.roles }),
          afterData: JSON.stringify({ isActive: false }),
          actorUserId,
        },
      });
    });
    return { message: 'Staff account deactivated successfully' };
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

  async update(id: string, data: any, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};
    if (data.fullName !== undefined) {
      const fullName = String(data.fullName).trim();
      if (fullName.length < 2) throw new BadRequestException('Full name must be at least 2 characters');
      updateData.fullName = fullName;
    }
    if (data.phone !== undefined) updateData.phone = data.phone ? String(data.phone).trim() : null;
    if (data.isActive !== undefined) {
      if (typeof data.isActive !== 'boolean') throw new BadRequestException('Active status must be true or false');
      updateData.isActive = data.isActive;
    }

    if (Array.isArray(data.roles) || data.role !== undefined) {
      const rolesArray = this.normalizeRoles(data.roles, data.role ?? user.role);
      const primaryRole = rolesArray[0];
      updateData.roles = rolesArray.join(',');
      updateData.role = primaryRole;
      updateData.module = this.resolveModule(primaryRole);
    }

    if (data.password) {
      const password = String(data.password);
      if (password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('A valid email address is required');
      }
      if (email === user.email) {
        updateData.email = email;
      } else {
        const existing = await this.prisma.user.findUnique({
          where: { email },
        });
        if (existing) {
          throw new BadRequestException('Email is already taken');
        }
        updateData.email = email;
      }
    }

    const resultingRoles = updateData.roles ? String(updateData.roles).split(',').map(Number) : this.getUserRoles(user);
    const remainsActive = updateData.isActive ?? user.isActive;
    if (id === actorUserId && (!remainsActive || !resultingRoles.includes(0))) {
      throw new BadRequestException('Use another administrator to change your own administrator access');
    }
    if (this.hasAdminRole(user) && (!remainsActive || !resultingRoles.includes(0)) && !(await this.hasAnotherActiveAdmin(id))) {
      throw new BadRequestException('Cannot remove the last active administrator account');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.update({
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
      await tx.auditLog.create({
        data: {
          actionType: 'update',
          entityType: 'user',
          entityId: id,
          beforeData: JSON.stringify({ fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, roles: user.roles, isActive: user.isActive }),
          afterData: JSON.stringify({ fullName: changed.fullName, email: changed.email, phone: changed.phone, role: changed.role, roles: changed.roles, isActive: changed.isActive }),
          actorUserId,
        },
      });
      return changed;
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

  private normalizeRoles(values: unknown, fallback: unknown): number[] {
    const source = Array.isArray(values) && values.length > 0 ? values : [fallback ?? 1];
    const roles = [...new Set(source.map(Number))];
    if (!roles.length || roles.some((role) => !Number.isInteger(role) || role < 0 || role > 5)) {
      throw new BadRequestException('Select one or more valid staff roles');
    }
    return roles.includes(0) ? [0] : roles;
  }

  private getUserRoles(user: { role: number; roles?: string | null }): number[] {
    return user.roles ? String(user.roles).split(',').map(Number) : [Number(user.role)];
  }

  private hasAdminRole(user: { role: number; roles?: string | null }): boolean {
    return this.getUserRoles(user).includes(0);
  }

  private async hasAnotherActiveAdmin(excludedUserId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        id: { not: excludedUserId },
        isActive: true,
        OR: [
          { role: 0 },
          { roles: '0' },
          { roles: { startsWith: '0,' } },
          { roles: { endsWith: ',0' } },
          { roles: { contains: ',0,' } },
        ],
      },
    });
    return count > 0;
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
      const existing = await this.prisma.user.findFirst({
        where: { username: candidate },
        select: { id: true },
      });
      if (!existing) {
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
