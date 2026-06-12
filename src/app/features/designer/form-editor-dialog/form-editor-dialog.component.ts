import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { FormField, FormSchema, GridColumn } from '../models/form-schema.models';
import {
  FormTemplateService,
  FormTemplateResponse,
} from '../../../core/services/form-template.service';
import { environment } from '../../../../environments/environment';

const TYPE_ICON: Record<FormField['type'], string> = {
  TEXT: 'short_text',
  TEXTAREA: 'notes',
  NUMBER: 'pin',
  DATE: 'calendar_today',
  SELECT: 'list',
  CHECKLIST: 'checklist',
  FILE: 'attach_file',
  SIGNATURE: 'draw',
  GRID: 'table_chart',
};

const TYPE_LABEL: Record<FormField['type'], string> = {
  TEXT: 'Texto corto',
  TEXTAREA: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  SELECT: 'Lista',
  CHECKLIST: 'Checklist',
  FILE: 'Archivo',
  SIGNATURE: 'Firma',
  GRID: 'Tabla/Grid',
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
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatMenuModule,
    MatChipsModule,
    DragDropModule,
  ],
  styles: [`
    .editor-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr;
      gap: 0;
      height: 100%;
      overflow: hidden;
    }
    .left-panel {
      border-right: 1px solid var(--mat-sys-outline-variant);
      overflow-y: auto;
      padding: 16px;
      padding-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }
    .right-panel {
      overflow-y: auto;
      padding: 16px;
      padding-bottom: 24px;
      background: var(--mat-sys-surface-container-lowest, #fafafa);
      min-height: 0;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 8px 0;
    }
    .type-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .type-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 16px;
      border: 1px solid var(--mat-sys-outline);
      background: transparent;
      cursor: pointer;
      font-size: 0.78rem;
      transition: background 0.15s;
    }
    .type-chip:hover {
      background: var(--mat-sys-secondary-container);
    }
    .type-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .field-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: background 0.12s;
    }
    .field-row:hover {
      background: var(--mat-sys-surface-container);
    }
    .field-row.selected {
      background: var(--mat-sys-secondary-container);
      border-color: var(--mat-sys-secondary);
    }
    .field-row .drag-handle {
      cursor: grab;
      color: var(--mat-sys-on-surface-variant);
    }
    .field-row .field-label {
      flex: 1;
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .field-row .field-type-badge {
      font-size: 0.7rem;
      background: var(--mat-sys-surface-container-high);
      padding: 2px 6px;
      border-radius: 10px;
      flex-shrink: 0;
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
      background: var(--mat-sys-secondary-container);
      border: 2px dashed var(--mat-sys-secondary);
      border-radius: 8px;
    }
    .cdk-drag-preview {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-radius: 8px;
      background: white;
      padding: 6px 8px;
    }
    .editor-card {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 12px;
      background: var(--mat-sys-surface);
    }
    .preview-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--mat-sys-on-surface-variant);
      gap: 8px;
    }
    .preview-field {
      margin-bottom: 16px;
    }
    .preview-field-label {
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .preview-required {
      color: var(--mat-sys-error);
    }
    .preview-input-mock {
      width: 100%;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 0.875rem;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface-variant);
      box-sizing: border-box;
      cursor: default;
    }
    .preview-input-mock.textarea {
      height: 72px;
      resize: none;
    }
    .preview-select-mock {
      width: 100%;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 0.875rem;
      background: var(--mat-sys-surface);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .preview-file-mock {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px dashed var(--mat-sys-outline);
      border-radius: 4px;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
    .preview-grid-mock {
      border: 1px solid var(--mat-sys-outline);
      border-radius: 4px;
      overflow: hidden;
      font-size: 0.8rem;
    }
    .preview-grid-header {
      display: flex;
      background: var(--mat-sys-surface-container);
    }
    .preview-grid-cell {
      flex: 1;
      padding: 6px 8px;
      border-right: 1px solid var(--mat-sys-outline-variant);
      font-weight: 500;
    }
    .preview-grid-cell:last-child { border-right: none; }
    .preview-grid-row {
      display: flex;
      border-top: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
    }
    .ia-section { display: flex; flex-direction: column; gap: 8px; }
    .template-row { display: flex; gap: 8px; }
    .col-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 0.82rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .col-label { flex: 1; }
  `],
  template: `
    <h2 mat-dialog-title style="margin: 0; padding: 16px 24px 0;">
      <mat-icon color="primary" style="vertical-align: middle; margin-right: 8px;">dynamic_form</mat-icon>
      Formulario: <strong>{{ data.nodeLabel }}</strong>
      <span style="font-size:0.8rem; color:var(--mat-sys-on-surface-variant);
                   margin-left:8px; font-weight:400;">
        ({{ fields().length }} campo{{ fields().length !== 1 ? 's' : '' }})
      </span>
    </h2>

    <mat-dialog-content style="padding: 0; margin: 0; overflow: hidden; flex: 1 1 0%; min-height: 0;">
      <div class="editor-layout">

        <!-- ═══════════ PANEL IZQUIERDO ═══════════ -->
        <div class="left-panel">

          <!-- Agregar campo por tipo -->
          <div>
            <p class="section-title">Agregar campo</p>
            <div class="type-chips">
              @for (t of fieldTypes; track t) {
                <button class="type-chip" (click)="addField(t)"
                        [attr.aria-label]="'Agregar campo ' + typeLabel(t)">
                  <mat-icon style="font-size:15px;width:15px;height:15px;">{{ typeIcon(t) }}</mat-icon>
                  {{ typeLabel(t) }}
                </button>
              }
            </div>
          </div>

          <mat-divider />

          <!-- Lista de campos con drag & drop -->
          <div>
            <p class="section-title">Campos del formulario</p>
            @if (fields().length === 0) {
              <p style="font-size:0.82rem; color:var(--mat-sys-on-surface-variant); margin:0;">
                Agrega un campo usando los botones de arriba.
              </p>
            } @else {
              <ul class="field-list"
                  cdkDropList
                  (cdkDropListDropped)="onDrop($event)">
                @for (field of fields(); track field.id) {
                  <li class="field-row"
                      [class.selected]="selectedFieldId() === field.id"
                      cdkDrag
                      (click)="selectField(field)">
                    <mat-icon class="drag-handle" cdkDragHandle
                              style="font-size:18px;width:18px;height:18px;">
                      drag_indicator
                    </mat-icon>
                    <mat-icon color="primary"
                              style="font-size:18px;width:18px;height:18px;flex-shrink:0;">
                      {{ typeIcon(field.type) }}
                    </mat-icon>
                    <span class="field-label">{{ field.label || '(sin etiqueta)' }}</span>
                    <span class="field-type-badge">{{ field.type }}</span>
                    @if (field.required) {
                      <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--mat-sys-error);">
                        star
                      </mat-icon>
                    }
                    <button mat-icon-button
                            style="width:28px;height:28px;flex-shrink:0;"
                            color="warn"
                            (click)="removeField(field.id, $event)"
                            [attr.aria-label]="'Eliminar campo ' + field.label">
                      <mat-icon style="font-size:16px;width:16px;height:16px;">delete_outline</mat-icon>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Editor del campo seleccionado -->
          @if (selectedField(); as sf) {
            <mat-divider />
            <div class="editor-card">
              <p class="section-title" style="margin-bottom:12px;">
                <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">
                  edit
                </mat-icon>
                Editar campo
              </p>
              <form [formGroup]="editForm" style="display:flex;flex-direction:column;gap:8px;">

                <mat-form-field appearance="outline" style="width:100%;">
                  <mat-label>Etiqueta</mat-label>
                  <input matInput formControlName="label" />
                </mat-form-field>

                <mat-form-field appearance="outline" style="width:100%;">
                  <mat-label>Clave (id)</mat-label>
                  <input matInput [value]="toFieldId(editForm.get('label')!.value ?? '')"
                         readonly style="color:var(--mat-sys-on-surface-variant);" />
                  <mat-hint>Generada automáticamente desde la etiqueta</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" style="width:100%;">
                  <mat-label>Tipo de campo</mat-label>
                  <mat-select formControlName="type">
                    @for (t of fieldTypes; track t) {
                      <mat-option [value]="t">{{ typeLabel(t) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-checkbox formControlName="required">Requerido</mat-checkbox>

                @if (editForm.get('type')!.value === 'SELECT'
                     || editForm.get('type')!.value === 'CHECKLIST') {
                  <mat-form-field appearance="outline" style="width:100%;">
                    <mat-label>Opciones (separadas por coma)</mat-label>
                    <input matInput formControlName="options"
                           placeholder="Ej: Aprobado,Rechazado,Pendiente" />
                    <mat-hint>Sin espacios extra entre opciones</mat-hint>
                  </mat-form-field>
                }

                @if (editForm.get('type')!.value === 'GRID') {
                  <div>
                    <p class="section-title">Columnas del grid</p>
                    @if (sf.columns && sf.columns.length > 0) {
                      @for (col of sf.columns; track col.id) {
                        <div class="col-row">
                          <mat-icon style="font-size:14px;width:14px;height:14px;
                                          color:var(--mat-sys-on-surface-variant);">
                            {{ typeIcon(col.type) }}
                          </mat-icon>
                          <span class="col-label">{{ col.label }} <em style="opacity:0.6;">({{ col.type }})</em></span>
                          <button mat-icon-button color="warn"
                                  style="width:24px;height:24px;"
                                  (click)="removeColumn(sf, col.id)">
                            <mat-icon style="font-size:14px;width:14px;height:14px;">close</mat-icon>
                          </button>
                        </div>
                      }
                    }
                    <div style="display:flex;gap:6px;margin-top:8px;align-items:flex-end;">
                      <mat-form-field appearance="outline" style="flex:1;">
                        <mat-label>Etiqueta columna</mat-label>
                        <input matInput [formControl]="newColLabel" />
                      </mat-form-field>
                      <mat-form-field appearance="outline" style="width:120px;">
                        <mat-label>Tipo</mat-label>
                        <mat-select [formControl]="newColType">
                          <mat-option value="TEXT">Texto</mat-option>
                          <mat-option value="NUMBER">Número</mat-option>
                          <mat-option value="DATE">Fecha</mat-option>
                          <mat-option value="SELECT">Lista</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <button mat-flat-button color="primary"
                              style="margin-bottom:16px;"
                              [disabled]="!newColLabel.value?.trim()"
                              (click)="addColumn(sf)">
                        <mat-icon>add</mat-icon>
                      </button>
                    </div>
                  </div>
                }

              </form>
            </div>
          }

          <mat-divider />

          <!-- Bloque IA -->
          <div class="editor-card ia-section">
            <p class="section-title">
              <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">
                auto_awesome
              </mat-icon>
              Generar campos con IA
            </p>
            <mat-form-field appearance="outline" style="width:100%;">
              <mat-label>Describe los campos que necesitas</mat-label>
              <textarea matInput rows="3"
                        [value]="iaDescription()"
                        (input)="iaDescription.set($any($event.target).value)"
                        placeholder="Ej: nombre del solicitante, monto solicitado, fecha límite y lista de productos adjuntos">
              </textarea>
            </mat-form-field>
            @if (iaLoading()) {
              <mat-progress-bar mode="indeterminate" />
              <p style="font-size:0.78rem;text-align:center;
                        color:var(--mat-sys-on-surface-variant);margin:4px 0 0;">
                Generando con Gemini…
              </p>
            }
            <button mat-flat-button color="accent"
                    style="width:100%;"
                    [disabled]="iaDescription().trim().length < 15 || iaLoading()"
                    (click)="generateWithIa()">
              <mat-icon>auto_awesome</mat-icon>
              Generar campos
            </button>
          </div>

          <mat-divider />

          <!-- Bloque Plantillas -->
          <div class="editor-card">
            <p class="section-title">
              <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">
                bookmark
              </mat-icon>
              Plantillas
            </p>
            <div class="template-row">
              <button mat-stroked-button style="flex:1;"
                      [matMenuTriggerFor]="templateMenu"
                      (click)="loadTemplates()">
                <mat-icon>folder_open</mat-icon>
                Cargar plantilla
              </button>
              <mat-menu #templateMenu="matMenu">
                @if (templatesLoading()) {
                  <mat-progress-bar mode="indeterminate" style="width:200px;" />
                }
                @if (!templatesLoading() && templates().length === 0) {
                  <button mat-menu-item disabled>Sin plantillas guardadas</button>
                }
                @for (tpl of templates(); track tpl.id) {
                  <button mat-menu-item (click)="applyTemplate(tpl)">
                    <mat-icon>description</mat-icon>
                    {{ tpl.name }}
                  </button>
                }
              </mat-menu>

              <button mat-stroked-button style="flex:1;"
                      [disabled]="fields().length === 0"
                      (click)="saveAsTemplate()">
                <mat-icon>bookmark_add</mat-icon>
                Guardar plantilla
              </button>
            </div>
          </div>

        </div><!-- /left-panel -->

        <!-- ═══════════ PANEL DERECHO: PREVISUALIZACIÓN ═══════════ -->
        <div class="right-panel">
          <p class="section-title" style="margin-bottom:16px;">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;">
              visibility
            </mat-icon>
            Vista previa del formulario
          </p>

          @if (fields().length === 0) {
            <div class="preview-empty">
              <mat-icon style="font-size:48px;width:48px;height:48px;opacity:0.3;">
                dynamic_form
              </mat-icon>
              <span style="font-size:0.875rem;">
                Agrega campos para ver la previsualización
              </span>
            </div>
          } @else {
            @for (field of fields(); track field.id) {
              <div class="preview-field"
                   [style.outline]="selectedFieldId() === field.id
                     ? '2px solid var(--mat-sys-primary)' : 'none'"
                   style="border-radius:4px;padding:4px 8px;transition:outline 0.15s;cursor:pointer;"
                   (click)="selectField(field)">
                <div class="preview-field-label">
                  {{ field.label || '(sin etiqueta)' }}
                  @if (field.required) {
                    <span class="preview-required" aria-label="requerido">*</span>
                  }
                </div>

                @switch (field.type) {
                  @case ('TEXT') {
                    <div class="preview-input-mock">Texto corto…</div>
                  }
                  @case ('TEXTAREA') {
                    <div class="preview-input-mock textarea">Texto largo…</div>
                  }
                  @case ('NUMBER') {
                    <div class="preview-input-mock">0</div>
                  }
                  @case ('DATE') {
                    <div class="preview-input-mock">dd/mm/aaaa</div>
                  }
                  @case ('SELECT') {
                    <div class="preview-select-mock">
                      <span>{{ field.options[0] ?? 'Seleccionar…' }}</span>
                      <mat-icon style="font-size:18px;width:18px;height:18px;">arrow_drop_down</mat-icon>
                    </div>
                  }
                  @case ('CHECKLIST') {
                    @if (field.options.length > 0) {
                      <div style="display:flex;flex-direction:column;gap:4px;">
                        @for (opt of field.options; track opt) {
                          <span style="display:flex;align-items:center;gap:6px;
                                       font-size:0.85rem;color:var(--mat-sys-on-surface-variant);">
                            <mat-icon style="font-size:18px;width:18px;height:18px;">check_box_outline_blank</mat-icon>
                            {{ opt }}
                          </span>
                        }
                      </div>
                    } @else {
                      <div class="preview-input-mock" style="opacity:0.5;">
                        Checklist sin opciones (agrégalas en el editor)
                      </div>
                    }
                  }
                  @case ('FILE') {
                    <div class="preview-file-mock">
                      <mat-icon style="font-size:18px;width:18px;height:18px;">attach_file</mat-icon>
                      Seleccionar archivo…
                    </div>
                  }
                  @case ('SIGNATURE') {
                    <div class="preview-input-mock" style="font-style:italic;opacity:0.6;">
                      Firma aquí…
                    </div>
                  }
                  @case ('GRID') {
                    @if (field.columns && field.columns.length > 0) {
                      <div class="preview-grid-mock">
                        <div class="preview-grid-header">
                          @for (col of field.columns; track col.id) {
                            <div class="preview-grid-cell">{{ col.label }}</div>
                          }
                        </div>
                        <div class="preview-grid-row">
                          @for (col of field.columns; track col.id) {
                            <div class="preview-grid-cell" style="opacity:0.5;font-style:italic;">
                              {{ col.type === 'NUMBER' ? '0' : col.type === 'DATE' ? 'dd/mm/aaaa' : '…' }}
                            </div>
                          }
                        </div>
                      </div>
                    } @else {
                      <div class="preview-input-mock" style="opacity:0.5;">
                        Grid sin columnas (agrégalas en el editor)
                      </div>
                    }
                  }
                }
              </div>
            }
          }
        </div><!-- /right-panel -->

      </div><!-- /editor-layout -->
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding: 12px 24px;">
      <button mat-stroked-button (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" (click)="confirm()">
        <mat-icon>check</mat-icon>
        Confirmar ({{ fields().length }} campos)
      </button>
    </mat-dialog-actions>
  `,
})
export class FormEditorDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<FormEditorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<FormEditorDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly templateSvc = inject(FormTemplateService);

  readonly fieldTypes: FormField['type'][] = [
    'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKLIST', 'FILE', 'SIGNATURE', 'GRID',
  ];

  readonly fields = signal<FormField[]>(
    this.data.schema.fields.map(f => ({ ...f, columns: f.columns ?? [] }))
  );
  readonly selectedFieldId = signal<string | null>(null);
  readonly selectedField = computed(() =>
    this.fields().find(f => f.id === this.selectedFieldId()) ?? null
  );

  readonly editForm = this.fb.group({
    label: ['', Validators.required],
    type: ['TEXT' as FormField['type']],
    required: [false],
    options: [''],
  });

  readonly newColLabel = this.fb.control('');
  readonly newColType = this.fb.control('TEXT');

  readonly iaDescription = signal('');
  readonly iaLoading = signal(false);
  readonly templates = signal<FormTemplateResponse[]>([]);
  readonly templatesLoading = signal(false);

  private editSub?: Subscription;

  ngOnInit(): void {
    this.editSub = this.editForm.valueChanges.subscribe(() => {
      const id = this.selectedFieldId();
      if (!id) return;
      const raw = this.editForm.getRawValue();
      const trimmedLabel = (raw.label ?? '').trim();
      this.fields.update(list => list.map(f => {
        if (f.id !== id) return f;
        // Only derive a new id when the label has content; otherwise keep the existing id
        // so selectedFieldId stays valid while the user is mid-edit.
        const newId = trimmedLabel ? this.toFieldId(trimmedLabel) : f.id;
        const type = (raw.type ?? f.type) as FormField['type'];
        return {
          ...f,
          id: newId,
          label: raw.label ?? f.label,
          type,
          required: raw.required ?? f.required,
          options: (type === 'SELECT' || type === 'CHECKLIST')
            ? (raw.options ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
        };
      }));
      // Keep selectedFieldId in sync when id changes due to label edit
      const newId = trimmedLabel ? this.toFieldId(trimmedLabel) : id;
      if (newId !== id && newId) {
        this.selectedFieldId.set(newId);
      }
    });
  }

  ngOnDestroy(): void {
    this.editSub?.unsubscribe();
  }

  typeIcon(type: string): string { return TYPE_ICON[type as FormField['type']] ?? 'input'; }
  typeLabel(type: string): string { return TYPE_LABEL[type as FormField['type']] ?? type; }

  addField(type: FormField['type']): void {
    const base = TYPE_LABEL[type];
    const count = this.fields().filter(f => f.type === type).length + 1;
    const label = `${base} ${count}`;
    const newField: FormField = {
      id: this.toFieldId(`${base}_${count}`),
      type,
      label,
      required: false,
      options: [],
      columns: [],
    };
    this.fields.update(list => [...list, newField]);
    this.selectField(newField);
  }

  removeField(id: string, event: Event): void {
    event.stopPropagation();
    this.fields.update(list => list.filter(f => f.id !== id));
    if (this.selectedFieldId() === id) {
      this.selectedFieldId.set(null);
      this.editForm.reset({ type: 'TEXT', required: false });
    }
  }

  selectField(field: FormField): void {
    this.selectedFieldId.set(field.id);
    this.editForm.setValue({
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options?.join(',') ?? '',
    }, { emitEvent: false });
  }

  onDrop(event: CdkDragDrop<FormField[]>): void {
    this.fields.update(list => {
      const copy = [...list];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  addColumn(field: FormField): void {
    const label = this.newColLabel.value?.trim();
    if (!label) return;
    const col: GridColumn = {
      id: this.toFieldId(label),
      type: (this.newColType.value ?? 'TEXT') as GridColumn['type'],
      label,
    };
    this.fields.update(list => list.map(f =>
      f.id === field.id
        ? { ...f, columns: [...(f.columns ?? []), col] }
        : f
    ));
    this.newColLabel.reset('');
  }

  removeColumn(field: FormField, colId: string): void {
    this.fields.update(list => list.map(f =>
      f.id === field.id
        ? { ...f, columns: (f.columns ?? []).filter(c => c.id !== colId) }
        : f
    ));
  }

  async generateWithIa(): Promise<void> {
    const desc = this.iaDescription().trim();
    if (desc.length < 15) return;

    if (this.fields().length > 0) {
      const confirmed = window.confirm(
        '¿Reemplazar los campos actuales con los generados por IA?'
      );
      if (!confirmed) return;
    }

    this.iaLoading.set(true);
    try {
      const res = await fetch(`${environment.iaUrl}/api/ia/generate-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeLabel: this.data.nodeLabel,
          description: desc,
        }),
      });

      if (!res.ok) {
        this.snack.open('Error al conectar con el servicio IA', 'OK', { duration: 3000 });
        return;
      }

      const data = await res.json() as { fields: FormField[] };
      const normalized = (data.fields ?? []).map(f => ({
        ...f,
        columns: f.columns ?? [],
        options: f.options ?? [],
      }));
      this.fields.set(normalized);
      this.selectedFieldId.set(null);
      this.snack.open(`✦ ${normalized.length} campos generados`, 'OK', { duration: 3000 });
    } catch {
      this.snack.open('No se pudo conectar al microservicio IA', 'OK', { duration: 3000 });
    } finally {
      this.iaLoading.set(false);
    }
  }

  loadTemplates(): void {
    this.templatesLoading.set(true);
    this.templateSvc.getAll().subscribe({
      next: tpls => {
        this.templates.set(tpls);
        this.templatesLoading.set(false);
      },
      error: () => {
        this.snack.open('Error cargando plantillas', 'OK', { duration: 3000 });
        this.templatesLoading.set(false);
      },
    });
  }

  applyTemplate(tpl: FormTemplateResponse): void {
    if (this.fields().length > 0) {
      const ok = window.confirm(`¿Reemplazar campos actuales con la plantilla "${tpl.name}"?`);
      if (!ok) return;
    }
    const fields = (tpl.formSchema.fields ?? []).map(f => ({
      ...f,
      columns: f.columns ?? [],
      options: f.options ?? [],
    }));
    this.fields.set(fields);
    this.selectedFieldId.set(null);
    this.snack.open(`Plantilla "${tpl.name}" aplicada`, 'OK', { duration: 2500 });
  }

  saveAsTemplate(): void {
    const name = window.prompt('Nombre de la plantilla:');
    if (!name?.trim()) return;
    this.templateSvc.create({
      name: name.trim(),
      formSchema: { fields: this.fields() },
    }).subscribe({
      next: () => this.snack.open('Plantilla guardada', 'OK', { duration: 2500 }),
      error: () => this.snack.open('Error al guardar plantilla', 'OK', { duration: 3000 }),
    });
  }

  confirm(): void {
    this.dialogRef.close({ fields: this.fields() } as FormSchema);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  toFieldId(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }
}
