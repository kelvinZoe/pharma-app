import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findAll(page?: number, limit?: number, search?: string) {
    if (page === undefined && limit === undefined && search === undefined) {
      return this.prisma.user.findMany({
        select: {
          id: true,
          fullName: true,
          username: true,
          phone: true,
          email: true,
          role: true,
          module: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
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
          module: true,
          isActive: true,
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
      data,
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

    let newUser: any;
    try {
      newUser = await this.prisma.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          username: data.username ?? data.email.split('@')[0],
          passwordHash: dummyPasswordHash,
          phone: data.phone ?? null,
          role: Number(data.role ?? 1),
          module: data.module ?? 'frontdesk',
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
          throw new ConflictException(`Username "${data.username}" is already taken. Please choose a different one.`);
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

    return newUser;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
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

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Staff account removed successfully' };
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = Number(data.role);
    if (data.module !== undefined) updateData.module = data.module;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

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

    if (data.username !== undefined) {
      updateData.username = data.username;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        email: true,
        role: true,
        module: true,
        isActive: true,
      },
    });
  }
}
