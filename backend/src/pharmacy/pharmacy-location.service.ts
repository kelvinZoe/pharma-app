import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';

@Injectable()
export class PharmacyLocationService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccessibleLocations(user: any) {
    const roles = this.getRoles(user);
    if (roles.includes(0) || roles.includes(5)) {
      return this.prisma.pharmacyLocation.findMany({
        where: { isActive: true },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
      });
    }

    if (!roles.includes(4)) {
      throw new ForbiddenException('You do not have access to pharmacy locations');
    }

    const memberships = await this.prisma.userPharmacyLocation.findMany({
      where: {
        userId: user.id,
        isActive: true,
        location: { isActive: true },
      },
      include: { location: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return memberships.map((membership) => membership.location);
  }

  async resolveAccessibleLocation(user: any, requestedLocationId?: string) {
    const locations = await this.listAccessibleLocations(user);
    if (locations.length === 0) {
      throw new ForbiddenException('No active pharmacy location is assigned to your account');
    }

    if (!requestedLocationId) {
      return locations[0];
    }

    const location = locations.find((item) => item.id === requestedLocationId);
    if (!location) {
      throw new ForbiddenException('The selected pharmacy location is not assigned to your account');
    }

    return location;
  }

  async createLocation(data: any, user: any) {
    const roles = this.getRoles(user);
    if (!roles.includes(0)) {
      throw new ForbiddenException('Only administrators can create pharmacy locations');
    }

    const tenantId = TenantContextService.getTenantId() ?? user.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    const code = String(data.code ?? '').trim().toUpperCase();
    const name = String(data.name ?? '').trim();
    if (!code || !/^[A-Z0-9_-]{2,20}$/.test(code)) {
      throw new BadRequestException('Location code must contain 2-20 letters, numbers, hyphens, or underscores');
    }
    if (name.length < 2) {
      throw new BadRequestException('Location name must be at least 2 characters');
    }

    const supervisingPharmacistId = data.supervisingPharmacistId
      ? String(data.supervisingPharmacistId)
      : null;
    if (supervisingPharmacistId) {
      const pharmacist = await this.prisma.user.findUnique({ where: { id: supervisingPharmacistId } });
      if (!pharmacist) {
        throw new NotFoundException('Supervising pharmacist was not found');
      }
    }

    return this.prisma.pharmacyLocation.create({
      data: {
        tenantId,
        code,
        name,
        address: data.address ? String(data.address).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        licenceNumber: data.licenceNumber ? String(data.licenceNumber).trim() : null,
        supervisingPharmacistId,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
  }

  async listLocationUsers(locationId: string, user: any) {
    this.ensureAdmin(user);
    await this.requireLocation(locationId);

    return this.prisma.userPharmacyLocation.findMany({
      where: { locationId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            role: true,
            roles: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async assignUser(locationId: string, data: any, user: any) {
    this.ensureAdmin(user);
    const location = await this.requireLocation(locationId);
    const userId = String(data.userId ?? '').trim();
    if (!userId) {
      throw new BadRequestException('A pharmacy user is required');
    }

    const staffUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!staffUser || !staffUser.isActive) {
      throw new NotFoundException('The selected active user was not found');
    }

    const staffRoles = this.getRoles(staffUser);
    if (!staffRoles.includes(0) && !staffRoles.includes(4)) {
      throw new BadRequestException('Only administrators and pharmacy staff can be assigned to pharmacy locations');
    }

    const isDefault = Boolean(data.isDefault);
    if (isDefault) {
      await this.prisma.userPharmacyLocation.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    await this.prisma.userPharmacyLocation.upsert({
      where: { userId_locationId: { userId, locationId } },
      create: {
        tenantId: location.tenantId,
        userId,
        locationId,
        role: staffRoles.includes(0) ? 'admin' : 'pharmacy',
        isDefault,
        isActive: true,
      },
      update: { isDefault, isActive: true },
    });

    return this.listLocationUsers(locationId, user);
  }

  async createDefaultLocation(tenantId: string, adminUserId: string) {
    const location = await this.prisma.pharmacyLocation.create({
      data: {
        tenantId,
        code: 'MAIN',
        name: 'Main Pharmacy',
        isActive: true,
      },
    });

    await this.prisma.userPharmacyLocation.create({
      data: {
        tenantId,
        userId: adminUserId,
        locationId: location.id,
        role: 'admin',
        isDefault: true,
        isActive: true,
      },
    });

    return location;
  }

  async assignDefaultLocationToUser(userId: string, roles: number[]) {
    if (!roles.includes(0) && !roles.includes(4)) return;

    const defaultLocation = await this.prisma.pharmacyLocation.findFirst({
      where: { isActive: true },
      orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
    });
    if (!defaultLocation) return;

    await this.prisma.userPharmacyLocation.upsert({
      where: {
        userId_locationId: {
          userId,
          locationId: defaultLocation.id,
        },
      },
      create: {
        userId,
        locationId: defaultLocation.id,
        tenantId: defaultLocation.tenantId,
        role: roles.includes(0) ? 'admin' : 'pharmacy',
        isDefault: true,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
  }

  private getRoles(user: any): number[] {
    const rawRoles = user?.roles;
    if (Array.isArray(rawRoles)) return rawRoles.map(Number);
    if (rawRoles) return String(rawRoles).split(',').map(Number);
    return [Number(user?.role)];
  }

  private ensureAdmin(user: any) {
    if (!this.getRoles(user).includes(0)) {
      throw new ForbiddenException('Only administrators can manage pharmacy locations');
    }
  }

  private async requireLocation(locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Pharmacy location was not found');
    }
    return location;
  }
}
