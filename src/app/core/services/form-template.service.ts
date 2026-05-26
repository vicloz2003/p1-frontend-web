import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FormSchema } from '../../features/designer/models/form-schema.models';
import { environment } from '../../../environments/environment';

export interface FormTemplateResponse {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  formSchema: FormSchema;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormTemplateRequest {
  name: string;
  description?: string;
  formSchema: FormSchema;
}

export interface UpdateFormTemplateRequest {
  name: string;
  description?: string;
  formSchema: FormSchema;
}

@Injectable({ providedIn: 'root' })
export class FormTemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/form-templates`;

  getAll(): Observable<FormTemplateResponse[]> {
    return this.http.get<FormTemplateResponse[]>(this.baseUrl);
  }

  getById(id: string): Observable<FormTemplateResponse> {
    return this.http.get<FormTemplateResponse>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateFormTemplateRequest): Observable<FormTemplateResponse> {
    return this.http.post<FormTemplateResponse>(this.baseUrl, data);
  }

  update(id: string, data: UpdateFormTemplateRequest): Observable<FormTemplateResponse> {
    return this.http.put<FormTemplateResponse>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
