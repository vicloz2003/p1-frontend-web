import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  uploadFile(file: File): Observable<string> {
    return this.http.get<{ uploadUrl: string; publicUrl: string }>(
      `${this.API}/s3/presigned-url`,
      {
        params: {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        },
      }
    ).pipe(
      switchMap(presignedData =>
        new Observable<string>(observer => {
          fetch(presignedData.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
          }).then(response => {
            if (response.ok) {
              observer.next(presignedData.publicUrl);
              observer.complete();
            } else {
              observer.error(new Error(`S3 upload failed: ${response.status}`));
            }
          }).catch(err => observer.error(err));
        })
      )
    );
  }
}
