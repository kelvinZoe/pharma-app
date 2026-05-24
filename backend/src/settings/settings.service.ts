import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface ClinicSettings {
  clinicName: string;
  tagline: string;
  location: string;
  phone: string;
  email: string;
  tollFree: string;
  labEmail: string;
  accreditationId: string;
}

@Injectable()
export class SettingsService {
  private readonly filePath = path.join(process.cwd(), 'clinic-settings.json');

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

  getSettings(): ClinicSettings {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(this.defaultSettings, null, 2), 'utf-8');
      } catch (e) {
        console.error('Failed to create default clinic settings file', e);
      }
      return this.defaultSettings;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...this.defaultSettings, ...parsed };
    } catch (e) {
      console.error('Failed to parse clinic settings, returning defaults', e);
      return this.defaultSettings;
    }
  }

  saveSettings(settings: Partial<ClinicSettings>): ClinicSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save clinic settings', e);
    }
    
    return updated;
  }
}
