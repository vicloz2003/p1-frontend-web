import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface GuardConditionDialogData {
  flowId: string;
  sourceLabel: string;
  targetLabel: string;
  currentCondition: string | null;
}

@Component({
  selector: 'app-guard-condition-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Condición del flujo</h2>
    <p style="margin: 0 24px 8px; font-size: 0.95rem; font-weight: 500;">
      {{ data.sourceLabel }} → {{ data.targetLabel }}
    </p>

    <mat-dialog-content>
      <p style="font-size:0.85rem; color:var(--mat-sys-on-surface-variant);">
        Define la condición SpEL que debe cumplirse para seguir este flujo.
        Usa <code>#data['campo']</code> para referenciar datos del formulario.<br>
        Ejemplo: <code>#data['resultado'] == 'Aprobado'</code>
      </p>

      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Condición (SpEL)</mat-label>
        <input matInput
               [value]="condition()"
               (input)="condition.set($any($event.target).value)"
               placeholder="#data['campo'] == 'valor'">
        <mat-hint>Deja vacío para flujo sin condición (flujo por defecto)</mat-hint>
      </mat-form-field>

      <p style="margin: 16px 0 8px; font-size: 0.85rem;
                color: var(--mat-sys-on-surface-variant);">
        Ejemplos rápidos:
      </p>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
        <button mat-stroked-button (click)="setAprobado()">Aprobado</button>
        <button mat-stroked-button (click)="setRechazado()">Rechazado</button>
        <button mat-stroked-button (click)="setMonto()">Monto mayor 1000</button>
      </div>
      </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="condition.set('')">Limpiar</button>
      <button mat-stroked-button (click)="dialogRef.close(null)">Cancelar</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(condition())">
        Confirmar
      </button>
    </mat-dialog-actions>
  `,
})
export class GuardConditionDialogComponent {
  readonly data = inject<GuardConditionDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<GuardConditionDialogComponent>);

  readonly condition = signal<string>(this.data.currentCondition ?? '');

  setAprobado(): void {
    this.condition.set("#data['resultado'] == 'Aprobado'");
  }
  setRechazado(): void {
    this.condition.set("#data['resultado'] == 'Rechazado'");
  }
  setMonto(): void {
    this.condition.set("#data['monto'] > 1000");
  }
}
