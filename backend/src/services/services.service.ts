import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Departments ---
  async findAllDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async createDepartment(data: any, userId: string) {
    if (!data.name) {
      throw new BadRequestException('Department name is required');
    }
    const code = data.code ?? data.name.substring(0, 4).toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: {
          name: String(data.name).trim(),
          code: String(code).trim().toUpperCase(),
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
      });
      await tx.auditLog.create({
        data: { actionType: 'create', entityType: 'department', entityId: department.id, afterData: JSON.stringify({ name: department.name, code: department.code }), actorUserId: userId },
      });
      return department;
    });
  }

  // --- Services ---
  async findAllServices(page?: number, limit?: number, search?: string) {
    if (page === undefined && limit === undefined && search === undefined) {
      return this.prisma.service.findMany({
        include: {
          department: {
            select: { name: true, code: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 250,
      });
    }

    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const limitNum = limit && Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Math.trunc(Number(limit))), 100) : 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { department: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          department: {
            select: { name: true, code: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async createService(data: any, userId: string) {
    if (!data.name || data.price === undefined || !data.departmentId) {
      throw new BadRequestException('Service name, price, and departmentId are required');
    }

    const price = this.requirePositivePrice(data.price);
    const department = await this.prisma.department.findUnique({ where: { id: String(data.departmentId) } });
    if (!department || !department.isActive) throw new BadRequestException('Select an active department');
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          name: String(data.name).trim(),
          price,
          departmentId: department.id,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
        include: { department: { select: { name: true, code: true } } },
      });
      await tx.auditLog.create({
        data: { actionType: 'create', entityType: 'clinic_service', entityId: service.id, afterData: JSON.stringify({ name: service.name, price, departmentId: department.id }), actorUserId: userId },
      });
      return service;
    });
  }

  async updateService(id: string, data: any, userId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = this.requirePositivePrice(data.price);
    if (data.departmentId !== undefined) {
      const department = await this.prisma.department.findUnique({ where: { id: String(data.departmentId) } });
      if (!department || !department.isActive) throw new BadRequestException('Select an active department');
      updateData.departmentId = department.id;
    }
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: updateData,
        include: { department: { select: { name: true, code: true } } },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'update',
          entityType: 'clinic_service',
          entityId: id,
          beforeData: JSON.stringify({ name: service.name, price: Number(service.price), departmentId: service.departmentId, isActive: service.isActive }),
          afterData: JSON.stringify({ name: updated.name, price: Number(updated.price), departmentId: updated.departmentId, isActive: updated.isActive }),
          actorUserId: userId,
        },
      });
      return updated;
    });
  }

  async deleteService(id: string, userId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    if (!service.isActive) return service;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({ where: { id }, data: { isActive: false } });
      await tx.auditLog.create({
        data: { actionType: 'deactivate', entityType: 'clinic_service', entityId: id, beforeData: JSON.stringify({ isActive: true }), afterData: JSON.stringify({ isActive: false }), actorUserId: userId },
      });
      return updated;
    });
  }

  // --- Result Templates ---
  async findTemplateByServiceId(serviceId: string) {
    return this.prisma.serviceResultTemplate.findFirst({
      where: { serviceId },
    });
  }

  async saveTemplate(serviceId: string, data: any, userId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!data.layoutJson) {
      throw new BadRequestException('layoutJson is required for template');
    }

    // Upsert template
    const existing = await this.prisma.serviceResultTemplate.findFirst({
      where: { serviceId },
    });

    return this.prisma.$transaction(async (tx) => {
      const template = existing
        ? await tx.serviceResultTemplate.update({
            where: { id: existing.id },
            data: {
              templateName: data.templateName ?? service.name,
              layoutJson: data.layoutJson,
              isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
            },
          })
        : await tx.serviceResultTemplate.create({
            data: {
              serviceId,
              templateName: data.templateName ?? service.name,
              layoutJson: data.layoutJson,
              isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
            },
          });
      await tx.auditLog.create({
        data: {
          actionType: existing ? 'update' : 'create',
          entityType: 'service_result_template',
          entityId: template.id,
          beforeData: existing ? JSON.stringify({ templateName: existing.templateName, isActive: existing.isActive }) : null,
          afterData: JSON.stringify({ serviceId, templateName: template.templateName, isActive: template.isActive }),
          actorUserId: userId,
        },
      });
      return template;
    });
  }

  // --- General Templates ---
  async findAllGeneralTemplates(departmentCode?: string) {
    const whereClause: any = {};
    if (departmentCode) {
      whereClause.items = {
        some: {
          service: {
            department: {
              code: departmentCode.toUpperCase(),
            },
          },
        },
      };
    }
    return this.prisma.generalTemplate.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            service: {
              include: { department: true }
            }
          },
          orderBy: { sortOrder: 'asc' },
          take: 250,
        }
      },
      orderBy: { name: 'asc' },
      take: 250,
    });
  }

  async findGeneralTemplateById(id: string) {
    const template = await this.prisma.generalTemplate.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            service: {
              include: { department: true }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    if (!template) {
      throw new NotFoundException('General Template not found');
    }
    return template;
  }

  async createGeneralTemplate(data: any, userId: string) {
    if (!data.name || !Array.isArray(data.serviceIds)) {
      throw new BadRequestException('Template name and serviceIds list are required');
    }

    const serviceIds = await this.validateServiceIds(data.serviceIds);
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.generalTemplate.create({
        data: {
          name: data.name,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        }
      });

      for (let i = 0; i < serviceIds.length; i++) {
        await tx.generalTemplateService.create({
          data: {
            generalTemplateId: template.id,
            serviceId: serviceIds[i],
            sortOrder: i,
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actionType: 'create',
          entityType: 'general_service_template',
          entityId: template.id,
          afterData: JSON.stringify({ name: template.name, serviceIds, isActive: template.isActive }),
          actorUserId: userId,
        },
      });
      return tx.generalTemplate.findUnique({
        where: { id: template.id },
        include: {
          items: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });
  }

  async updateGeneralTemplate(id: string, data: any, userId: string) {
    const template = await this.prisma.generalTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('General Template not found');
    }
    const serviceIds = Array.isArray(data.serviceIds) ? await this.validateServiceIds(data.serviceIds) : null;

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

      await tx.generalTemplate.update({
        where: { id },
        data: updateData
      });

      if (serviceIds) {
        await tx.generalTemplateService.deleteMany({
          where: { generalTemplateId: id }
        });

        for (let i = 0; i < serviceIds.length; i++) {
          await tx.generalTemplateService.create({
            data: {
              generalTemplateId: id,
              serviceId: serviceIds[i],
              sortOrder: i,
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actionType: 'update',
          entityType: 'general_service_template',
          entityId: id,
          beforeData: JSON.stringify({ name: template.name, isActive: template.isActive }),
          afterData: JSON.stringify({ name: updateData.name ?? template.name, isActive: updateData.isActive ?? template.isActive, serviceIds }),
          actorUserId: userId,
        },
      });

      return tx.generalTemplate.findUnique({
        where: { id },
        include: {
          items: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });
  }

  async deleteGeneralTemplate(id: string, userId: string) {
    const template = await this.prisma.generalTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('General Template not found');
    }
    if (!template.isActive) return template;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.generalTemplate.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'deactivate',
          entityType: 'general_service_template',
          entityId: id,
          beforeData: JSON.stringify({ isActive: true }),
          afterData: JSON.stringify({ isActive: false }),
          actorUserId: userId,
        },
      });
      return updated;
    });
  }

  private requirePositivePrice(value: unknown): number {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('Service price must be a valid amount greater than zero');
    }
    return price;
  }

  private async validateServiceIds(values: unknown[]): Promise<string[]> {
    const serviceIds = [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
    if (!serviceIds.length) throw new BadRequestException('Select at least one active service');
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      select: { id: true },
    });
    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more services are inactive or belong to another clinic');
    }
    return serviceIds;
  }
}
