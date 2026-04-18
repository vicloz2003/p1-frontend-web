import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { startWith } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormField, FormSchema } from '../models/form-schema.models';

const TYPE_ICON: Record<FormField['type'], string> = {
  TEXT: 'text_fields',
  TEXTAREA: 'notes',
  NUMBER: 'pin',
  DATE: 'calendar_today',
  SELECT: 'list',
  FILE: 'attach_file',
  SIGNATURE: 'draw',
};

const TYPE_LABEL: Record<FormField['type'], string> = {
  TEXT: 'Texto corto',
  TEXTAREA: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  SELECT: 'Lista de opciones',
  FILE: 'Archivo adjunto',
  SIGNATURE: 'Firma',
};

export interface FormEditorDialogData {
  nodeId: string;
  nodeLabel: string;
  schema: FormSchema;
}

@Component({
  selector: 'app-form-editor-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatListModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Formulario: {{ data.nodeLabel }}</h2>

    <mat-dialog-content>
      <!-- Existing fields -->
      @if (fields().length === 0) {
        <p style="color: var(--mat-sys-on-surface-variant); margin: 8px 0;">
          Este nodo no tiene campos. Agrega uno abajo.
        </p>
      } @else {
        @for (field of fields(); track field.id) {
          <div style="display:flex; align-items:center; gap:8px;
                      padding:10px 0; border-bottom:1px solid #e0e0e0;
                      width:100%; box-sizing:border-box; min-width:0;">
            <mat-icon color="primary" style="flex-shrink:0;">
              {{ iconFor(field.type) }}
            </mat-icon>
            <span style="flex:1; font-size:0.9rem; overflow:hidden;
                         text-overflow:ellipsis; white-space:nowrap; min-width:0;">
              {{ field.label }}
            </span>
            <mat-chip-set style="flex-shrink:0;">
              <mat-chip>{{ field.type }}</mat-chip>
              @if (field.required) {
                <mat-chip color="warn" highlighted>Req.</mat-chip>
              }
            </mat-chip-set>
            <button mat-icon-button color="warn"
                    (click)="removeField(field.id)"
                    style="flex-shrink:0;">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
        }
      }

      <mat-divider style="margin: 16px 0;"></mat-divider>

      <!-- Add new field form -->
      <form [formGroup]="newFieldForm" (ngSubmit)="addField()">
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Etiqueta del campo</mat-label>
          <input matInput formControlName="label" />
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Tipo de campo</mat-label>
          <mat-select formControlName="type">
            <mat-option value="TEXT">Texto corto</mat-option>
            <mat-option value="TEXTAREA">Texto largo</mat-option>
            <mat-option value="NUMBER">Número</mat-option>
            <mat-option value="DATE">Fecha</mat-option>
            <mat-option value="SELECT">Lista de opciones</mat-option>
            <mat-option value="FILE">Archivo adjunto</mat-option>
            <mat-option value="SIGNATURE">Firma</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="required">Requerido</mat-checkbox>

        @if ((typeValue$ | async) === 'SELECT') {
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>Opciones (separadas por coma)</mat-label>
            <input matInput formControlName="options"
                   placeholder="Ej: Aprobado,Rechazado,Pendiente">
            <mat-hint>Cada opción separada por coma sin espacios extra</mat-hint>
          </mat-form-field>
        }

        <div style="margin-top: 16px;">
          <button mat-flat-button color="primary" type="submit" [disabled]="newFieldForm.invalid">
            Agregar campo
          </button>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="confirm()">Confirmar</button>
    </mat-dialog-actions>
  `,
})
export class FormEditorDialogComponent {
  readonly data = inject<FormEditorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<FormEditorDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly fields = signal<FormField[]>([...this.data.schema.fields]);

  readonly newFieldForm = this.fb.group({
    label: ['', Validators.required],
    type: ['TEXT' as FormField['type'], Validators.required],
    required: [false],
    options: [''],
  });

  readonly typeValue$ = this.newFieldForm.get('type')!.valueChanges.pipe(
    startWith(this.newFieldForm.get('type')!.value)
  );

  iconFor(type: FormField['type']): string {
    const icons: Record<FormField['type'], string> = {
      TEXT: 'short_text',
      TEXTAREA: 'notes',
      NUMBER: 'pin',
      DATE: 'calendar_today',
      SELECT: 'list',
      FILE: 'attach_file',
      SIGNATURE: 'draw',
    };
    return icons[type];
  }

  labelFor(type: FormField['type']): string {
    return TYPE_LABEL[type];
  }

  addField(): void {
    if (this.newFieldForm.invalid) return;

    const raw = this.newFieldForm.getRawValue();
    const fieldType = raw.type as FormField['type'];
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: fieldType,
      label: raw.label ?? '',
      required: raw.required ?? false,
      options:
        fieldType === 'SELECT'
          ? (raw.options ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
    };

    this.fields.update(list => [...list, newField]);
    this.newFieldForm.reset({ type: 'TEXT', required: false });
  }

  removeField(id: string): void {
    this.fields.update(list => list.filter(f => f.id !== id));
  }

  confirm(): void {
    this.dialogRef.close({ fields: this.fields() } as FormSchema);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
