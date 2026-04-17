import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePolicyRequest } from '../models/requests';
import { PolicyResponse } from '../models/responses';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/v1/policies';

  createPolicy(data: CreatePolicyRequest): Observable<PolicyResponse> {
    return this.http.post<PolicyResponse>(this.baseUrl, data);
  }
}
