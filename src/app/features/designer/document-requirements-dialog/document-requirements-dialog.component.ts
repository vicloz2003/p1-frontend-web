import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentRequirement, ActivityNode } from '../../../core/models/domain';
import { PolicyService } from '../../../core/services/policy.service';

export interface DocumentRequirementsDialogData {
  policyId: string;
  requirements: DocumentRequirement[];
  actionNodes: ActivityNode[];
}

interface EditableReq {
  id: string | null;
  name: string;
  description: string;
  allowedMimeTypes: string;
  mandatory: boolean;
  uploadStage: string;
  uploaderRole: string;
  maxSizeBytes: string;
}

function emptyReq(): EditableReq {
  return {
    id: null,
    name: '',
    description: '',
    allowedMimeTypes: 'application/pdf',
    mandatory: true,
    uploadStage: 'PROCESS_START',
    uploaderRole: 'ANY',
    maxSizeBytes: '',
  };
}

@Component({
  selector: 'app-document-requirements-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Requisitos de documentos</h2>

    <mat-dialog-content style="min-width:580px; max-height:65vh; overflow-y:auto;
                               padding-right:4px;">

      <!-- List of existing requirements -->
      @if (requirements().length === 0 && !showForm()) {
        <p style="color:var(--mat-sys-on-surface-variant); text-align:center; padding:24px 0;">
          No hay requisitos definidos. Haz clic en <strong>Agregar</strong> para crear el primero.
        </p>
      }

      @for (req of requirements(); track req.id) {
        <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 0;">
          <mat-icon style="margin-top:4px; color:var(--mat-sys-primary);">description</mat-icon>
          <div style="flex:1; min-width:0;">
            <p style="margin:0; font-weight:500;">
              {{ req.name }}
              @if (req.mandatory) {
                <span style="color:var(--mat-sys-error); font-size:0.75rem; margin-left:4px;">
                  *obligatorio
                </span>
              }
            </p>
            <p style="margin:2px 0 0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
              Etapa: <strong>{{ stageLabel(req.uploadStage) }}</strong>
              &nbsp;·&nbsp; Rol: {{ req.uploaderRole }}
              @if ((req.allowedMimeTypes?.length ?? 0) > 0) {
                &nbsp;·&nbsp; {{ req.allowedMimeTypes.join(', ') }}
              }
            </p>
            @if (req.description) {
              <p style="margin:2px 0 0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
                {{ req.description }}
              </p>
            }
          </div>
          <button mat-icon-button matTooltip="Editar"
                  (click)="startEdit(req)">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Eliminar"
                  [disabled]="saving()"
                  (click)="deleteReq(req)">
            <mat-icon color="warn">delete</mat-icon>
          </button>
        </div>
        <mat-divider></mat-divider>
      }

      <!-- Add / Edit form -->
      @if (showForm()) {
        <div style="margin-top:20px; padding:16px; border-radius:8px;
                    background:var(--mat-sys-surface-variant);">
          <p style="margin:0 0 12px; font-weight:600;">
            {{ form().id ? 'Editar requisito' : 'Nuevo requisito' }}
          </p>

          <mat-form-field appearance="outline" style="width:100%;" subscriptSizing="dynamic">
            <mat-label>Nombre *</mat-label>
            <input matInput [(ngModel)]="form().name" placeholder="Ej: Cédula de identidad">
          </mat-form-field>

          <mat-form-field appearance="outline" style="width:100%; margin-top:12px;" subscriptSizing="dynamic">
            <mat-label>Descripción</mat-label>
            <input matInput [(ngModel)]="form().description" placeholder="Descripción opcional">
          </mat-form-field>

          <div style="display:flex; gap:12px; margin-top:12px;">
            <mat-form-field appearance="outline" style="flex:1;" subscriptSizing="dynamic">
              <mat-label>Etapa de carga</mat-label>
              <mat-select [(ngModel)]="form().uploadStage">
                <mat-option value="PROCESS_START">Al iniciar el trámite</mat-option>
                @for (node of data.actionNodes; track node.id) {
                  <mat-option [value]="node.id">
                    Nodo: {{ node.label || node.id }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="flex:1;" subscriptSizing="dynamic">
              <mat-label>Quién puede cargar</mat-label>
              <mat-select [(ngModel)]="form().uploaderRole">
                <mat-option value="ANY">Cualquiera</mat-option>
                <mat-option value="CLIENT">Cliente</mat-option>
                <mat-option value="EMPLOYEE">Empleado</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" style="width:100%; margin-top:12px;" subscriptSizing="dynamic">
            <mat-label>Tipos MIME permitidos (separados por coma)</mat-label>
            <input matInput [(ngModel)]="form().allowedMimeTypes"
                   placeholder="application/pdf, image/jpeg, image/png">
          </mat-form-field>

          <div style="display:flex; gap:12px; margin-top:12px; align-items:center;">
            <mat-form-field appearance="outline" style="flex:1;" subscriptSizing="dynamic">
              <mat-label>Tamaño máximo (bytes, opcional)</mat-label>
              <input matInput type="number" [(ngModel)]="form().maxSizeBytes"
                     placeholder="Ej: 5242880 para 5 MB">
            </mat-form-field>
            <mat-checkbox [(ngModel)]="form().mandatory" style="margin-top:-12px;">
              Obligatorio
            </mat-checkbox>
          </div>

          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button mat-stroked-button (click)="cancelForm()" [disabled]="saving()">
              Cancelar
            </button>
            <button mat-flat-button color="primary"
                    [disabled]="!form().name.trim() || saving()"
                    (click)="saveReq()">
              @if (saving()) {
                <mat-progress-spinner diameter="18" mode="indeterminate"></mat-progress-spinner>
              } @else {
                {{ form().id ? 'Actualizar' : 'Agregar' }}
              }
            </button>
          </div>
        </div>
      }

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (!showForm()) {
        <button mat-stroked-button color="primary" (click)="startAdd()">
          <mat-icon>add</mat-icon> Agregar
        </button>
      }
      <button mat-flat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class DocumentRequirementsDialogComponent implements OnInit {
  readonly data: DocumentRequirementsDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DocumentRequirementsDialogComponent>);
  private readonly policyService = inject(PolicyService);
  private readonly snack = inject(MatSnackBar);

  readonly requirements = signal<DocumentRequirement[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly form = signal<EditableReq>(emptyReq());

  ngOnInit(): void {
    this.requirements.set([...this.data.requirements]);
  }

  stageLabel(stage: string): string {
    if (stage === 'PROCESS_START') return 'Inicio del trámite';
    const node = this.data.actionNodes.find(n => n.id === stage);
    return node ? `Nodo: ${node.label || node.id}` : stage;
  }

  startAdd(): void {
    this.form.set(emptyReq());
    this.showForm.set(true);
  }

  startEdit(req: DocumentRequirement): void {
    this.form.set({
      id: req.id,
      name: req.name,
      description: req.description ?? '',
      allowedMimeTypes: req.allowedMimeTypes?.join(', ') ?? '',
      mandatory: req.mandatory,
      uploadStage: req.uploadStage,
      uploaderRole: req.uploaderRole,
      maxSizeBytes: req.maxSizeBytes != null ? String(req.maxSizeBytes) : '',
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  saveReq(): void {
    const f = this.form();
    if (!f.name.trim()) return;

    const payload = {
      name: f.name.trim(),
      description: f.description.trim() || undefined,
      allowedMimeTypes: f.allowedMimeTypes
        ? f.allowedMimeTypes.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      mandatory: f.mandatory,
      uploadStage: f.uploadStage,
      uploaderRole: f.uploaderRole,
      maxSizeBytes: f.maxSizeBytes ? parseInt(f.maxSizeBytes, 10) : null,
    };

    this.saving.set(true);

    const request$ = f.id
      ? this.policyService.updateDocumentRequirement(this.data.policyId, f.id, payload)
      : this.policyService.addDocumentRequirement(this.data.policyId, payload);

    request$.subscribe({
      next: saved => {
        this.saving.set(false);
        this.showForm.set(false);
        if (f.id) {
          this.requirements.update(list =>
            list.map(r => (r.id === saved.id ? saved : r))
          );
        } else {
          this.requirements.update(list => [...list, saved]);
        }
        this.snack.open(
          f.id ? 'Requisito actualizado' : 'Requisito agregado',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Error al guardar el requisito', 'OK', { duration: 3000 });
      },
    });
  }

  deleteReq(req: DocumentRequirement): void {
    if (!confirm(`¿Eliminar el requisito "${req.name}"?`)) return;
    this.saving.set(true);
    this.policyService.removeDocumentRequirement(this.data.policyId, req.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.requirements.update(list => list.filter(r => r.id !== req.id));
        this.snack.open('Requisito eliminado', 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Error al eliminar el requisito', 'OK', { duration: 3000 });
      },
    });
  }
}
