import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { Department } from '../../../core/models/domain';

export interface IaDialogData {
  departments: Department[];
}

@Component({
  selector: 'app-ia-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title style="display:flex; align-items:center; gap:8px;">
      <mat-icon color="primary">auto_awesome</mat-icon>
      Generar diagrama con IA
    </h2>

    <mat-dialog-content>
      <p style="font-size:0.85rem; color:var(--mat-sys-on-surface-variant);">
        Describe el proceso en lenguaje natural. La IA generara
        automaticamente los nodos, swimlanes y conexiones.
      </p>

      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Descripcion del proceso</mat-label>
        <textarea matInput
                  rows="6"
                  [value]="description()"
                  (input)="description.set($any($event.target).value)"
                  placeholder="Ejemplo: Un cliente solicita la instalacion de un medidor. Atencion al cliente registra la solicitud, el departamento tecnico verifica la viabilidad y finalmente legal firma el contrato.">
        </textarea>
        <mat-hint>Menciona los departamentos involucrados y las decisiones del proceso</mat-hint>
      </mat-form-field>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" style="margin-top:8px;" />
        <p style="font-size:0.85rem; text-align:center;
                  color:var(--mat-sys-on-surface-variant); margin-top:8px;">
          Generando diagrama con Gemini...
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="dialogRef.close(null)">Cancelar</button>
      <button mat-flat-button
              color="primary"
              [disabled]="description().trim().length < 20 || loading()"
              (click)="generate()">
        <mat-icon>auto_awesome</mat-icon>
        Generar
      </button>
    </mat-dialog-actions>
  `,
})
export class IaDialogComponent {
  readonly dialogRef = inject(MatDialogRef<IaDialogComponent>);
  readonly data = inject<IaDialogData>(MAT_DIALOG_DATA);

  readonly description = signal('');
  readonly loading = signal(false);

  async generate(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await fetch('http://34.237.109.152:8000/api/ia/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: this.description(),
          departments: this.data.departments,
          policyName: 'Nueva Política IA',
        }),
      });

      if (!response.ok) {
        const errorDetail = await response.json();
        console.error('[IA] Error del microservicio:', errorDetail);
        this.loading.set(false);
        return;
      }

      const result = await response.json();
      console.log('[IA] Resultado:', result);
      this.dialogRef.close(result);
    } catch (error) {
      this.loading.set(false);
      console.error('Error generando diagrama:', error);
    }
  }
}