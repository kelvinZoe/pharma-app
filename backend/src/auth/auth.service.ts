import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<any> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = normalizedIdentifier.includes('@')
      ? await this.prisma.user.findUnique({
          where: { email: normalizedIdentifier },
          include: { tenant: true },
        })
      : await this.prisma.user.findFirst({
          where: { username: normalizedIdentifier },
          include: { tenant: true },
        });

    if (user && user.isActive && user.isVerified) {
      const isMatch = await bcrypt.compare(pass, user.passwordHash);
      if (isMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    const rolesArray: number[] = user.roles
      ? (typeof user.roles === 'string' ? user.roles.split(',').map(Number) : user.roles)
      : [user.role];

    const payload = {
      email: user.email,
      username: user.username,
      sub: user.id,
      role: user.role,
      roles: rolesArray,
      module: user.module,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? 'default',
      tenantName: user.tenant?.name ?? 'PharmaFlow Clinic',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        roles: rolesArray,
        module: user.module,
        tenantId: user.tenantId,
        tenantSlug: user.tenant?.slug ?? 'default',
        tenantName: user.tenant?.name ?? 'PharmaFlow Clinic',
      },
    };
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is no longer active or exists');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      const rolesRaw = (result as any).roles;
      return {
        ...result,
        roles: rolesRaw ? String(rolesRaw).split(',').map(Number) : [result.role],
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async registerClinic(data: any) {
    if (!data.clinicName || !data.clinicSlug || !data.adminEmail || !data.adminPassword || !data.adminName) {
      throw new BadRequestException('All fields (clinicName, clinicSlug, adminEmail, adminPassword, adminName) are required');
    }

    const existingTenantSlug = await this.prisma.tenant.findUnique({
      where: { slug: data.clinicSlug },
    });
    if (existingTenantSlug) {
      throw new BadRequestException('Clinic URL slug is already taken');
    }

    const existingTenantName = await this.prisma.tenant.findUnique({
      where: { name: data.clinicName },
    });
    if (existingTenantName) {
      throw new BadRequestException('Clinic name is already registered');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.adminEmail },
    });
    if (existingUser) {
      throw new BadRequestException('Email is already registered under another clinic');
    }

    // 1. Create the Tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.clinicName,
        slug: data.clinicSlug,
      },
    });

    // 2. Hash admin password & create the User
    const passwordHash = await bcrypt.hash(data.adminPassword, 10);
    const adminUser = await this.prisma.user.create({
      data: {
        fullName: data.adminName,
        email: data.adminEmail,
        username: 'admin',
        passwordHash,
        phone: data.adminPhone ?? null,
        role: 0, // Admin role
        module: 'admin',
        isActive: true,
        isVerified: true,
        tenantId: tenant.id,
      },
    });

    // 3. Seed default departments & clinic services for the new tenant
    await this.seedTenantData(tenant.id);

    return {
      message: 'Clinic set up successfully',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
      },
    };
  }

  async verifyInvite(token: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { inviteToken: token },
    });

    if (!user) {
      throw new NotFoundException('Invitation token is invalid');
    }

    if (user.inviteExpires && user.inviteExpires < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    return {
      email: user.email,
      fullName: user.fullName,
    };
  }

  async completeInvite(data: any) {
    if (!data.token || !data.password) {
      throw new BadRequestException('Token and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { inviteToken: data.token },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('Invitation token is invalid');
    }

    if (user.inviteExpires && user.inviteExpires < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isVerified: true,
        isActive: true,
        inviteToken: null,
        inviteExpires: null,
      },
      include: { tenant: true },
    });

    // Log the user in directly by generating session payload
    return this.login(updatedUser);
  }

  private async seedTenantData(tenantId: string) {
    // Seed Laboratory Department
    const labDept = await this.prisma.department.create({
      data: { name: 'Laboratory', code: 'LAB', isActive: true, tenantId }
    });
    // Seed Scanning Department
    const scanDept = await this.prisma.department.create({
      data: { name: 'Scanning', code: 'SCAN', isActive: true, tenantId }
    });

    // Seed services
    const services = [
      { name: 'Full Blood Count', price: 80.00, departmentId: labDept.id },
      { name: 'Malaria Rapid Diagnostic Test', price: 40.00, departmentId: labDept.id },
      { name: 'Lipid Profile', price: 120.00, departmentId: labDept.id },
      { name: 'Urinalysis', price: 35.00, departmentId: labDept.id },
      { name: 'Blood Glucose Test', price: 30.00, departmentId: labDept.id },
      { name: 'Typhoid Test (Widal)', price: 45.00, departmentId: labDept.id },
      { name: 'Abdominal Ultrasound', price: 150.00, departmentId: scanDept.id },
      { name: 'Chest X-Ray (A/P)', price: 180.00, departmentId: scanDept.id },
      { name: 'Pelvic Ultrasound', price: 120.00, departmentId: scanDept.id },
      { name: 'MRI Brain Scan (Plain)', price: 950.00, departmentId: scanDept.id },
      { name: 'Electrocardiogram (ECG)', price: 100.00, departmentId: scanDept.id },
      { name: 'CT Scan Head (Plain)', price: 650.00, departmentId: scanDept.id },
    ];

    for (const s of services) {
      await this.prisma.service.create({
        data: {
          name: s.name,
          price: s.price,
          departmentId: s.departmentId,
          tenantId
        }
      });
    }

    // Seed standard pharmacy products
    const products = [
      { name: 'Paracetamol 500mg', productCode: 'PXM001', unitOfMeasure: 'tablet', reorderLevel: 100, tenantId },
      { name: 'Amoxicillin 250mg', productCode: 'AMX002', unitOfMeasure: 'capsule', reorderLevel: 50, tenantId },
      { name: 'Ibuprofen 400mg', productCode: 'IBU003', unitOfMeasure: 'tablet', reorderLevel: 50, tenantId },
      { name: 'Cough Syrup 100ml', productCode: 'CSY004', unitOfMeasure: 'bottle', reorderLevel: 20, tenantId },
    ];

    for (const p of products) {
      await this.prisma.pharmacyProduct.create({
        data: p,
      });
    }
  }
}
