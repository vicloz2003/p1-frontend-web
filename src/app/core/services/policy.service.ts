import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePolicyRequest,UpdatePolicyRequest } from '../models/requests';
import { PolicyResponse } from '../models/responses';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/v1/policies';

  createPolicy(data: CreatePolicyRequest): Observable<PolicyResponse> {
    return this.http.post<PolicyResponse>(this.baseUrl, data);
  }

  updatePolicy(id: string, data: UpdatePolicyRequest): Observable<PolicyResponse> {
  return this.http.put<PolicyResponse>(`${this.baseUrl}/${id}`, data);
}

getById(id: string): Observable<PolicyResponse> {
  return this.http.get<PolicyResponse>(`${this.baseUrl}/${id}`);
}
}
