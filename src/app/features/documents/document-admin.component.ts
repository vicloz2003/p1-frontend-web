import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { DocumentResponse, ProcessStatusResponse, UserResponse } from '../../core/models/responses';
import { DocumentService } from '../../core/services/document.service';
import { DocumentPermissionsDialogComponent } from './document-permissions-dialog.component';
import { DocumentAuditDialogComponent } from './document-audit-dialog.component';
import { DocumentVersionsDialogComponent } from './document-versions-dialog.component';

@Component({
  selector: 'app-document-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatChipsModule, MatFormFieldModule, MatInputModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <mat-icon style="margin-right:8px;">folder_managed</mat-icon>
      <span>Gestión Documental — privilegios y auditoría</span>
    </mat-toolbar>

    <div style="max-width:980px; margin:0 auto; padding:24px;">

      <p style="margin:0 0 16px; font-size:0.88rem; color:var(--mat-sys-on-surface-variant);">
        Selecciona un trámite para administrar sus documentos: asignar privilegios
        (leer / escribir / eliminar) y consultar la bitácora de auditoría.
      </p>

      <!-- Buscador -->
      <mat-form-field appearance="outline" subscriptSizing="dynamic"
                      style="width:100%; max-width:460px; margin-bottom:16px;">
        <mat-label>Buscar trámite por cliente, política o estado</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)"
               placeholder="Escribe para filtrar…">
      </mat-form-field>

      <!-- Lista de trámites -->
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:24px;
                  max-height:340px; overflow-y:auto;">
        @for (p of filtered(); track p.processInstanceId) {
          <button type="button" (click)="select(p)"
            [style.border]="selected()?.processInstanceId === p.processInstanceId
              ? '2px solid var(--mat-sys-primary)' : '1px solid var(--mat-sys-outline-variant)'"
            [style.background]="selected()?.processInstanceId === p.processInstanceId
              ? 'var(--mat-sys-primary-container)' : 'var(--mat-sys-surface)'"
            style="text-align:left; border-radius:10px; padding:12px 16px; cursor:pointer;
                   display:flex; align-items:center; gap:14px; font:inherit;">
            <mat-icon [style.color]="statusColor(p.status)">{{ statusIcon(p.status) }}</mat-icon>
            <div style="flex:1; min-width:0;">
              <p style="margin:0; font-weight:600;">
                {{ clientName(p.clientId) }}
                <span style="font-weight:400; color:var(--mat-sys-on-surface-variant);">
                  · {{ p.policyName }}
                </span>
              </p>
              <p style="margin:2px 0 0; font-size:0.78rem; color:var(--mat-sys-on-surface-variant);">
                {{ statusLabel(p.status) }} · paso: {{ p.currentNodeLabel || p.currentNodeId }}
                · {{ p.startedAt | date:'dd/MM/yyyy HH:mm' }}
              </p>
            </div>
            <span style="font-family:monospace; font-size:0.7rem; color:var(--mat-sys-outline);"
                  [matTooltip]="p.processInstanceId">#{{ p.processInstanceId.slice(-6) }}</span>
          </button>
        }
        @if (!loadingProcesses() && filtered().length === 0) {
          <p style="text-align:center; padding:24px 0; color:var(--mat-sys-on-surface-variant);">
            No hay trámites que coincidan.
          </p>
        }
      </div>

      <!-- Documentos del trámite seleccionado -->
      @if (selected(); as sel) {
        <h3 style="display:flex; align-items:center; gap:8px; margin:0 0 12px;">
          <mat-icon style="color:#1976d2;">folder_open</mat-icon>
          Documentos de {{ clientName(sel.clientId) }}
          <span style="font-weight:400; font-size:0.85rem; color:var(--mat-sys-on-surface-variant);">
            ({{ sel.policyName }})
          </span>
        </h3>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }

        @if (!loading() && docs().length === 0) {
          <div style="text-align:center; padding:48px 0; color:var(--mat-sys-on-surface-variant);">
            <mat-icon style="font-size:56px; width:56px; height:56px;">folder_off</mat-icon>
            <p>Este trámite no tiene documentos.</p>
          </div>
        }

        @for (doc of docs(); track doc.id) {
          <mat-card appearance="outlined" style="margin-bottom:12px;">
            <mat-card-content style="padding:16px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <mat-icon style="color:#1976d2;">description</mat-icon>
                <div style="flex:1; min-width:0;">
                  <p style="margin:0; font-weight:600; overflow:hidden;
                            text-overflow:ellipsis; white-space:nowrap;">{{ doc.fileName }}</p>
                  <p style="margin:2px 0 0; font-size:0.76rem; color:var(--mat-sys-on-surface-variant);">
                    {{ doc.mimeType }} · subido por {{ roleLabel(doc.uploadedByRole) }} ·
                    {{ doc.uploadedAt | date:'dd/MM/yyyy HH:mm' }}
                  </p>
                </div>
                <span style="padding:3px 10px; border-radius:12px; font-size:0.72rem; font-weight:600;
                             color:white; background:{{ doc.status === 'CONFIRMED' ? '#4caf50' : '#ff9800' }};">
                  {{ doc.status === 'CONFIRMED' ? 'Confirmado' : 'Pendiente' }}
                </span>
              </div>

              <!-- Resumen de privilegios -->
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:12px;">
                <span style="font-size:0.72rem; color:var(--mat-sys-on-surface-variant); align-self:center;">
                  Privilegios:
                </span>
                <span style="font-size:0.72rem; padding:2px 8px; border-radius:10px;
                             background:var(--mat-sys-surface-variant);"
                      matTooltip="Pueden leer / descargar">
                  👁 leer: {{ permCount(doc, 'canRead') }}
                </span>
                <span style="font-size:0.72rem; padding:2px 8px; border-radius:10px;
                             background:var(--mat-sys-surface-variant);"
                      matTooltip="Pueden subir versiones / editar">
                  ✏ escribir: {{ permCount(doc, 'canWrite') }}
                </span>
                <span style="font-size:0.72rem; padding:2px 8px; border-radius:10px;
                             background:var(--mat-sys-surface-variant);"
                      matTooltip="Pueden eliminar">
                  🗑 eliminar: {{ permCount(doc, 'canDelete') }}
                </span>
              </div>
            </mat-card-content>
            <div style="display:flex; flex-wrap:wrap; gap:8px;
                        justify-content:flex-end; padding:8px 16px 16px;">
              @if (isOfficeEditable(doc.fileName)) {
                <button mat-stroked-button (click)="editInOffice(doc.id)"
                        matTooltip="Editar con OnlyOffice">
                  <mat-icon>edit_document</mat-icon> Editar
                </button>
              }
              <button mat-stroked-button (click)="downloadDoc(doc.id)"
                      matTooltip="Descargar archivo">
                <mat-icon>download</mat-icon> Descargar
              </button>
              <button mat-stroked-button (click)="openVersions(doc)"
                      matTooltip="Ver historial de versiones">
                <mat-icon>history_edu</mat-icon> Versiones
              </button>
              <button mat-stroked-button (click)="openAudit(doc)"
                      matTooltip="Ver bitácora de auditoría">
                <mat-icon>history</mat-icon> Auditoría
              </button>
              <button mat-flat-button color="primary" (click)="openPermissions(doc)"
                      matTooltip="Gestionar privilegios de acceso">
                <mat-icon>admin_panel_settings</mat-icon> Privilegios
              </button>
            </div>
          </mat-card>
        }
      }

    </div>
  `,
})
export class DocumentAdminComponent {
  private readonly http = inject(HttpClient);
  private readonly docService = inject(DocumentService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly API = environment.apiUrl;

  readonly processes = signal<ProcessStatusResponse[]>([]);
  readonly docs = signal<DocumentResponse[]>([]);
  readonly selected = signal<ProcessStatusResponse | null>(null);
  readonly loading = signal(false);
  readonly loadingProcesses = signal(true);
  private readonly users = signal<Map<string, UserResponse>>(new Map());
  readonly search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.processes();
    if (!q) return list;
    return list.filter(p =>
      this.clientName(p.clientId).toLowerCase().includes(q) ||
      (p.policyName ?? '').toLowerCase().includes(q) ||
      this.statusLabel(p.status).toLowerCase().includes(q) ||
      p.processInstanceId.toLowerCase().includes(q)
    );
  });

  constructor() {
    // Resolve client IDs to names for human-readable labels.
    this.http.get<UserResponse[]>(`${this.API}/users`).subscribe({
      next: list => {
        const map = new Map<string, UserResponse>();
        list.forEach(u => map.set(u.id, u));
        this.users.set(map);
      },
    });
    this.http.get<ProcessStatusResponse[]>(`${this.API}/processes`).subscribe({
      next: list => { this.processes.set(list); this.loadingProcesses.set(false); },
      error: () => this.loadingProcesses.set(false),
    });
  }

  clientName(clientId: string | null): string {
    if (!clientId) return 'Cliente desconocido';
    const u = this.users().get(clientId);
    if (!u) return `Cliente ${clientId.slice(-6)}`;
    return u.username || u.email || `Cliente ${clientId.slice(-6)}`;
  }

  select(p: ProcessStatusResponse): void {
    this.selected.set(p);
    this.loading.set(true);
    this.docs.set([]);
    this.docService.listByInstance(p.processInstanceId).subscribe({
      next: list => { this.docs.set(list); this.loading.set(false); },
      error: () => { this.docs.set([]); this.loading.set(false); },
    });
  }

  permCount(doc: DocumentResponse, key: 'canRead' | 'canWrite' | 'canDelete'): number {
    return doc.permissions?.[key]?.length ?? 0;
  }

  statusLabel(s: string): string {
    return s === 'ACTIVE' ? 'En curso' : s === 'COMPLETED' ? 'Completado' : 'Cancelado';
  }
  statusColor(s: string): string {
    return s === 'ACTIVE' ? '#ff9800' : s === 'COMPLETED' ? '#4caf50' : '#f44336';
  }
  statusIcon(s: string): string {
    return s === 'ACTIVE' ? 'pending' : s === 'COMPLETED' ? 'check_circle' : 'cancel';
  }
  roleLabel(role: string): string {
    return role === 'ADMIN_DESIGNER' ? 'Administrador'
      : role === 'EMPLOYEE' ? 'Empleado'
      : role === 'CLIENT' ? 'Cliente' : role;
  }

  isOfficeEditable(fileName: string): boolean {
    return /\.(docx?|xlsx?|pptx?|odt|ods|odp|csv|txt|rtf)$/i.test(fileName ?? '');
  }

  editInOffice(documentId: string): void {
    this.router.navigate(['/documents', documentId, 'edit']);
  }

  downloadDoc(documentId: string): void {
    this.docService.download(documentId).subscribe({
      next: ({ presignedUrl, fileName }) => {
        const a = document.createElement('a');
        a.href = presignedUrl;
        a.download = fileName;
        a.target = '_blank';
        a.click();
      },
      error: () => this.snack.open('No se pudo descargar el documento', 'OK', { duration: 3000 }),
    });
  }

  openPermissions(doc: DocumentResponse): void {
    this.dialog.open(DocumentPermissionsDialogComponent, { data: doc, width: '560px' })
      .afterClosed().subscribe(changed => { if (changed && this.selected()) this.select(this.selected()!); });
  }

  openAudit(doc: DocumentResponse): void {
    this.dialog.open(DocumentAuditDialogComponent, { data: doc, maxWidth: '640px' });
  }

  openVersions(doc: DocumentResponse): void {
    this.dialog.open(DocumentVersionsDialogComponent, { data: doc, maxWidth: '600px' });
  }
}
