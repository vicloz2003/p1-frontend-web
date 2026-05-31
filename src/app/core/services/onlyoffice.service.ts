import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Signed editor config for the OnlyOffice Document Server (RF-1.10), as built by the backend.
 * `config` already carries the JWT `token`, so it is passed verbatim to `DocsAPI.DocEditor`.
 */
export interface OnlyOfficeConfig {
  documentServerUrl: string;
  documentType: string;
  config: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class OnlyOfficeService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/documents`;

  /** Fetch the signed editor config for a document (mode/permissions resolved by role on the server). */
  getConfig(documentId: string): Observable<OnlyOfficeConfig> {
    return this.http.get<OnlyOfficeConfig>(`${this.API}/${documentId}/onlyoffice/config`);
  }

  /**
   * Inject the Document Server's `api.js` once. OnlyOffice exposes `DocsAPI` globally; loading the
   * script from any other origin than the DS is unsupported, hence we use the URL the server returns.
   */
  loadApiScript(documentServerUrl: string): Promise<void> {
    const src = `${documentServerUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
    if ((window as unknown as { DocsAPI?: unknown }).DocsAPI) return Promise.resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar OnlyOffice')));
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el editor OnlyOffice'));
      document.body.appendChild(script);
    });
  }
}
