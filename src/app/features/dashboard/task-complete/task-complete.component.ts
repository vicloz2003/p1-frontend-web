import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DatePipe } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { PolicyResponse, ProcessStatusResponse, TaskResponse, DocumentResponse } from '../../../core/models/responses';
import { DocumentRequirement } from '../../../core/models/domain';
import { DocumentService } from '../../../core/services/document.service';
import { FormField, FormSchema } from '../../designer/models/form-schema.models';

interface DocUploadState {
  requirementId: string;
  name: string;
  mandatory: boolean;
  status: 'PENDING' | 'UPLOADING' | 'CONFIRMED';
  documentId: string | null;
  error: string | null;
}

interface InitiateUploadRequest {
  processInstanceId: string;
  documentRequirementId: string;
  fileName: string;
  mimeType: string;
  taskId: string;
}

interface DocumentUploadInitiateResponse {
  documentId: string;
  s3Key: string;
  presignedUrl: string;
}

@Component({
  selector: 'app-task-complete',
  imports: [
    ReactiveFormsModule, FormsModule,
    FormlyModule, FormlyMaterialModule,
    MatToolbarModule, MatButtonModule, MatCardModule,
    MatDividerModule, MatIconModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule,
    DatePipe,
  ],
  template: `
    <mat-toolbar>
      <button mat-icon-button (click)="router.navigate(['/dashboard'])" matTooltip="Volver">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Completar Tarea</span>
    </mat-toolbar>

    <div style="max-width:640px; margin:0 auto; padding:24px;">

      @if (task(); as t) {

        <!-- Task info card -->
        <mat-card appearance="outlined" style="margin-bottom:24px;">
          <mat-card-header>
            <mat-card-title>{{ t.nodeLabel }}</mat-card-title>
            <mat-card-subtitle>Trámite: {{ t.processInstanceId }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:8px;">
            <p style="margin:0; font-size:0.85rem; color:var(--mat-sys-on-surface-variant);">
              Asignado: {{ t.assignedAt | date:'dd/MM/yyyy HH:mm' }}
            </p>
          </mat-card-content>
        </mat-card>

        <!-- Documentos del cliente (subidos al iniciar el trámite) -->
        @if (clientDocs().length > 0) {
          <mat-card appearance="outlined" style="margin-bottom:24px;">
            <mat-card-header>
              <mat-card-title style="font-size:1rem; display:flex; align-items:center; gap:8px;">
                <mat-icon style="color:#1976d2;">folder_shared</mat-icon>
                Documentos del cliente
              </mat-card-title>
              <mat-card-subtitle>Subidos al iniciar el trámite — revisar antes de completar</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content style="padding-top:12px;">
              @for (doc of clientDocs(); track doc.id) {
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;
                            padding:10px 12px; border-radius:8px;
                            background:var(--mat-sys-surface-variant);">
                  <mat-icon style="color:#4caf50;">check_circle</mat-icon>
                  <div style="flex:1; min-width:0;">
                    <p style="margin:0; font-size:0.9rem; font-weight:500; overflow:hidden;
                              text-overflow:ellipsis; white-space:nowrap;">
                      {{ doc.fileName }}
                    </p>
                    <p style="margin:2px 0 0; font-size:0.75rem;
                              color:var(--mat-sys-on-surface-variant);">
                      {{ doc.mimeType }}
                    </p>
                  </div>
                  @if (isOfficeEditable(doc.fileName)) {
                    <button mat-icon-button color="primary"
                            matTooltip="Editar en Office (OnlyOffice)"
                            (click)="editInOffice(doc.id)">
                      <mat-icon>edit_document</mat-icon>
                    </button>
                  }
                  <button mat-icon-button
                          matTooltip="Descargar"
                          (click)="downloadClientDoc(doc.id)">
                    <mat-icon>download</mat-icon>
                  </button>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Document requirements for this node -->
        @if (nodeDocRequirements().length > 0) {
          <mat-card appearance="outlined" style="margin-bottom:24px;">
            <mat-card-header>
              <mat-card-title style="font-size:1rem;">
                <mat-icon>description</mat-icon>
                Documentos requeridos
              </mat-card-title>
            </mat-card-header>
            <mat-card-content style="padding-top:16px;">
              @for (req of nodeDocRequirements(); track req.id) {
                @let state = docStates().get(req.id);
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;
                            padding:10px 12px; border-radius:8px;
                            background:var(--mat-sys-surface-variant);">

                  @if (state?.status === 'CONFIRMED') {
                    <mat-icon style="color:var(--mat-sys-primary);">check_circle</mat-icon>
                  } @else if (state?.status === 'UPLOADING') {
                    <mat-progress-spinner diameter="24" mode="indeterminate"></mat-progress-spinner>
                  } @else {
                    <mat-icon style="color:var(--mat-sys-outline);">
                      {{ req.mandatory ? 'error_outline' : 'upload_file' }}
                    </mat-icon>
                  }

                  <div style="flex:1; min-width:0;">
                    <p style="margin:0; font-size:0.9rem; font-weight:500;">
                      {{ req.name }}
                      @if (req.mandatory) {
                        <span style="color:var(--mat-sys-error); font-size:0.75rem; margin-left:4px;">
                          *obligatorio
                        </span>
                      }
                    </p>
                    @if (req.description) {
                      <p style="margin:2px 0 0; font-size:0.78rem;
                                color:var(--mat-sys-on-surface-variant);">{{ req.description }}</p>
                    }
                    @if (state?.error) {
                      <p style="margin:2px 0 0; font-size:0.78rem; color:var(--mat-sys-error);">
                        {{ state!.error }}
                      </p>
                    }
                  </div>

                  @if (state?.status === 'CONFIRMED') {
                    <span style="font-size:0.8rem; color:var(--mat-sys-primary); white-space:nowrap;">
                      Cargado
                    </span>
                  } @else if (state?.status !== 'UPLOADING') {
                    <button mat-stroked-button (click)="triggerFileInput(req)">
                      <mat-icon>upload</mat-icon> Cargar
                    </button>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Elaborar documento colaborativo (RF-1.10) -->
        <mat-card appearance="outlined" style="margin-bottom:24px;">
          <mat-card-header>
            <mat-card-title style="font-size:1rem; display:flex; align-items:center; gap:8px;">
              <mat-icon style="color:#00897b;">note_add</mat-icon>
              Elaborar documento
            </mat-card-title>
            <mat-card-subtitle>
              Crea un documento en blanco y llénalo con tu departamento en simultáneo
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <mat-form-field appearance="outline" style="width:100%;" subscriptSizing="dynamic">
              <mat-label>Nombre del documento</mat-label>
              <input matInput [(ngModel)]="newDocName"
                     placeholder="Ej: Contrato de préstamo, Acta de revisión…"
                     [disabled]="creating()">
              <mat-icon matSuffix>edit</mat-icon>
            </mat-form-field>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; align-items:center;">
              <button mat-flat-button color="primary"
                      [disabled]="creating() || !newDocName.trim()"
                      (click)="createDoc('WORD')">
                @if (creating() && creatingKind === 'WORD') {
                  <mat-progress-spinner diameter="18" mode="indeterminate"
                    style="display:inline-block; margin-right:6px;"></mat-progress-spinner>
                } @else {
                  <mat-icon>description</mat-icon>
                }
                Word (.docx)
              </button>
              <button mat-flat-button color="accent"
                      [disabled]="creating() || !newDocName.trim()"
                      (click)="createDoc('CELL')">
                @if (creating() && creatingKind === 'CELL') {
                  <mat-progress-spinner diameter="18" mode="indeterminate"
                    style="display:inline-block; margin-right:6px;"></mat-progress-spinner>
                } @else {
                  <mat-icon>table_chart</mat-icon>
                }
                Excel (.xlsx)
              </button>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Form card -->
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title style="font-size:1rem;">Datos del formulario</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            @if (fields().length === 0) {
              <p style="color:var(--mat-sys-on-surface-variant); text-align:center; padding:16px 0;">
                Esta tarea no tiene campos de formulario. Puedes completarla directamente.
              </p>
            } @else {
              <form [formGroup]="form">
                <formly-form [form]="form" [fields]="fields()" [model]="model"></formly-form>
              </form>
            }
          </mat-card-content>
          <mat-card-actions align="end" style="padding:16px; gap:8px;">
            <button mat-stroked-button
                    (click)="router.navigate(['/dashboard'])"
                    [disabled]="submitting()">
              Cancelar
            </button>
            <button mat-flat-button color="primary"
                    (click)="submit()"
                    [disabled]="form.invalid || submitting() || !allMandatoryDocsDone()"
                    [matTooltip]="!allMandatoryDocsDone() ? 'Carga todos los documentos obligatorios' : ''">
              @if (submitting()) {
                <mat-icon>hourglass_empty</mat-icon> Enviando…
              } @else {
                <mat-icon>check_circle</mat-icon> Completar tarea
              }
            </button>
          </mat-card-actions>
        </mat-card>

      }

    </div>

    <input #fileInput type="file" style="display:none;" (change)="onFileSelected($event)">
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCompleteComponent implements OnInit {
  protected readonly http = inject(HttpClient);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly snack = inject(MatSnackBar);
  private readonly docService = inject(DocumentService);

  private readonly API = environment.apiUrl;

  readonly task = signal<TaskResponse | null>(null);
  readonly submitting = signal(false);
  readonly creating = signal(false);
  newDocName = '';
  creatingKind: 'WORD' | 'CELL' = 'WORD';
  readonly nodeDocRequirements = signal<DocumentRequirement[]>([]);  // docs que el empleado debe subir en este nodo
  readonly clientDocs = signal<DocumentResponse[]>([]);              // docs ya subidos por el cliente (PROCESS_START)
  readonly docStates = signal<Map<string, DocUploadState>>(new Map());

  readonly form = new FormGroup({});
  model: Record<string, unknown> = {};
  readonly fields = signal<FormlyFieldConfig[]>([]);

  private pendingUploadReq: DocumentRequirement | null = null;
  private fileInputEl: HTMLInputElement | null = null;

  ngOnInit(): void {
    const taskFromState = this.router.lastSuccessfulNavigation()?.extras?.state?.['task'] as TaskResponse | undefined;
    if (taskFromState) {
      this.task.set(taskFromState);
      this.fields.set(this.buildFields(taskFromState));
      this.loadNodeDocRequirements(taskFromState);
    } else {
      this.snack.open('Sesión de tarea expirada, vuelve al dashboard', 'OK', { duration: 4000 });
      this.router.navigate(['/dashboard']);
    }
  }

  allMandatoryDocsDone(): boolean {
    const mandatory = this.nodeDocRequirements().filter(r => r.mandatory);
    if (mandatory.length === 0) return true;
    const states = this.docStates();
    return mandatory.every(r => states.get(r.id)?.status === 'CONFIRMED');
  }

  triggerFileInput(req: DocumentRequirement): void {
    this.pendingUploadReq = req;
    if (!this.fileInputEl) {
      this.fileInputEl = document.querySelector('input[type="file"]') as HTMLInputElement;
    }
    if (this.fileInputEl) {
      this.fileInputEl.accept = req.allowedMimeTypes?.join(',') ?? '';
      this.fileInputEl.value = '';
      this.fileInputEl.click();
    }
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const req = this.pendingUploadReq;
    const task = this.task();
    if (!file || !req || !task) return;

    this.pendingUploadReq = null;
    this.setDocState(req.id, { status: 'UPLOADING', error: null });

    this.http.post<DocumentUploadInitiateResponse>(
      `${this.API}/documents/initiate`,
      {
        processInstanceId: task.processInstanceId,
        documentRequirementId: req.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        taskId: task.id,
      } satisfies InitiateUploadRequest
    ).subscribe({
      next: initRes => {
        this.docService.uploadToS3(initRes.presignedUrl, file).subscribe({
          next: () => {
            this.docService.confirmUpload(initRes.documentId).subscribe({
              next: confirmed => {
                this.setDocState(req.id, {
                  status: 'CONFIRMED',
                  documentId: confirmed.id,
                  error: null,
                });
              },
              error: () => this.setDocState(req.id, {
                status: 'PENDING',
                error: 'Error al confirmar el archivo.',
              }),
            });
          },
          error: () => this.setDocState(req.id, {
            status: 'PENDING',
            error: 'Error al subir a S3.',
          }),
        });
      },
      error: () => this.setDocState(req.id, {
        status: 'PENDING',
        error: 'Error al iniciar la carga.',
      }),
    });
  }

  private setDocState(reqId: string, partial: Partial<DocUploadState>): void {
    const map = new Map(this.docStates());
    const current = map.get(reqId);
    if (current) {
      map.set(reqId, { ...current, ...partial });
      this.docStates.set(map);
    }
  }

  private loadNodeDocRequirements(task: TaskResponse): void {
    // 1. Documentos ya subidos por el cliente para este proceso
    this.http.get<DocumentResponse[]>(`${this.API}/processes/${task.processInstanceId}/documents`)
      .subscribe({
        next: docs => this.clientDocs.set(docs),
        error: () => { /* non-critical */ }
      });

    // 2. Requisitos documentales que el empleado debe subir en ESTE nodo específico
    this.http.get<ProcessStatusResponse>(`${this.API}/processes/${task.processInstanceId}/status`)
      .subscribe({
        next: status => {
          if (!status.businessPolicyId) return;
          this.http.get<PolicyResponse>(`${this.API}/policies/${status.businessPolicyId}`)
            .subscribe({
              next: policy => {
                // Filtra sólo los requisitos asignados a este nodo (uploadStage = nodeId del nodo actual)
                const nodeReqs = (policy.documentRequirements ?? [])
                  .filter(r => r.uploadStage === task.nodeId);
                this.nodeDocRequirements.set(nodeReqs);
                const map = new Map<string, DocUploadState>();
                nodeReqs.forEach(r => {
                  map.set(r.id, {
                    requirementId: r.id,
                    name: r.name,
                    mandatory: r.mandatory,
                    status: 'PENDING',
                    documentId: null,
                    error: null,
                  });
                });
                this.docStates.set(map);
              },
              error: () => { /* non-critical */ }
            });
        },
        error: () => { /* non-critical */ }
      });
  }

  /** RF-1.10: el funcionario crea un Word/Excel con nombre personalizado y lo abre para co-editar. */
  createDoc(kind: 'WORD' | 'CELL'): void {
    const t = this.task();
    const name = this.newDocName.trim();
    if (!t || this.creating() || !name) return;
    this.creating.set(true);
    this.creatingKind = kind;
    this.docService.createBlank({
      processInstanceId: t.processInstanceId,
      taskId: t.id,
      nodeId: t.nodeId,
      fileName: name,
      kind,
    }).subscribe({
      next: doc => {
        this.creating.set(false);
        this.newDocName = '';
        this.router.navigate(['/documents', doc.id, 'edit']);
      },
      error: () => {
        this.creating.set(false);
        this.snack.open('No se pudo crear el documento', 'OK', { duration: 3000 });
      },
    });
  }

  /** OnlyOffice solo edita formatos ofimáticos; muestra el botón "Editar" únicamente para esos. */
  isOfficeEditable(fileName: string): boolean {
    return /\.(docx?|xlsx?|pptx?|odt|ods|odp|csv|txt|rtf)$/i.test(fileName ?? '');
  }

  editInOffice(documentId: string): void {
    this.router.navigate(['/documents', documentId, 'edit']);
  }

  downloadClientDoc(documentId: string): void {
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

  private buildFields(task: TaskResponse): FormlyFieldConfig[] {
    const schema = task.formSchema as unknown as FormSchema;
    if (!schema?.fields?.length) return [];

    return schema.fields.map((field: FormField): FormlyFieldConfig => {
      const base: FormlyFieldConfig = {
        key: field.id,
        props: { label: field.label, required: field.required },
      };

      switch (field.type) {
        case 'TEXT':
          return { ...base, type: 'input', props: { ...base.props, type: 'text' } };
        case 'TEXTAREA':
          return { ...base, type: 'textarea', props: { ...base.props, rows: 4 } };
        case 'NUMBER':
          return { ...base, type: 'input', props: { ...base.props, type: 'number' } };
        case 'DATE':
          return { ...base, type: 'datepicker' };
        case 'SELECT':
          return {
            ...base,
            type: 'select',
            props: {
              ...base.props,
              options: field.options.map(o => ({ label: o, value: o })),
            },
          };
        case 'FILE':
          return {
            ...base,
            type: 'file-upload',
            props: { label: field.label, required: field.required },
          };
        case 'SIGNATURE':
          return {
            ...base,
            type: 'input',
            props: { ...base.props, type: 'text', label: field.label + ' (firma)' },
          };
        default:
          return { ...base, type: 'input' };
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const t = this.task();
    if (!t) return;
    this.submitting.set(true);
    this.http
      .post<void>(`${this.API}/tasks/${t.id}/complete`, { formData: this.model })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.snack.open('¡Tarea completada! El motor ha avanzado el trámite.', 'OK', { duration: 4000 });
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.submitting.set(false);
          this.snack.open('Error al completar la tarea', 'OK', { duration: 3000 });
        },
      });
  }
}
