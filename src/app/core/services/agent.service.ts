import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AgentDocRequirement {
  id: string;
  name: string;
  description: string | null;
  allowedMimeTypes: string[];
  mandatory: boolean;
  uploadStage: string;
  uploaderRole: string;
}

export interface PolicyMatch {
  policyId: string;
  policyName: string;
  score: number;
}

export interface AgentClassifyResult {
  policyId: string | null;
  policyName: string | null;
  confidence: number;
  confident: boolean;
  alternatives: PolicyMatch[];
  message: string;
  requiredDocuments: AgentDocRequirement[];
}

interface PreProcessInitiateResponse {
  documentId: string;
  s3Key: string;
  presignedUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  /** RF-2.1: classify the client's free-text request into a business policy. */
  classify(text: string): Observable<AgentClassifyResult> {
    return this.http.post<AgentClassifyResult>(`${this.API}/agent/classify`, { text });
  }

  /** RF-2.2: send recorded audio (Blob) and get back the transcribed text. */
  transcribe(audio: Blob): Observable<string> {
    const form = new FormData();
    form.append('file', audio, 'audio.webm');
    return this.http
      .post<{ text: string }>(`${this.API}/agent/transcribe`, form)
      .pipe(map(r => r.text ?? ''));
  }

  /** RF-2.5: full pre-process upload of a required document (initiate → S3 PUT → confirm). */
  uploadRequiredDocument(
    policyId: string,
    requirementId: string,
    clientId: string | null,
    file: File,
  ): Observable<string> {
    return this.http
      .post<PreProcessInitiateResponse>(`${this.API}/documents/pre-process`, {
        policyId,
        documentRequirementId: requirementId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        clientId,
      })
      .pipe(
        switchMap(init =>
          from(
            fetch(init.presignedUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type || 'application/octet-stream' },
            }),
          ).pipe(
            switchMap(res => {
              if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
              return this.http.post<{ id: string }>(
                `${this.API}/documents/${init.documentId}/confirm`,
                {},
              );
            }),
            map(() => init.documentId),
          ),
        ),
      );
  }

  /** Starts the process for the recommended policy. */
  startProcess(
    policyId: string,
    clientId: string | null,
    confirmedDocumentIds: string[],
  ): Observable<{ processInstanceId: string }> {
    return this.http.post<{ processInstanceId: string }>(`${this.API}/processes`, {
      policyId,
      initialData: {},
      clientId,
      confirmedDocumentIds,
    });
  }
}
