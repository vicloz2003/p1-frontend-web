import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentResponse } from '../../core/models/responses';
import { DocumentService } from '../../core/services/document.service';

interface DocGroup {
  processInstanceId: string;
  docs: DocumentResponse[];
}

@Component({
  selector: 'app-my-department-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatProgressBarModule, MatTooltipModule, MatSnackBarModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <mat-icon style="margin-right:8px;">folder_shared</mat-icon>
      <span>Documentos de mi departamento</span>
      <span style="flex:1"></span>
      <button mat-icon-button (click)="reload()" matTooltip="Actualizar">
        <mat-icon>refresh</mat-icon>
      </button>
    </mat-toolbar>

    @if (loading()) { <mat-progress-bar mode="indeterminate"></mat-progress-bar> }

    <div style="max-width:880px; margin:0 auto; padding:24px;">
      <p style="margin:0 0 16px; font-size:0.88rem; color:var(--mat-sys-on-surface-variant);">
        Documentos de los trámites que tu departamento está trabajando ahora. Cualquier compañero del
        departamento puede abrirlos y <strong>co-editarlos en simultáneo</strong>.
      </p>

      @if (!loading() && groups().length === 0) {
        <div style="text-align:center; padding:56px 0; color:var(--mat-sys-on-surface-variant);">
          <mat-icon style="font-size:56px; width:56px; height:56px;">folder_off</mat-icon>
          <p>No hay documentos asignados a tu departamento por ahora.</p>
        </div>
      }

      @for (g of groups(); track g.processInstanceId) {
        <h3 style="display:flex; align-items:center; gap:8px; margin:18px 0 10px; font-size:0.95rem;">
          <mat-icon style="color:#1976d2; font-size:20px; width:20px; height:20px;">account_tree</mat-icon>
          Trámite #{{ g.processInstanceId.slice(-6) }}
        </h3>

        @for (doc of g.docs; track doc.id) {
          <mat-card appearance="outlined" style="margin-bottom:10px;">
            <mat-card-content style="padding:14px 16px; display:flex; align-items:center; gap:12px;">
              <mat-icon style="color:#1976d2;">description</mat-icon>
              <div style="flex:1; min-width:0;">
                <p style="margin:0; font-weight:600; overflow:hidden;
                          text-overflow:ellipsis; white-space:nowrap;">{{ doc.fileName }}</p>
                <p style="margin:2px 0 0; font-size:0.75rem; color:var(--mat-sys-on-surface-variant);">
                  {{ doc.mimeType }} · {{ doc.uploadedAt | date:'dd/MM/yyyy HH:mm' }}
                </p>
              </div>
              @if (isOfficeEditable(doc.fileName)) {
                <button mat-flat-button color="primary" (click)="edit(doc.id)">
                  <mat-icon>edit_document</mat-icon> Editar
                </button>
              }
              <button mat-stroked-button (click)="download(doc.id)">
                <mat-icon>download</mat-icon> Descargar
              </button>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
})
export class MyDepartmentDocsComponent {
  private readonly docService = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly docs = signal<DocumentResponse[]>([]);
  readonly loading = signal(true);

  readonly groups = computed<DocGroup[]>(() => {
    const map = new Map<string, DocumentResponse[]>();
    for (const d of this.docs()) {
      const key = d.processInstanceId ?? 'sin-tramite';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()].map(([processInstanceId, docs]) => ({ processInstanceId, docs }));
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.docService.listMyDepartment().subscribe({
      next: list => { this.docs.set(list); this.loading.set(false); },
      error: () => { this.docs.set([]); this.loading.set(false); },
    });
  }

  isOfficeEditable(fileName: string): boolean {
    return /\.(docx?|xlsx?|pptx?|odt|ods|odp|csv|txt|rtf)$/i.test(fileName ?? '');
  }

  edit(documentId: string): void {
    this.router.navigate(['/documents', documentId, 'edit']);
  }

  download(documentId: string): void {
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
}
