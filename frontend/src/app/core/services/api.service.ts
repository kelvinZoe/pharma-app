import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
  }
  return '/api';
};
const API_URL = getApiUrl();

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);

  // --- Users & Roles ---
  getUsers(page?: number, limit?: number, search?: string): Observable<any> {
    let url = `${API_URL}/users`;
    const params = [];
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (search !== undefined) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    return new Observable<any>(observer => {
      this.http.get<any>(url).subscribe({
        next: (res) => {
          const mapUser = (u: any) => ({
            ...u,
            name: u.fullName ?? u.name,
            active: u.isActive !== undefined ? u.isActive : (u.active !== undefined ? u.active : true)
          });

          if (res && Array.isArray(res)) {
            observer.next(res.map(mapUser));
          } else if (res && res.data && Array.isArray(res.data)) {
            observer.next({
              ...res,
              data: res.data.map(mapUser)
            });
          } else {
            observer.next(res);
          }
          observer.complete();
        },
        error: (err) => {
          observer.error(err);
        }
      });
    });
  }

  createUser(data: any): Observable<any> {
    const payload = {
      fullName: data.name,
      email: data.email,
      username: data.username,
      password: data.password,
      role: data.role,
      isActive: data.active !== undefined ? data.active : true,
      module: data.role === 0 ? 'admin' : 
              data.role === 1 ? 'frontdesk' : 
              data.role === 2 ? 'laboratory' : 
              data.role === 3 ? 'scanning' : 
              data.role === 4 ? 'pharmacy' : 'accounting'
    };
    return this.http.post<any>(`${API_URL}/users`, payload);
  }

  updateUser(id: string, data: any): Observable<any> {
    const payload: any = {};
    if (data.name !== undefined) payload.fullName = data.name;
    if (data.email !== undefined) payload.email = data.email;
    if (data.username !== undefined) payload.username = data.username;
    if (data.password !== undefined && data.password !== '') payload.password = data.password;
    if (data.role !== undefined) {
      payload.role = data.role;
      payload.module = data.role === 0 ? 'admin' : 
                       data.role === 1 ? 'frontdesk' : 
                       data.role === 2 ? 'laboratory' : 
                       data.role === 3 ? 'scanning' : 
                       data.role === 4 ? 'pharmacy' : 'accounting';
    }
    if (data.active !== undefined) payload.isActive = data.active;
    return this.http.put<any>(`${API_URL}/users/${id}`, payload);
  }

  // --- Departments & Services ---
  getDepartments(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/departments`);
  }

  getServices(page?: number, limit?: number, search?: string): Observable<any> {
    let url = `${API_URL}/services`;
    const params = [];
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (search !== undefined) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  createService(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/services`, data);
  }

  updateService(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/services/${id}`, data);
  }

  deleteService(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/services/${id}`);
  }

  getServiceTemplate(serviceId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/services/${serviceId}/template`);
  }

  saveServiceTemplate(serviceId: string, data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/services/${serviceId}/template`, data);
  }

  // --- Patients ---
  searchPatients(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/patients/search?query=${encodeURIComponent(query)}`);
  }

  createPatient(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/patients`, data);
  }

  updatePatient(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/patients/${id}`, data);
  }

  getPatientHistory(patientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/patients/${patientId}/history`);
  }

  // --- Visits ---
  getActiveVisits(department?: string, all?: boolean): Observable<any[]> {
    const params = [];
    if (department) params.push(`department=${department}`);
    if (all) params.push(`all=true`);
    const url = params.length > 0 ? `${API_URL}/visits/active?${params.join('&')}` : `${API_URL}/visits/active`;
    return this.http.get<any[]>(url);
  }


  getVisit(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/visits/${id}`);
  }

  createVisit(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits`, data);
  }

  // --- Department Actions ---
  addExtraService(visitId: string, serviceId: string, quantity = 1): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits/${visitId}/services`, {
      serviceId,
      quantity,
      approvedByPatient: true
    });
  }

  removeExtraService(visitId: string, visitServiceId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/visits/${visitId}/services/${visitServiceId}`);
  }

  updateVisitServiceStatus(visitId: string, visitServiceId: string, status: string, notDoneReason?: string): Observable<any> {
    return this.http.put<any>(`${API_URL}/visits/${visitId}/services/${visitServiceId}/status`, {
      status,
      notDoneReason
    });
  }

  saveVisitResult(visitId: string, data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits/${visitId}/results`, data);
  }

  savePrescription(visitId: string, prescriptionText: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits/${visitId}/prescriptions`, {
      prescriptionText
    });
  }

  // --- Billing ---
  getInvoice(visitId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/visits/${visitId}/invoice`);
  }

  payInvoice(visitId: string, data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits/${visitId}/invoice/pay`, data);
  }

  // --- Pharmacy ---
  getPharmacyProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/products`);
  }

  createPharmacyProduct(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/products`, data);
  }

  addPharmacyBatch(productId: string, data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/products/${productId}/batches`, data);
  }

  getPharmacyPrescriptions(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/prescriptions/active`);
  }

  processPharmacySale(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/sales`, data);
  }

  // --- Reports ---
  getClinicStream(startDate?: string, endDate?: string, page?: number, limit?: number): Observable<any> {
    let url = `${API_URL}/reports/clinic`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  getPharmacyStream(startDate?: string, endDate?: string, page?: number, limit?: number): Observable<any> {
    let url = `${API_URL}/reports/pharmacy`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  getCombinedSummary(startDate?: string, endDate?: string): Observable<any> {
    let url = `${API_URL}/reports/summary`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  getDashboardAnalytics(module?: string): Observable<any> {
    const url = module ? `${API_URL}/reports/dashboard?module=${module}` : `${API_URL}/reports/dashboard`;
    return this.http.get<any>(url);
  }



  // --- Pharmacy Daily Closures ---
  getPharmacyUnclosedSales(): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/sales/unclosed`);
  }

  closePharmacySales(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/sales/close`, data);
  }

  getPharmacyClosures(startDate?: string, endDate?: string): Observable<any[]> {
    let url = `${API_URL}/pharmacy/closures`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any[]>(url);
  }

  getPharmacyClosure(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/closures/${id}`);
  }

  // --- Clinic/Pharmacy Settings ---
  getSettings(): Observable<any> {
    return this.http.get<any>(`${API_URL}/settings`);
  }

  updateSettings(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/settings`, data);
  }

  // --- General Templates ---
  getGeneralTemplates(departmentCode?: string): Observable<any[]> {
    let url = `${API_URL}/general-templates`;
    if (departmentCode) {
      url += `?department=${departmentCode}`;
    }
    return this.http.get<any[]>(url);
  }

  getGeneralTemplate(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/general-templates/${id}`);
  }

  createGeneralTemplate(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/general-templates`, data);
  }

  updateGeneralTemplate(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/general-templates/${id}`, data);
  }

  deleteGeneralTemplate(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/general-templates/${id}`);
  }

  // --- Expenses ---
  getExpenses(startDate?: string, endDate?: string, page?: number, limit?: number): Observable<any> {
    let url = `${API_URL}/expenses`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  createExpense(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/expenses`, data);
  }

  deleteExpense(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/expenses/${id}`);
  }

  // --- Financial Integrity / Voids ---
  voidClinicPayment(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/reports/clinic/${id}/void`, { reason });
  }

  voidPharmacySale(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/reports/pharmacy/${id}/void`, { reason });
  }

  // --- Register Sessions ---
  getActiveSession(): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/sessions/active`);
  }

  openSession(openingFloat: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/sessions/open`, { openingFloat });
  }
}

