import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Departments ---
  async findAllDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(data: any) {
    if (!data.name) {
      throw new BadRequestException('Department name is required');
    }
    const code = data.code ?? data.name.substring(0, 4).toUpperCase();
    return this.prisma.department.create({
      data: {
        name: data.name,
        code,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
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
      });
    }

    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const limitNum = limit ? Math.max(1, Number(limit)) : 20;
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

  async createService(data: any) {
    if (!data.name || data.price === undefined || !data.departmentId) {
      throw new BadRequestException('Service name, price, and departmentId are required');
    }

    return this.prisma.service.create({
      data: {
        name: data.name,
        price: Number(data.price),
        departmentId: data.departmentId,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
      include: {
        department: {
          select: { name: true, code: true },
        },
      },
    });
  }

  async updateService(id: string, data: any) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = Number(data.price);
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return this.prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        department: {
          select: { name: true, code: true },
        },
      },
    });
  }

  async deleteService(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    try {
      await this.prisma.serviceResultTemplate.deleteMany({
        where: { serviceId: id },
      });
      return await this.prisma.service.delete({
        where: { id },
      });
    } catch (err) {
      throw new BadRequestException(
        'Cannot delete this service because it is already referenced in patient visit logs or invoices.'
      );
    }
  }

  // --- Result Templates ---
  async findTemplateByServiceId(serviceId: string) {
    return this.prisma.serviceResultTemplate.findFirst({
      where: { serviceId },
    });
  }

  async saveTemplate(serviceId: string, data: any) {
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

    if (existing) {
      return this.prisma.serviceResultTemplate.update({
        where: { id: existing.id },
        data: {
          templateName: data.templateName ?? service.name,
          layoutJson: data.layoutJson,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
      });
    } else {
      return this.prisma.serviceResultTemplate.create({
        data: {
          serviceId,
          templateName: data.templateName ?? service.name,
          layoutJson: data.layoutJson,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
      });
    }
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
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
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

  async createGeneralTemplate(data: any) {
    if (!data.name || !Array.isArray(data.serviceIds)) {
      throw new BadRequestException('Template name and serviceIds list are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.generalTemplate.create({
        data: {
          name: data.name,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        }
      });

      for (let i = 0; i < data.serviceIds.length; i++) {
        await tx.generalTemplateService.create({
          data: {
            generalTemplateId: template.id,
            serviceId: data.serviceIds[i],
            sortOrder: i,
          }
        });
      }

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

  async updateGeneralTemplate(id: string, data: any) {
    const template = await this.prisma.generalTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('General Template not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

      await tx.generalTemplate.update({
        where: { id },
        data: updateData
      });

      if (Array.isArray(data.serviceIds)) {
        await tx.generalTemplateService.deleteMany({
          where: { generalTemplateId: id }
        });

        for (let i = 0; i < data.serviceIds.length; i++) {
          await tx.generalTemplateService.create({
            data: {
              generalTemplateId: id,
              serviceId: data.serviceIds[i],
              sortOrder: i,
            }
          });
        }
      }

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

  async deleteGeneralTemplate(id: string) {
    const template = await this.prisma.generalTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('General Template not found');
    }
    return this.prisma.generalTemplate.delete({
      where: { id }
    });
  }
}
