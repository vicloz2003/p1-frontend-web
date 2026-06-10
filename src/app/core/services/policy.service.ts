import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePolicyRequest, DocumentRequirementRequest, UpdatePolicyRequest } from '../models/requests';
import { PolicyResponse } from '../models/responses';
import { DocumentRequirement } from '../models/domain';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/policies`;

  createPolicy(data: CreatePolicyRequest): Observable<PolicyResponse> {
    return this.http.post<PolicyResponse>(this.baseUrl, data);
  }

  updatePolicy(id: string, data: UpdatePolicyRequest): Observable<PolicyResponse> {
    return this.http.put<PolicyResponse>(`${this.baseUrl}/${id}`, data);
  }

  getById(id: string): Observable<PolicyResponse> {
    return this.http.get<PolicyResponse>(`${this.baseUrl}/${id}`);
  }

  deletePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  addDocumentRequirement(policyId: string, req: DocumentRequirementRequest): Observable<DocumentRequirement> {
    return this.http.post<DocumentRequirement>(`${this.baseUrl}/${policyId}/document-requirements`, req);
  }

  updateDocumentRequirement(policyId: string, reqId: string, req: DocumentRequirementRequest): Observable<DocumentRequirement> {
    return this.http.put<DocumentRequirement>(`${this.baseUrl}/${policyId}/document-requirements/${reqId}`, req);
  }

  removeDocumentRequirement(policyId: string, reqId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${policyId}/document-requirements/${reqId}`);
  }
}