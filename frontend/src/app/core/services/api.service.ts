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
    const primaryRole = Array.isArray(data.roles) && data.roles.length > 0
      ? Number(data.roles[0])
      : Number(data.role);
    const payload = {
      fullName: data.name,
      email: data.email,
      password: data.password,
      role: primaryRole,
      roles: Array.isArray(data.roles) ? data.roles.map(Number) : [primaryRole],
      isActive: data.active !== undefined ? data.active : true,
      module: primaryRole === 0 ? 'admin' :
              primaryRole === 1 ? 'frontdesk' :
              primaryRole === 2 ? 'laboratory' :
              primaryRole === 3 ? 'scanning' :
              primaryRole === 4 ? 'pharmacy' : 'accounting'
    };
    return this.http.post<any>(`${API_URL}/users`, payload);
  }

  updateUser(id: string, data: any): Observable<any> {
    const payload: any = {};
    if (data.name !== undefined) payload.fullName = data.name;
    if (data.email !== undefined) payload.email = data.email;
    if (data.username !== undefined) payload.username = data.username;
    if (data.password !== undefined && data.password !== '') payload.password = data.password;
    const primaryRole = Array.isArray(data.roles) && data.roles.length > 0
      ? Number(data.roles[0])
      : Number(data.role);
    if (data.role !== undefined || Array.isArray(data.roles)) {
      payload.role = primaryRole;
      payload.roles = Array.isArray(data.roles) ? data.roles.map(Number) : [primaryRole];
      payload.module = primaryRole === 0 ? 'admin' :
                       primaryRole === 1 ? 'frontdesk' :
                       primaryRole === 2 ? 'laboratory' :
                       primaryRole === 3 ? 'scanning' :
                       primaryRole === 4 ? 'pharmacy' : 'accounting';
    }
    if (data.active !== undefined) payload.isActive = data.active;
    return this.http.put<any>(`${API_URL}/users/${id}`, payload);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/users/${id}`);
  }

  resendUserInvitation(id: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/users/${id}/resend-invitation`, {});
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
  addExtraService(visitId: string, serviceId: string, quantity = 1, approvedByPatient = true): Observable<any> {
    return this.http.post<any>(`${API_URL}/visits/${visitId}/services`, {
      serviceId,
      quantity,
      approvedByPatient
    });
  }

  approveExtraService(visitId: string, visitServiceId: string, approved = true): Observable<any> {
    return this.http.put<any>(`${API_URL}/visits/${visitId}/services/${visitServiceId}/approval`, {
      approved
    });
  }

  requestServicePriceAdjustment(visitId: string, visitServiceId: string, requestedLineTotal: number, reason?: string): Observable<any> {
    return this.http.put<any>(`${API_URL}/visits/${visitId}/services/${visitServiceId}/price-adjustment`, {
      requestedLineTotal,
      reason
    });
  }

  approveServicePriceAdjustment(visitId: string, visitServiceId: string, approved = true): Observable<any> {
    return this.http.put<any>(`${API_URL}/visits/${visitId}/services/${visitServiceId}/price-adjustment/approval`, {
      approved
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

  getActiveClinicCashSession(): Observable<any> {
    return this.http.get<any>(`${API_URL}/billing/sessions/active`);
  }

  openClinicCashSession(openingFloat: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/billing/sessions/open`, { openingFloat });
  }

  closeClinicCashSession(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/billing/sessions/close`, data);
  }

  getClinicCashSessions(startDate?: string, endDate?: string): Observable<any[]> {
    let url = `${API_URL}/billing/sessions`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any[]>(url);
  }

  getClinicCashSession(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/billing/sessions/${id}`);
  }

  // --- Pharmacy ---
  getPharmacyLocations(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/locations`);
  }

  getPharmacySuppliers(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/suppliers`);
  }

  getPharmacySupplierDetail(supplierId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/suppliers/${supplierId}`);
  }

  createPharmacySupplier(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/suppliers`, data);
  }

  updatePharmacySupplier(supplierId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${API_URL}/pharmacy/suppliers/${supplierId}`, data);
  }

  getPharmacyPurchaseOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/purchase-orders`);
  }

  getPharmacyPurchaseOrderDetail(orderId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/purchase-orders/${orderId}`);
  }

  createPharmacyPurchaseOrder(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/purchase-orders`, data);
  }

  updatePharmacyPurchaseOrder(orderId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${API_URL}/pharmacy/purchase-orders/${orderId}`, data);
  }

  submitPharmacyPurchaseOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/purchase-orders/${orderId}/submit`, {});
  }

  approvePharmacyPurchaseOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/purchase-orders/${orderId}/approve`, {});
  }

  cancelPharmacyPurchaseOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/purchase-orders/${orderId}/cancel`, {});
  }

  getPharmacyPayablesSummary(): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/payables/summary`);
  }

  getPharmacySupplierInvoices(status = 'all', supplierId = '', search = ''): Observable<any[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (supplierId) params.set('supplierId', supplierId);
    if (search) params.set('search', search);
    return this.http.get<any[]>(`${API_URL}/pharmacy/supplier-invoices?${params.toString()}`);
  }

  getPharmacySupplierInvoiceDetail(invoiceId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/supplier-invoices/${invoiceId}`);
  }

  updatePharmacySupplierInvoice(invoiceId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${API_URL}/pharmacy/supplier-invoices/${invoiceId}`, data);
  }

  getPharmacySupplierPayments(supplierId = ''): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/supplier-payments${supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''}`);
  }

  recordPharmacySupplierPayment(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/supplier-payments`, data);
  }

  getPharmacyPurchaseReturns(supplierId = ''): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/purchase-returns${supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''}`);
  }

  recordPharmacyPurchaseReturn(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/purchase-returns`, data);
  }

  getPharmacySupplierStatement(supplierId: string, startDate = '', endDate = ''): Observable<any> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return this.http.get<any>(`${API_URL}/pharmacy/supplier-statements/${supplierId}${query ? `?${query}` : ''}`);
  }

  getPharmacyInventoryControlSummary(): Observable<any> { return this.http.get<any>(`${API_URL}/pharmacy/inventory-control/summary`); }
  getPharmacyStockLedger(params: Record<string, string> = {}): Observable<any[]> { const query = new URLSearchParams(params).toString(); return this.http.get<any[]>(`${API_URL}/pharmacy/stock-ledger${query ? `?${query}` : ''}`); }
  getPharmacyStockCounts(): Observable<any[]> { return this.http.get<any[]>(`${API_URL}/pharmacy/stock-counts`); }
  getPharmacyStockCount(id: string): Observable<any> { return this.http.get<any>(`${API_URL}/pharmacy/stock-counts/${id}`); }
  createPharmacyStockCount(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-counts`, data); }
  savePharmacyStockCount(id: string, data: any): Observable<any> { return this.http.patch<any>(`${API_URL}/pharmacy/stock-counts/${id}`, data); }
  submitPharmacyStockCount(id: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-counts/${id}/submit`, {}); }
  approvePharmacyStockCount(id: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-counts/${id}/approve`, {}); }
  getPharmacyStockAdjustments(): Observable<any[]> { return this.http.get<any[]>(`${API_URL}/pharmacy/stock-adjustments`); }
  requestPharmacyStockAdjustment(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-adjustments`, data); }
  approvePharmacyStockAdjustment(id: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-adjustments/${id}/approve`, {}); }
  rejectPharmacyStockAdjustment(id: string, reason: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/stock-adjustments/${id}/reject`, { reason }); }
  getPharmacyTransferSummary(): Observable<any> { return this.http.get<any>(`${API_URL}/pharmacy/transfers/summary`); }
  getPharmacyTransfers(params: Record<string, string> = {}): Observable<any[]> { const query = new URLSearchParams(params).toString(); return this.http.get<any[]>(`${API_URL}/pharmacy/transfers${query ? `?${query}` : ''}`); }
  getPharmacyTransfer(id: string): Observable<any> { return this.http.get<any>(`${API_URL}/pharmacy/transfers/${id}`); }
  createPharmacyTransfer(data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers`, data); }
  submitPharmacyTransfer(id: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/submit`, {}); }
  approvePharmacyTransfer(id: string, data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/approve`, data); }
  rejectPharmacyTransfer(id: string, reason: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/reject`, { reason }); }
  dispatchPharmacyTransfer(id: string, data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/dispatch`, data); }
  receivePharmacyTransfer(id: string, data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/receive`, data); }
  resolvePharmacyTransfer(id: string, data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/resolve`, data); }
  cancelPharmacyTransfer(id: string, reason: string): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/transfers/${id}/cancel`, { reason }); }
  getPharmacyNetworkStock(search = ''): Observable<any> { return this.http.get<any>(`${API_URL}/pharmacy/network-stock${search ? `?search=${encodeURIComponent(search)}` : ''}`); }
  updatePharmacyInventoryPolicy(locationId: string, productId: string, data: any): Observable<any> { return this.http.patch<any>(`${API_URL}/pharmacy/locations/${locationId}/products/${productId}/inventory-policy`, data); }
  getPharmacyQuarantinedStock(): Observable<any[]> { return this.http.get<any[]>(`${API_URL}/pharmacy/quarantine`); }
  resolvePharmacyQuarantine(batchId: string, data: any): Observable<any> { return this.http.post<any>(`${API_URL}/pharmacy/quarantine/${batchId}/resolve`, data); }

  createPharmacyLocation(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/locations`, data);
  }

  getPharmacyLocationUsers(locationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/locations/${locationId}/users`);
  }

  assignPharmacyLocationUser(locationId: string, userId: string, isDefault = false): Observable<any[]> {
    return this.http.post<any[]>(`${API_URL}/pharmacy/locations/${locationId}/users`, { userId, isDefault });
  }

  getPharmacyProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/products`);
  }

  getPharmacyMedicines(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/medicines`);
  }

  createPharmacyMedicine(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/medicines`, data);
  }

  updatePharmacyMedicine(medicineId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${API_URL}/pharmacy/medicines/${medicineId}`, data);
  }

  getPharmacyProductDetail(productId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/products/${productId}`);
  }

  createPharmacyProduct(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/products`, data);
  }

  updatePharmacyProduct(productId: string, data: any): Observable<any> {
    return this.http.patch<any>(`${API_URL}/pharmacy/products/${productId}`, data);
  }

  getPharmacyGoodsReceipts(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/goods-receipts`);
  }

  receivePharmacyStock(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/goods-receipts`, data);
  }

  addPharmacyBatch(productId: string, data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/products/${productId}/batches`, data);
  }

  processPharmacySale(data: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/sales`, data);
  }

  getRecentPharmacySales(limit = 30): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/pharmacy/sales/recent?limit=${limit}`);
  }

  getPharmacySale(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/sales/${id}`);
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

  getPharmacyStream(startDate?: string, endDate?: string, page?: number, limit?: number, locationId?: string): Observable<any> {
    let url = `${API_URL}/reports/pharmacy`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (page !== undefined) params.push(`page=${page}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (locationId) params.push(`locationId=${encodeURIComponent(locationId)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return this.http.get<any>(url);
  }

  getCombinedSummary(startDate?: string, endDate?: string, locationId?: string): Observable<any> {
    let url = `${API_URL}/reports/summary`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (locationId) params.push(`locationId=${encodeURIComponent(locationId)}`);
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

  voidExpense(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/expenses/${id}/void`, { reason });
  }

  // --- Financial Integrity / Voids ---
  voidClinicPayment(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/reports/clinic/${id}/void`, { reason });
  }

  voidPharmacySale(id: string, reason: string, stockDisposition: 'quarantine' | 'sellable' = 'quarantine'): Observable<any> {
    return this.http.post<any>(`${API_URL}/reports/pharmacy/${id}/void`, { reason, stockDisposition });
  }

  // --- In-App Notifications ---
  getNotifications(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/notifications?limit=${limit}`);
  }

  getUnreadNotificationCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${API_URL}/notifications/unread-count`);
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch<any>(`${API_URL}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.patch<any>(`${API_URL}/notifications/read-all`, {});
  }

  // --- Register Sessions ---
  getActiveSession(): Observable<any> {
    return this.http.get<any>(`${API_URL}/pharmacy/sessions/active`);
  }

  openSession(openingFloat: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/pharmacy/sessions/open`, { openingFloat });
  }

  deleteVisit(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/visits/${id}`);
  }

  getAuditLogs(page: number, limit: number): Observable<any> {
    return this.http.get<any>(`${API_URL}/reports/audit-logs?page=${page}&limit=${limit}`);
  }
}
