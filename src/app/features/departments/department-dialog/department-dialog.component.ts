import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Department } from '../../../core/models/domain';

@Component({
  selector: 'app-department-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data) { Editar departamento } @else { Nuevo departamento }
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" style="display:flex; flex-direction:column; gap:4px;">
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>El nombre es obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Descripción (opcional)</mat-label>
          <input matInput formControlName="description" />
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="confirm()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
})
export class DepartmentDialogComponent {
  readonly data = inject<Department | null>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DepartmentDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    name: [this.data?.name ?? '', Validators.required],
    description: [this.data?.description ?? ''],
  });

  confirm(): void {
    if (this.form.invalid) return;
    const { name, description } = this.form.getRawValue();
    this.dialogRef.close({ name: name ?? '', description: description ?? '' });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
