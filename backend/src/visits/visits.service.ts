import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

    return this.prisma.visit.findMany({
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
    });
  }

  async findVisitById(id: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
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
    return visit;
  }

  async createVisit(data: any, userId: string) {
    if (!data.patientId || !data.serviceIds || !Array.isArray(data.serviceIds) || data.serviceIds.length === 0) {
      throw new BadRequestException('patientId and at least one serviceId are required');
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
      where: { id: { in: data.serviceIds } },
      include: { department: true },
    });

    if (services.length !== data.serviceIds.length) {
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
      for (const svcId of data.serviceIds) {
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
  async addExtraService(visitId: string, data: any) {
    if (!data.serviceId) {
      throw new BadRequestException('serviceId is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { visitServices: true, invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const line = await this.prisma.$transaction(async (tx) => {
      const approvedByPatient = data.approvedByPatient === true;
      // Create visit service line
      const line = await tx.visitService.create({
        data: {
          visitId,
          serviceId: service.id,
          source: 'department_added',
          unitPrice: service.price,
          quantity: data.quantity ? Number(data.quantity) : 1,
          lineTotal: Number(service.price) * (data.quantity ? Number(data.quantity) : 1),
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

  async requestServicePriceAdjustment(visitId: string, visitServiceId: string, data: any, userId: string) {
    const requestedLineTotal = Number(data.requestedLineTotal ?? data.totalAmount ?? data.lineTotal);
    if (!Number.isFinite(requestedLineTotal) || requestedLineTotal <= 0) {
      throw new BadRequestException('A valid adjusted total amount is required');
    }

    const line = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
      include: { visit: true, service: true },
    });

    if (!line || line.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }

    if (line.status === 'not_done') {
      throw new BadRequestException('Cannot adjust the price of a service marked as not done');
    }

    const reason = String(data.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Reason for price adjustment is required');
    }

    const updatedLine = await this.prisma.visitService.update({
      where: { id: visitServiceId },
      data: {
        requestedLineTotal,
        priceAdjustmentReason: reason || null,
        priceAdjustmentStatus: 'pending',
        priceAdjustedAt: new Date(),
        priceAdjustedByUserId: userId,
      },
      include: { service: { include: { department: true } } },
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

    return this.prisma.$transaction(async (tx) => {
      const requestedLineTotal = Number(line.requestedLineTotal);
      const updatedLine = await tx.visitService.update({
        where: { id: visitServiceId },
        data: approved
          ? {
              lineTotal: requestedLineTotal,
              priceAdjustmentStatus: 'approved',
              priceApprovedAt: new Date(),
              priceApprovedByUserId: userId,
            }
          : {
              priceAdjustmentStatus: 'rejected',
              priceApprovedAt: new Date(),
              priceApprovedByUserId: userId,
            },
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

      return updatedLine;
    });
  }

  async removeExtraService(visitId: string, visitServiceId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { visitServices: true, invoice: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const line = visit.visitServices.find((s) => s.id === visitServiceId);
    if (!line) {
      throw new NotFoundException('Visit service line not found');
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

  async updateServiceStatus(visitId: string, visitServiceId: string, data: any) {
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

    const visitSvc = await this.prisma.visitService.findUnique({
      where: { id: visitServiceId },
    });

    if (!visitSvc || visitSvc.visitId !== visitId) {
      throw new NotFoundException('Visit service line not found');
    }

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
  async saveVisitResult(visitId: string, data: any, userId: string) {
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
          });

          if (!visitService || visitService.visitId !== visitId) {
            continue;
          }

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
        });

        if (!visitService || visitService.visitId !== visitId) {
          throw new NotFoundException('Service line not found for this visit');
        }

        let templateId = data.templateId;
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
  async savePrescription(visitId: string, data: any, userId: string) {
    if (!data.prescriptionText) {
      throw new BadRequestException('prescriptionText is required');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true },
    });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    // Create prescription linked to visit
    const prescription = await this.prisma.prescription.create({
      data: {
        visitId,
        prescriptionText: data.prescriptionText,
        createdByUserId: userId,
        status: 'active',
      },
    });

    await this.notificationsService.create({
      title: 'New clinic prescription',
      message: `${visit.patient.surname}, ${visit.patient.firstName} has a prescription waiting in pharmacy.`,
      type: 'info',
      module: 'pharmacy',
      targetRole: 4,
      entityType: 'prescription',
      entityId: prescription.id,
      route: '/pharmacy/clinic-prescriptions',
    });

    return prescription;
  }

  async deleteVisit(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({
        where: { id },
        include: {
          patient: true,
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

      // 1. Set Visit status to 'deleted'
      await tx.visit.update({
        where: { id },
        data: { status: 'deleted' },
      });

      // 2. Set the associated ClinicInvoice.status = 'voided' (if exists)
      if (visit.invoice) {
        await tx.clinicInvoice.update({
          where: { id: visit.invoice.id },
          data: { status: 'voided' },
        });

        // 3. Set associated ClinicPayment.status = 'voided'
        if (visit.invoice.payments && visit.invoice.payments.length > 0) {
          for (const payment of visit.invoice.payments) {
            if (payment.status !== 'voided') {
              await tx.clinicPayment.update({
                where: { id: payment.id },
                data: {
                  status: 'voided',
                  voidReason: 'Registration deleted by Frontdesk',
                  voidedByUserId: userId,
                  voidedAt: getInternetDate(),
                },
              });
            }
          }
        }
      }

      // 4. Create AuditLog entry
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
}
