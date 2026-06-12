import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuditLogResponse,
  DocumentPermissions,
  DocumentResponse,
  DocumentUploadInitiateResponse,
} from '../models/responses';

export interface PreProcessUploadRequest {
  policyId: string;
  documentRequirementId: string;
  fileName: string;
  mimeType: string;
}

export interface CreateBlankDocumentRequest {
  processInstanceId: string;
  taskId?: string | null;
  nodeId?: string | null;
  fileName: string;
  kind: 'WORD' | 'CELL';
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/documents`;

  initiatePreProcessUpload(req: PreProcessUploadRequest): Observable<DocumentUploadInitiateResponse> {
    return this.http.post<DocumentUploadInitiateResponse>(`${this.API}/pre-process`, req);
  }

  uploadToS3(presignedUrl: string, file: File): Observable<void> {
    return from(
      fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      }).then(res => {
        if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
      })
    );
  }

  confirmUpload(documentId: string): Observable<DocumentResponse> {
    return this.http.post<DocumentResponse>(`${this.API}/${documentId}/confirm`, {});
  }

  listByInstance(processInstanceId: string): Observable<DocumentResponse[]> {
    return this.http.get<DocumentResponse[]>(
      `${environment.apiUrl}/processes/${processInstanceId}/documents`
    );
  }

  download(documentId: string): Observable<{ presignedUrl: string; fileName: string }> {
    return this.http.get<{ presignedUrl: string; fileName: string }>(
      `${this.API}/${documentId}/download`
    );
  }

  /** RF-07: presigned GET URL for a specific historical version of the document. */
  downloadVersion(
    documentId: string,
    versionId: string
  ): Observable<{ presignedUrl: string; fileName: string }> {
    return this.http.get<{ presignedUrl: string; fileName: string }>(
      `${this.API}/${documentId}/versions/${versionId}/download`
    );
  }

  /** RF-08: full audit trail of a document (ADMIN_DESIGNER). */
  getAudit(documentId: string): Observable<AuditLogResponse[]> {
    return this.http.get<AuditLogResponse[]>(`${this.API}/${documentId}/audit`);
  }

  /** RF-1.5 / RF-1.9: reassign the document ACL (ADMIN_DESIGNER). */
  updatePermissions(documentId: string, perms: DocumentPermissions): Observable<DocumentResponse> {
    return this.http.patch<DocumentResponse>(`${this.API}/${documentId}/permissions`, perms);
  }

  /** RF-1.10: functionary creates a blank Office document at their node. */
  createBlank(req: CreateBlankDocumentRequest): Observable<DocumentResponse> {
    return this.http.post<DocumentResponse>(`${this.API}/create-blank`, req);
  }

  /** RF-1.10: documents the caller's department must work now (their inbox). */
  listMyDepartment(): Observable<DocumentResponse[]> {
    return this.http.get<DocumentResponse[]>(`${this.API}/my-department`);
  }

  /** Full pre-process upload pipeline: initiate → PUT to S3 → confirm. Returns confirmed doc ID. */
  uploadPreProcess(policyId: string, requirementId: string, file: File): Observable<string> {
    return this.initiatePreProcessUpload({
      policyId,
      documentRequirementId: requirementId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
    }).pipe(
      switchMap(initRes =>
        this.uploadToS3(initRes.presignedUrl, file).pipe(
          switchMap(() => this.confirmUpload(initRes.documentId)),
          map(confirmed => confirmed.id)
        )
      )
    );
  }
}
