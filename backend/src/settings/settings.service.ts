import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';

export interface ClinicSettings {
  clinicName: string;
  tagline: string;
  location: string;
  phone: string;
  email: string;
  tollFree: string;
  labEmail: string;
  accreditationId: string;
  logo?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultSettings: ClinicSettings = {
    clinicName: 'KELVIN CLINICAL DIAGNOSTICS & PHARMACY',
    tagline: 'Pathology, Diagnostic Imaging, & Premium Pharmaceutical Care',
    location: 'Accra, Ghana',
    phone: '+233 (0) 30 220 9999',
    email: 'billing@kelvinpharma.com',
    tollFree: '0800-KELVIN',
    labEmail: 'lab@kelvinpharma.com',
    accreditationId: 'KPL-2026-991A',
  };

  async getSettings(): Promise<ClinicSettings> {
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) {
      return {
        clinicName: '',
        tagline: '',
        location: '',
        phone: '',
        email: '',
        tollFree: '',
        labEmail: '',
        accreditationId: '',
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return {
        clinicName: '',
        tagline: '',
        location: '',
        phone: '',
        email: '',
        tollFree: '',
        labEmail: '',
        accreditationId: '',
      };
    }

    return {
      clinicName: tenant.name,
      tagline: tenant.tagline || '',
      location: tenant.location || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      tollFree: tenant.tollFree || '',
      labEmail: tenant.labEmail || '',
      accreditationId: tenant.accreditationId || '',
      logo: tenant.logo || undefined,
    };
  }

  async saveSettings(settings: Partial<ClinicSettings>): Promise<ClinicSettings> {
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No tenant context');
    }

    const updateData: any = {};
    if (settings.clinicName !== undefined) updateData.name = settings.clinicName;
    if (settings.tagline !== undefined) updateData.tagline = settings.tagline;
    if (settings.location !== undefined) updateData.location = settings.location;
    if (settings.phone !== undefined) updateData.phone = settings.phone;
    if (settings.email !== undefined) updateData.email = settings.email;
    if (settings.tollFree !== undefined) updateData.tollFree = settings.tollFree;
    if (settings.labEmail !== undefined) updateData.labEmail = settings.labEmail;
    if (settings.accreditationId !== undefined) updateData.accreditationId = settings.accreditationId;
    if (settings.logo !== undefined) updateData.logo = settings.logo;

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    return {
      clinicName: tenant.name,
      tagline: tenant.tagline || '',
      location: tenant.location || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      tollFree: tenant.tollFree || '',
      labEmail: tenant.labEmail || '',
      accreditationId: tenant.accreditationId || '',
      logo: tenant.logo || undefined,
    };
  }
}

