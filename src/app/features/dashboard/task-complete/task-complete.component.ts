import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { TaskResponse } from '../../../core/models/responses';
import { FormField, FormSchema } from '../../designer/models/form-schema.models';

@Component({
  selector: 'app-task-complete',
  imports: [
    ReactiveFormsModule,
    FormlyModule,
    FormlyMaterialModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    DatePipe,
  ],
  template: `
    <mat-toolbar>
      <button mat-icon-button
              (click)="router.navigate(['/dashboard'])"
              matTooltip="Volver">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Completar Tarea</span>
    </mat-toolbar>

    <div style="max-width:640px; margin:0 auto; padding:24px;">

      @if (task(); as t) {

        <mat-card appearance="outlined" style="margin-bottom:24px;">
          <mat-card-header>
            <mat-card-title>{{ t.nodeId }}</mat-card-title>
            <mat-card-subtitle>
              Trámite: {{ t.processInstanceId }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:8px;">
            <p style="margin:0; font-size:0.85rem;
                      color:var(--mat-sys-on-surface-variant);">
              Asignado: {{ t.assignedAt | date:'dd/MM/yyyy HH:mm' }}
            </p>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title style="font-size:1rem;">
              Datos del formulario
            </mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">

            @if (fields().length === 0) {
              <p style="color:var(--mat-sys-on-surface-variant);
                        text-align:center; padding:16px 0;">
                Esta tarea no tiene campos de formulario.
                Puedes completarla directamente.
              </p>
            } @else {
              <form [formGroup]="form">
                <formly-form
                  [form]="form"
                  [fields]="fields()"
                  [model]="model">
                </formly-form>
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
                    [disabled]="form.invalid || submitting()">
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCompleteComponent implements OnInit {
  protected readonly http = inject(HttpClient);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly snack = inject(MatSnackBar);

  private readonly API = 'http://localhost:3000/api/v1';

  readonly task = signal<TaskResponse | null>(null);
  readonly submitting = signal(false);

  readonly form = new FormGroup({});
  model: Record<string, unknown> = {};
  readonly fields = signal<FormlyFieldConfig[]>([]);

  ngOnInit(): void {
    const taskFromState = this.router.lastSuccessfulNavigation()?.extras?.state?.['task'] as TaskResponse | undefined;

    if (taskFromState) {
      this.task.set(taskFromState);
      this.fields.set(this.buildFields(taskFromState));
    } else {
      this.snack.open('Sesión de tarea expirada, vuelve al dashboard', 'OK', {
        duration: 4000
      });
      this.router.navigate(['/dashboard']);
    }
  }

  private buildFields(task: TaskResponse): FormlyFieldConfig[] {
    const schema = task.formSchema as unknown as FormSchema;
    if (!schema?.fields?.length) return [];

    return schema.fields.map((field: FormField): FormlyFieldConfig => {
      const base: FormlyFieldConfig = {
        key: field.id,
        props: {
          label: field.label,
          required: field.required,
        },
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
            type: 'input',
            props: { ...base.props, type: 'text', label: field.label + ' (URL o ruta)' },
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
          this.snack.open(
            '¡Tarea completada! El motor ha avanzado el trámite.',
            'OK',
            { duration: 4000 }
          );
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.submitting.set(false);
          this.snack.open('Error al completar la tarea', 'OK', { duration: 3000 });
        },
      });
  }
}
