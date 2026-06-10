import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuditLogResponse, DocumentResponse } from '../../core/models/responses';
import { DocumentService } from '../../core/services/document.service';

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  UPLOAD:                 { label: 'Subida',             icon: 'upload',         color: '#4caf50' },
  REPLACE:                { label: 'Nueva versión',      icon: 'autorenew',      color: '#3f51b5' },
  DOWNLOAD:               { label: 'Descarga',           icon: 'download',       color: '#1976d2' },
  VIEW:                   { label: 'Visualización',      icon: 'visibility',     color: '#1976d2' },
  DELETE:                 { label: 'Eliminación',        icon: 'delete',         color: '#f44336' },
  PERMISSION_CHANGE:      { label: 'Cambio de permisos', icon: 'admin_panel_settings', color: '#ff9800' },
  PERMISSION_CHECK_FAILED:{ label: 'Acceso denegado',    icon: 'block',          color: '#f44336' },
};

@Component({
  selector: 'app-document-audit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title style="display:flex; align-items:center; gap:8px;">
      <mat-icon style="color:#1976d2;">history</mat-icon>
      Auditoría del documento
    </h2>

    <mat-dialog-content>
      <p style="margin:0 0 12px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        {{ data.fileName }}
      </p>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      } @else if (entries().length === 0) {
        <p style="text-align:center; padding:24px 0; color:var(--mat-sys-on-surface-variant);">
          Sin eventos registrados.
        </p>
      } @else {
        <div style="min-width:520px;">
          @for (e of entries(); track e.id) {
            <div style="display:flex; gap:12px; padding:10px 0;
                        border-bottom:1px solid var(--mat-sys-outline-variant);">
              <mat-icon [style.color]="meta(e.action).color" style="margin-top:2px;">
                {{ meta(e.action).icon }}
              </mat-icon>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <span style="font-weight:600; font-size:0.88rem;">{{ meta(e.action).label }}</span>
                  <span style="font-size:0.78rem; color:var(--mat-sys-on-surface-variant); white-space:nowrap;">
                    {{ e.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}
                  </span>
                </div>
                <p style="margin:2px 0 0; font-size:0.8rem;">
                  <strong>{{ e.userRole || '—' }}</strong>
                  · {{ e.userName ?? e.userId }}
                  @if (e.ipAddress) { · IP {{ e.ipAddress }} }
                </p>
                @if (e.detail) {
                  <p style="margin:2px 0 0; font-size:0.76rem; font-style:italic;
                            color:var(--mat-sys-on-surface-variant); word-break:break-word;">
                    {{ e.detail }}
                  </p>
                }
              </div>
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class DocumentAuditDialogComponent {
  readonly data = inject<DocumentResponse>(MAT_DIALOG_DATA);
  private readonly docService = inject(DocumentService);

  readonly entries = signal<AuditLogResponse[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.docService.getAudit(this.data.id).subscribe({
      next: list => {
        // Most recent first.
        this.entries.set([...list].reverse());
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  meta(action: string) {
    return ACTION_META[action] ?? { label: action, icon: 'help', color: '#9e9e9e' };
  }
}
