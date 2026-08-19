import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- Patients ---
  async searchPatients(query: string) {
    if (!query) {
      return this.prisma.patient.findMany({
        take: 100,
        orderBy: { surname: 'asc' },
      });
    }

    const cleanQuery = query.trim().toLowerCase();

    return this.prisma.patient.findMany({
      where: {
        OR: [
          { surname: { contains: cleanQuery } },
          { firstName: { contains: cleanQuery } },
          { middleName: { contains: cleanQuery } },
          { phone: { contains: cleanQuery } },
          { patientCode: { contains: cleanQuery } },
        ],
      },
      orderBy: { surname: 'asc' },
      take: 100,
    });
  }


  async createPatient(data: any) {
    if (!data.surname || !data.firstName || !data.phone || !data.referralCenter) {
      throw new BadRequestException('Demographics, phone, and referral center are required');
    }

    // Generate CL-xxxxx patient code
    const lastPatient = await this.prisma.patient.findFirst({
      orderBy: { patientCode: 'desc' },
    });

    let nextNum = 10001;
    if (lastPatient && lastPatient.patientCode.startsWith('CL-')) {
      const lastNum = parseInt(lastPatient.patientCode.replace('CL-', ''), 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const patientCode = `CL-${nextNum}`;

    return this.prisma.patient.create({
      data: {
        patientCode,
        surname: data.surname,
        firstName: data.firstName,
        middleName: data.middleName ?? null,
        sex: data.sex ?? 'other',
        age: Number(data.age ?? 0),
        phone: data.phone,
        referralCenter: data.referralCenter,
        insuranceStatus: data.insuranceStatus ?? 'uninsured',
        reasonForVisit: data.reasonForVisit?.trim() ?? '',
        emergencyContactName: data.emergencyContactName?.trim() ?? '',
        emergencyContactPhone: data.emergencyContactPhone?.trim() ?? '',
        emergencyContactRel: data.emergencyContactRel?.trim() ?? '',
        isMinor: data.age && Number(data.age) < 18,
      },
    });
  }

  async updatePatient(id: string, data: any) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return this.prisma.patient.update({
      where: { id },
      data: {
        surname: data.surname,
        firstName: data.firstName,
        middleName: data.middleName,
        sex: data.sex,
        age: data.age !== undefined ? Number(data.age) : undefined,
        phone: data.phone,
        referralCenter: data.referralCenter,
        insuranceStatus: data.insuranceStatus,
        reasonForVisit: data.reasonForVisit,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRel: data.emergencyContactRel,
        isMinor: data.age !== undefined ? Number(data.age) < 18 : undefined,
      },
    });
  }

  async getPatientHistory(patientId: string) {
    return this.prisma.visit.findMany({
      where: { patientId },
      include: {
        visitServices: {
          include: {
            service: {
              include: { department: true },
            },
            results: true,
          },
        },
        prescriptions: true,
        invoice: true,
      },
      orderBy: { visitDate: 'desc' },
    });
  }

  // --- Visits ---
  async getActiveVisits(departmentCode?: string, includeAll?: boolean) {
    const whereClause: any = {};

    if (!includeAll) {
      whereClause.status = {
        in: ['registered', 'sent_to_department', 'in_progress', 'completed', 'awaiting_payment'],
      };
    } else {
      whereClause.status = {
        not: 'deleted',
      };
    }


    if (departmentCode) {
      whereClause.visitServices = {
        some: {
          service: {
            department: {
              code: departmentCode.toUpperCase(),
            },
          },
        },
      };
    }

    const visits = await this.prisma.visit.findMany({
      where: whereClause,
      include: {
        patient: true,
        visitServices: {
          include: {
            service: {
              include: { department: true },
            },
            results: true,
          },
        },
        frontdeskUser: {
          select: { fullName: true },
        },
        invoice: true,
      },
      orderBy: { visitDate: 'desc' },
      take: 250,
    });
    if (!departmentCode) return visits;
    const normalizedDepartment = departmentCode.toUpperCase();
    return visits.map((visit) => ({
      ...visit,
      visitServices: visit.visitServices.filter((line) => line.service.department?.code?.toUpperCase() === normalizedDepartment),
    }));
  }

  async findVisitById(id: string, actorRole: number = 0) {
    const departmentCode = this.departmentCodeForRole(actorRole);
    const visit = await this.prisma.visit.findUnique({
      where: {
        id,
        ...(departmentCode ? { visitServices: { some: { service: { department: { code: departmentCode } } } } } : {}),
      },
      include: {
        patient: true,
        visitServices: {
          include: {
            service: {
              include: {
                department: true,
                templates: true,
              },
            },
            results: {
              include: { enteredByUser: { select: { fullName: true } } },
            },
          },
        },
        prescriptions: {
          include: { createdBy: { select: { fullName: true } } },
        },
        invoice: {
          include: { payments: true },
        },
        frontdeskUser: { select: { fullName: true } },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (!departmentCode) return visit;
    return {
      ...visit,
      visitServices: visit.visitServices.filter((line) => line.service.department?.code?.toUpperCase() === departmentCode),
      invoice: visit.invoice ? { ...visit.invoice, payments: [] } : null,
    };
  }

  async createVisit(data: any, userId: string) {
    if (!data.patientId || !data.serviceIds || !Array.isArray(data.serviceIds) || data.serviceIds.length === 0) {
      throw new BadRequestException('patientId and at least one serviceId are required');
    }
    const serviceIds = data.serviceIds.map((id: unknown) => String(id ?? '').trim());
    if (serviceIds.some((id: string) => !id) || new Set(serviceIds).size !== serviceIds.length) {
      throw new BadRequestException('Each selected service must be unique and valid');
    }

    // Generate V-xxxxx visit number
    const lastVisit = await this.prisma.visit.findFirst({
      orderBy: { visitNumber: 'desc' },
    });

    let nextNum = 10001;
    if (lastVisit && lastVisit.visitNumber.startsWith('V-')) {
      const lastNum = parseInt(lastVisit.visitNumber.replace('V-', ''), 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const visitNumber = `V-${nextNum}`;

    // Fetch services to snapshot prices
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      include: { department: true },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('Some selected services are invalid or inactive');
    }

    // Create visit & service relations in transaction
    const visit = await this.prisma.$transaction(async (tx) => {
      const newVisit = await tx.visit.create({
        data: {
          visitNumber,
          patientId: data.patientId,
          frontdeskUserId: userId,
          status: 'sent_to_department', // directly route to department queue
          notes: data.notes ?? null,
        },
      });

      // Add visit services
      let subtotal = 0;
      for (const svcId of serviceIds) {
        const svc = services.find((s) => s.id === svcId);
        if (!svc) continue;

        subtotal += Number(svc.price);

        await tx.visitService.create({
          data: {
            visitId: newVisit.id,
            serviceId: svc.id,
            source: 'frontdesk',
            unitPrice: svc.price,
            quantity: 1,
            lineTotal: svc.price,
            status: 'pending',
          },
        });
      }

      // Generate invoice unique number INV-xxxxx
      const lastInv = await tx.clinicInvoice.findFirst({
        orderBy: { invoiceNumber: 'desc' },
      });

      let nextInvNum = 10001;
      if (lastInv && lastInv.invoiceNumber.startsWith('INV-')) {
        const lastNum = parseInt(lastInv.invoiceNumber.replace('INV-', ''), 10);
        if (!isNaN(lastNum)) {
          nextInvNum = lastNum + 1;
        }
      }
      const invoiceNumber = `INV-${nextInvNum}`;

      // Create draft invoice
      await tx.clinicInvoice.create({
        data: {
          invoiceNumber,
          visitId: newVisit.id,
          subtotal,
          total: subtotal,
          balanceDue: subtotal,
          status: 'draft',
        },
      });

      return newVisit;
    });

    const departmentCodes = new Set(services.map((service: any) => service.department?.code).filter(Boolean));
    const patient = await this.prisma.patient.findUnique({
      where: { id: data.patientId },
      select: { surname: true, firstName: true, patientCode: true },
    });
    const patientLabel = patient ? `${patient.surname}, ${patient.firstName}` : 'A patient';

    if (departmentCodes.has('LAB')) {
      await this.notificationsService.create({
        title: 'New lab request',
        message: `${patientLabel} has been sent to the laboratory queue.`,
        type: 'info',
        module: 'laboratory',
        targetRole: 2,
        entityType: 'visit',
        entityId: visit.id,
        route: '/laboratory/queue',
      });
    }

    if (departmentCodes.has('SCAN')) {
      await this.notificationsService.create({
        title: 'New scan request',
        message: `${patientLabel} has been sent to the scanning queue.`,
        type: 'info',
        module: 'scanning',
        targetRole: 3,
        entityType: 'visit',
        entityId: visit.id,
        route: '/scanning/queue',
      });
    }

    return this.findVisitById(visit.id);
  }

  // --- Department Actions ---
  async addExtraService(visitId: string, data: any, actorRole: number) {
    if (!data.serviceId) {
      throw new BadRequestException('serviceId is required');
    }
    const quantity = Number(data.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new BadRequestException('Service quantity must be a whole number between 1 and 100');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { visitServices: true, invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    this.assertInvoiceMutable(visit.invoice, 'add services');

    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { department: true },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found');
    }
    this.assertDepartmentAccess(actorRole, service.department);

    const line = await this.prisma.$transaction(async (tx) => {
      const approvedByPatient = data.approvedByPatient === true;
      // Create visit service line
      const line = await tx.visitService.create({
        data: {
          visitId,
          serviceId: service.id,
          source: 'department_added',
          unitPrice: service.price,
          quantity,
          lineTotal: Number(service.price) * quantity,
          status: 'pending',
          approvedByPatient,
        },
      });

      // Recalculate and update the invoice only after frontdesk/patient approval
      if (visit.invoice && approvedByPatient) {
        const allVisitServices = await tx.visitService.findMany({
          where: { visitId, status: { not: 'not_done' }, approvedByPatient: true },
        });

        const newSubtotal = allVisitServices.reduce(
          (sum, s) => sum + Number(s.lineTotal),
          0,
        );

        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: {
            subtotal: newSubtotal,
            total: newSubtotal,
            balanceDue: newSubtotal - Number(visit.invoice.amountPaid),
          },
        });
      }

      // Update visit status to 'in_progress' if registered
      if (visit.status === 'registered' || visit.status === 'sent_to_department') {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'in_progress' },
        });
      }

      return line;
    });

    if (line.approvedByPatient === false) {
      await this.notificationsService.create({
        title: 'Extra procedure needs approval',
        message: 'A department requested an extra procedure for frontdesk billing approval.',
        type: 'warning',
        module: 'frontdesk',
        targetRole: 1,
        entityType: 'visit',
        entityId: visitId,
        route: '/frontdesk/billing-desk',
      });
    }

    return line;
  }

  async approveExtraService(visitId: string, visitServiceId: string, approved: boolean) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    this.assertInvoiceMutable(visit.invoice, 'approve extra services');

    const line = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
      include: { service: true },
    });

    if (!line || line.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }

    if (line.source !== 'department_added') {
      throw new BadRequestException('Only department-added services can be approved here');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedLine = await tx.visitService.update({
        where: { id: visitServiceId },
        data: {
          approvedByPatient: approved,
          status: approved && line.status === 'not_done' ? 'pending' : line.status,
        },
        include: { service: true },
      });

      if (visit.invoice) {
        const allBillableServices = await tx.visitService.findMany({
          where: { visitId, status: { not: 'not_done' }, approvedByPatient: true },
        });
        const newSubtotal = allBillableServices.reduce(
          (sum, s) => sum + Number(s.lineTotal),
          0,
        );

        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: {
            subtotal: newSubtotal,
            total: newSubtotal,
            balanceDue: newSubtotal - Number(visit.invoice.amountPaid),
            status: newSubtotal - Number(visit.invoice.amountPaid) > 0 ? 'draft' : visit.invoice.status,
          },
        });
      }

      return updatedLine;
    });
  }

  async requestServicePriceAdjustment(visitId: string, visitServiceId: string, data: any, userId: string, actorRole: number) {
    const requestedLineTotal = Number(data.requestedLineTotal ?? data.totalAmount ?? data.lineTotal);
    if (!Number.isFinite(requestedLineTotal) || requestedLineTotal <= 0) {
      throw new BadRequestException('A valid adjusted total amount is required');
    }

    const line = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
      include: { visit: { include: { invoice: true } }, service: { include: { department: true } } },
    });

    if (!line || line.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }
    this.assertDepartmentAccess(actorRole, line.service.department);

    if (line.status === 'not_done') {
      throw new BadRequestException('Cannot adjust the price of a service marked as not done');
    }
    this.assertInvoiceMutable(line.visit.invoice, 'request a price adjustment');

    const currentLineTotal = Number(line.lineTotal);
    if (requestedLineTotal <= currentLineTotal + 0.000001) {
      throw new BadRequestException('A complexity adjustment must increase the current service charge');
    }

    if (line.priceAdjustmentStatus === 'pending') {
      throw new BadRequestException('This service already has a pending price adjustment');
    }

    const reason = String(data.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Reason for price adjustment is required');
    }

    const updatedLine = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.visitService.updateMany({
        where: {
          id: visitServiceId,
          visitId,
          priceAdjustmentStatus: { not: 'pending' },
          lineTotal: line.lineTotal,
        },
        data: {
          requestedLineTotal,
          priceAdjustmentReason: reason,
          priceAdjustmentStatus: 'pending',
          priceAdjustedAt: getInternetDate(),
          priceAdjustedByUserId: userId,
          priceApprovedAt: null,
          priceApprovedByUserId: null,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('The service charge changed. Refresh and try again.');
      }
      const updated = await tx.visitService.findUniqueOrThrow({
        where: { id: visitServiceId },
        include: { service: { include: { department: true } } },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'request_price_adjustment',
          entityType: 'visit_service',
          entityId: visitServiceId,
          beforeData: JSON.stringify({ lineTotal: currentLineTotal }),
          afterData: JSON.stringify({ requestedLineTotal, reason, visitId }),
          actorUserId: userId,
        },
      });
      return updated;
    });

    await this.notificationsService.create({
      title: 'Price adjustment requested',
      message: `${updatedLine.service?.name ?? 'A service'} was adjusted from GHS ${Number(line.lineTotal).toFixed(2)} to GHS ${requestedLineTotal.toFixed(2)}.`,
      type: 'warning',
      module: 'frontdesk',
      targetRole: 1,
      entityType: 'visit',
      entityId: visitId,
      route: '/frontdesk/billing-desk',
    });

    return updatedLine;
  }

  async approveServicePriceAdjustment(visitId: string, visitServiceId: string, approved: boolean, userId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const line = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
      include: { service: true },
    });

    if (!line || line.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }

    if (line.priceAdjustmentStatus !== 'pending' || line.requestedLineTotal === null) {
      throw new BadRequestException('No pending price adjustment exists for this service');
    }
    this.assertInvoiceMutable(visit.invoice, 'approve a price adjustment');
    if (line.priceAdjustedByUserId === userId) {
      throw new BadRequestException('The requester cannot approve their own price adjustment');
    }

    return this.prisma.$transaction(async (tx) => {
      const requestedLineTotal = Number(line.requestedLineTotal);
      const claim = await tx.visitService.updateMany({
        where: {
          id: visitServiceId,
          visitId,
          priceAdjustmentStatus: 'pending',
          requestedLineTotal: line.requestedLineTotal,
          priceAdjustedByUserId: { not: userId },
        },
        data: approved
          ? {
              lineTotal: requestedLineTotal,
              priceAdjustmentStatus: 'approved',
              priceApprovedAt: getInternetDate(),
              priceApprovedByUserId: userId,
            }
          : {
              priceAdjustmentStatus: 'rejected',
              priceApprovedAt: getInternetDate(),
              priceApprovedByUserId: userId,
            },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('This adjustment was already handled or changed. Refresh and try again.');
      }
      const updatedLine = await tx.visitService.findUniqueOrThrow({
        where: { id: visitServiceId },
        include: { service: { include: { department: true } } },
      });

      if (approved && visit.invoice) {
        const allBillableServices = await tx.visitService.findMany({
          where: { visitId, status: { not: 'not_done' }, approvedByPatient: true },
        });
        const newSubtotal = allBillableServices.reduce(
          (sum, serviceLine) => sum + Number(serviceLine.lineTotal),
          0,
        );
        const newBalanceDue = newSubtotal - Number(visit.invoice.amountPaid);

        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: {
            subtotal: newSubtotal,
            total: newSubtotal,
            balanceDue: newBalanceDue,
            status: newBalanceDue > 0 ? 'draft' : visit.invoice.status,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actionType: approved ? 'approve_price_adjustment' : 'reject_price_adjustment',
          entityType: 'visit_service',
          entityId: visitServiceId,
          beforeData: JSON.stringify({ lineTotal: Number(line.lineTotal), requestedLineTotal }),
          afterData: JSON.stringify({ approved, lineTotal: Number(updatedLine.lineTotal), visitId }),
          actorUserId: userId,
        },
      });

      return updatedLine;
    });
  }

  async removeExtraService(visitId: string, visitServiceId: string, actorRole: number) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { visitServices: { include: { service: { include: { department: true } } } }, invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    this.assertInvoiceMutable(visit.invoice, 'remove services');

    const line = visit.visitServices.find((s) => s.id === visitServiceId);
    if (!line) {
      throw new NotFoundException('Visit service line not found');
    }
    this.assertDepartmentAccess(actorRole, line.service.department);
    if (line.source !== 'department_added') {
      throw new BadRequestException('Only department-added services can be removed');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete visit service line
      await tx.visitService.delete({
        where: { id: visitServiceId },
      });

      // Recalculate and update the draft invoice
      if (visit.invoice) {
        const allRemainingServices = await tx.visitService.findMany({
          where: { visitId, id: { not: visitServiceId }, status: { not: 'not_done' }, approvedByPatient: true },
        });

        const newSubtotal = allRemainingServices.reduce(
          (sum, s) => sum + Number(s.lineTotal),
          0,
        );

        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: {
            subtotal: newSubtotal,
            total: newSubtotal,
            balanceDue: newSubtotal - Number(visit.invoice.amountPaid),
          },
        });
      }

      return { success: true };
    });
  }

  async updateServiceStatus(visitId: string, visitServiceId: string, data: any, actorRole: number) {
    if (!data.status || !['pending', 'in_progress', 'done', 'not_done'].includes(data.status)) {
      throw new BadRequestException('Valid status is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    this.assertInvoiceMutable(visit.invoice, 'change clinical service status');

    const visitSvc = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
      include: { service: { include: { department: true } } },
    });

    if (!visitSvc || visitSvc.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }
    this.assertDepartmentAccess(actorRole, visitSvc.service.department);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSvc = await tx.visitService.update({
        where: { id: visitServiceId },
        data: {
          status: data.status,
          notDoneReason: data.status === 'not_done' ? (data.notDoneReason ?? 'Medical override') : null,
        },
      });

      // Recalculate invoice if service status changed to not_done or from not_done
      if (visit.invoice) {
        const allBillableServices = await tx.visitService.findMany({
          where: { visitId, status: { not: 'not_done' }, approvedByPatient: true },
        });

        const newSubtotal = allBillableServices.reduce(
          (sum, s) => sum + Number(s.lineTotal),
          0,
        );

        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: {
            subtotal: newSubtotal,
            total: newSubtotal,
            balanceDue: newSubtotal - Number(visit.invoice.amountPaid),
          },
        });
      }

      // Automatically update visit status if all services are now done/not_done
      const allServices = await tx.visitService.findMany({
        where: { visitId },
      });

      const finished = allServices.every((s) => s.status === 'done' || s.status === 'not_done');
      if (finished) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'completed' }, // clinical part completed, awaiting payment next
        });
      } else {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'in_progress' },
        });
      }

      return { updatedSvc, finished };
    });

    if (result.finished) {
      const completedVisit = await this.prisma.visit.findUnique({
        where: { id: visitId },
        include: { patient: true },
      });
      const patientLabel = completedVisit?.patient
        ? `${completedVisit.patient.surname}, ${completedVisit.patient.firstName}`
        : 'A patient';
      await this.notificationsService.create({
        title: 'Clinical work completed',
        message: `${patientLabel} is ready for billing review.`,
        type: 'success',
        module: 'frontdesk',
        targetRole: 1,
        entityType: 'visit',
        entityId: visitId,
        route: '/frontdesk/billing-desk',
      });
    }

    return result.updatedSvc;
  }

  // --- Save Results ---
  async saveVisitResult(visitId: string, data: any, userId: string, actorRole: number) {
    // Determine if batch save or single save
    const services = Array.isArray(data.services) ? data.services : null;

    if (!services && (!data.visitServiceId || !data.resultDataJson)) {
      throw new BadRequestException('visitServiceId and resultDataJson are required');
    }

    return this.prisma.$transaction(async (tx) => {
      let lastResult: any = null;

      if (services) {
        // Process Batch Services
        for (const item of services) {
          const visitService = await tx.visitService.findUnique({
            where: { id: item.visitServiceId },
            include: { service: { include: { department: true } } },
          });

          if (!visitService || visitService.visitId !== visitId) {
            throw new NotFoundException('A service line was not found for this visit');
          }
          this.assertDepartmentAccess(actorRole, visitService.service.department);

          if (item.status === 'not_done') {
            // Update cancellation status
            await tx.visitService.update({
              where: { id: item.visitServiceId },
              data: {
                status: 'not_done',
                notDoneReason: item.notDoneReason ?? 'Medical override',
              },
            });
          } else {
            // Observed Result Done
            // Lookup template dynamically if not provided
            let templateId = item.templateId;
            if (templateId) {
              const template = await tx.serviceResultTemplate.findFirst({ where: { id: String(templateId), serviceId: visitService.serviceId } });
              if (!template) throw new BadRequestException('The selected result template does not belong to this service');
            }
            if (!templateId) {
              const template = await tx.serviceResultTemplate.findFirst({
                where: { serviceId: visitService.serviceId },
              });
              if (template) {
                templateId = template.id;
              } else {
                // Auto-create a default result template to preserve relational constraints
                const newTemp = await tx.serviceResultTemplate.create({
                  data: {
                    serviceId: visitService.serviceId,
                    templateName: 'Default Template',
                    layoutJson: JSON.stringify({ fields: [] }),
                    isActive: true,
                  },
                });
                templateId = newTemp.id;
              }
            }

            const existing = await tx.visitResult.findFirst({
              where: { visitServiceId: item.visitServiceId },
            });

            const resultDataJson = typeof item.resultDataJson === 'string'
              ? item.resultDataJson
              : JSON.stringify(item.resultDataJson || {});

            if (existing) {
              lastResult = await tx.visitResult.update({
                where: { id: existing.id },
                data: {
                  resultDataJson,
                  narrativeNotes: item.narrativeNotes ?? null,
                  enteredByUserId: userId,
                },
              });
            } else {
              lastResult = await tx.visitResult.create({
                data: {
                  visitServiceId: item.visitServiceId,
                  templateId,
                  resultDataJson,
                  narrativeNotes: item.narrativeNotes ?? null,
                  enteredByUserId: userId,
                },
              });
            }

            await tx.visitService.update({
              where: { id: item.visitServiceId },
              data: { status: 'done' },
            });
          }
        }
      } else {
        // Process Single Service Result
        const visitService = await tx.visitService.findUnique({
          where: { id: data.visitServiceId },
          include: { service: { include: { department: true } } },
        });

        if (!visitService || visitService.visitId !== visitId) {
          throw new NotFoundException('Service line not found for this visit');
        }
        this.assertDepartmentAccess(actorRole, visitService.service.department);

        let templateId = data.templateId;
        if (templateId) {
          const template = await tx.serviceResultTemplate.findFirst({ where: { id: String(templateId), serviceId: visitService.serviceId } });
          if (!template) throw new BadRequestException('The selected result template does not belong to this service');
        }
        if (!templateId) {
          const template = await tx.serviceResultTemplate.findFirst({
            where: { serviceId: visitService.serviceId },
          });
          if (template) {
            templateId = template.id;
          } else {
            const newTemp = await tx.serviceResultTemplate.create({
              data: {
                serviceId: visitService.serviceId,
                templateName: 'Default Template',
                layoutJson: JSON.stringify({ fields: [] }),
                isActive: true,
              },
            });
            templateId = newTemp.id;
          }
        }

        const existing = await tx.visitResult.findFirst({
          where: { visitServiceId: data.visitServiceId },
        });

        const resultDataJson = typeof data.resultDataJson === 'string'
          ? data.resultDataJson
          : JSON.stringify(data.resultDataJson);

        if (existing) {
          lastResult = await tx.visitResult.update({
            where: { id: existing.id },
            data: {
              resultDataJson,
              narrativeNotes: data.narrativeNotes ?? null,
              enteredByUserId: userId,
            },
          });
        } else {
          lastResult = await tx.visitResult.create({
            data: {
              visitServiceId: data.visitServiceId,
              templateId,
              resultDataJson,
              narrativeNotes: data.narrativeNotes ?? null,
              enteredByUserId: userId,
            },
          });
        }

        await tx.visitService.update({
          where: { id: data.visitServiceId },
          data: { status: 'done' },
        });
      }

      // Update visit status if all completed
      const allServices = await tx.visitService.findMany({
        where: { visitId },
      });

      const finished = allServices.every((s) => s.status === 'done' || s.status === 'not_done');
      if (finished) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'completed' },
        });
      } else {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'in_progress' },
        });
      }

      return lastResult;
    });
  }

  // --- Prescriptions ---
  async savePrescription(visitId: string, data: any, userId: string, actorRole: number) {
    if (!data.prescriptionText) {
      throw new BadRequestException('prescriptionText is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true, visitServices: { include: { service: { include: { department: true } } } } },
    });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    const departmentCode = this.departmentCodeForRole(actorRole);
    if (departmentCode && !visit.visitServices.some((line) => line.service.department?.code?.toUpperCase() === departmentCode)) {
      throw new ForbiddenException('This visit is not assigned to your department');
    }

    return this.prisma.prescription.create({
      data: {
        visitId,
        prescriptionText: data.prescriptionText,
        createdByUserId: userId,
        status: 'active',
      },
    });
  }

  async deleteVisit(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({
        where: { id },
        include: {
          patient: true,
          visitServices: { include: { results: { select: { id: true } } } },
          prescriptions: { select: { id: true } },
          invoice: {
            include: { payments: true }
          }
        },
      });

      if (!visit) {
        throw new NotFoundException('Visit not found');
      }

      if (visit.status === 'deleted') {
        throw new BadRequestException('Visit is already deleted');
      }

      if (!['registered', 'sent_to_department'].includes(visit.status)) {
        throw new BadRequestException('Only an untouched registration can be deleted');
      }

      const hasClinicalWork = visit.visitServices.some(
        (line) => line.status !== 'pending' || line.results.length > 0,
      ) || visit.prescriptions.length > 0;
      if (hasClinicalWork) {
        throw new BadRequestException('This visit has clinical work and must remain in the patient record');
      }

      if (visit.invoice && (
        Number(visit.invoice.amountPaid) > 0.000001 ||
        visit.invoice.payments.length > 0
      )) {
        throw new BadRequestException('A visit with payment history cannot be deleted. Use an approved financial reversal instead.');
      }

      const deletion = await tx.visit.updateMany({
        where: { id, status: visit.status },
        data: { status: 'deleted' },
      });
      if (deletion.count !== 1) {
        throw new BadRequestException('The visit changed. Refresh and try again.');
      }

      if (visit.invoice) {
        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: { status: 'voided' },
        });
      }

      await tx.auditLog.create({
        data: {
          actionType: 'delete_visit',
          entityType: 'visit',
          entityId: id,
          beforeData: JSON.stringify({
            patientName: `${visit.patient.surname}, ${visit.patient.firstName}`,
            visitNumber: visit.visitNumber,
            date: visit.createdAt,
          }),
          actorUserId: userId,
          tenantId: visit.tenantId,
        },
      });

      return { success: true };
    });
  }

  private departmentCodeForRole(role: number): 'LAB' | 'SCAN' | null {
    if (role === 2) return 'LAB';
    if (role === 3) return 'SCAN';
    return null;
  }

  private assertDepartmentAccess(role: number, department: { code?: string | null } | null | undefined): void {
    const requiredCode = this.departmentCodeForRole(role);
    if (requiredCode && department?.code?.toUpperCase() !== requiredCode) {
      throw new ForbiddenException('This clinical service belongs to another department');
    }
  }

  private assertInvoiceMutable(invoice: any, action: string): void {
    if (!invoice) return;
    const amountPaid = Number(invoice.amountPaid ?? 0);
    if (amountPaid > 0.000001 || ['partially_paid', 'paid', 'voided'].includes(String(invoice.status))) {
      throw new BadRequestException(`Cannot ${action} after a payment has been posted`);
    }
  }
}
