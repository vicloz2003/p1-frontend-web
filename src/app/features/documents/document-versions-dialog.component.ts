import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentResponse } from '../../core/models/responses';
import { DocumentService } from '../../core/services/document.service';

/**
 * RF-07 — Document version history. Lists the current (latest) version plus every
 * previous version captured on each replace / OnlyOffice save, each downloadable via
 * its own presigned URL. ADMIN_DESIGNER.
 */
@Component({
  selector: 'app-document-versions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title style="display:flex; align-items:center; gap:8px;">
      <mat-icon color="primary">history</mat-icon>
      Versiones — {{ data.fileName }}
    </h2>

    <mat-dialog-content>
      <!-- Current version -->
      <div class="ver-row current">
        <mat-icon style="color:#4caf50;">check_circle</mat-icon>
        <div class="ver-info">
          <p class="ver-title">Versión actual</p>
          <p class="ver-meta">
            Subido por {{ data.uploadedBy }} · {{ data.uploadedAt | date:'dd/MM/yyyy HH:mm' }}
          </p>
        </div>
        <button mat-stroked-button (click)="downloadCurrent()">
          <mat-icon>download</mat-icon> Descargar
        </button>
      </div>

      @if (versions().length > 0) {
        <p class="section">Versiones anteriores ({{ versions().length }})</p>
        @for (v of versions(); track v.versionId; let i = $index) {
          <div class="ver-row">
            <mat-icon style="color:#90a4ae;">history</mat-icon>
            <div class="ver-info">
              <p class="ver-title">Versión {{ versions().length - i }}</p>
              <p class="ver-meta">
                {{ v.uploadedBy }} · {{ v.uploadedAt | date:'dd/MM/yyyy HH:mm' }}
                @if (v.sizeBytes) { · {{ (v.sizeBytes / 1024) | number:'1.0-0' }} KB }
              </p>
            </div>
            <button mat-stroked-button (click)="downloadVersion(v.versionId)">
              <mat-icon>download</mat-icon> Descargar
            </button>
          </div>
        }
      } @else {
        <p class="empty">Aún no hay versiones anteriores. Se registran cada vez que el
          documento se reemplaza o se guarda en el editor colaborativo.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 420px; max-width: 560px; }
    .section { font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
               letter-spacing: 0.06em; color: var(--mat-sys-on-surface-variant);
               margin: 16px 0 8px; }
    .ver-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px;
               border: 1px solid var(--mat-sys-outline-variant); border-radius: 10px;
               margin-bottom: 8px; }
    .ver-row.current { border-color: #4caf50; background: rgba(76,175,80,0.06); }
    .ver-info { flex: 1; min-width: 0; }
    .ver-title { margin: 0; font-weight: 600; font-size: 0.9rem; }
    .ver-meta { margin: 2px 0 0; font-size: 0.76rem; color: var(--mat-sys-on-surface-variant); }
    .empty { font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); padding: 8px 0; }
  `],
})
export class DocumentVersionsDialogComponent {
  readonly data = inject<DocumentResponse>(MAT_DIALOG_DATA);
  private readonly docService = inject(DocumentService);
  private readonly snack = inject(MatSnackBar);

  /** Newest previous version first. */
  versions() {
    return [...(this.data.versions ?? [])].reverse();
  }

  downloadCurrent(): void {
    this.docService.download(this.data.id).subscribe({
      next: r => this.openUrl(r.presignedUrl, r.fileName),
      error: () => this.fail(),
    });
  }

  downloadVersion(versionId: string): void {
    this.docService.downloadVersion(this.data.id, versionId).subscribe({
      next: r => this.openUrl(r.presignedUrl, r.fileName),
      error: () => this.fail(),
    });
  }

  private openUrl(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  }

  private fail(): void {
    this.snack.open('No se pudo descargar la versión', 'OK', { duration: 3000 });
  }
}
