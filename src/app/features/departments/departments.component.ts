import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Department } from '../../core/models/domain';
import { DepartmentDialogComponent } from './department-dialog/department-dialog.component';

@Component({
  selector: 'app-departments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Departamentos</span>
      <span style="flex:1"></span>
      <button mat-flat-button (click)="openCreateDialog()">
        <mat-icon>add</mat-icon>
        Nuevo departamento
      </button>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }

    <mat-table [dataSource]="departments()" style="width:100%;">
      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef>Nombre</mat-header-cell>
        <mat-cell *matCellDef="let dept">{{ dept.name }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="description">
        <mat-header-cell *matHeaderCellDef>Descripción</mat-header-cell>
        <mat-cell *matCellDef="let dept">{{ dept.description ?? '—' }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="actions">
        <mat-header-cell *matHeaderCellDef>Acciones</mat-header-cell>
        <mat-cell *matCellDef="let dept">
          <button mat-icon-button (click)="openEditDialog(dept)">
            <mat-icon>edit</mat-icon>
          </button>
        </mat-cell>
      </ng-container>

      <mat-header-row *matHeaderRowDef="displayedColumns" />
      <mat-row *matRowDef="let row; columns: displayedColumns;" />
    </mat-table>

    @if (!loading() && departments().length === 0) {
      <p style="text-align:center; margin-top:32px; color: var(--mat-sys-on-surface-variant);">
        No hay departamentos registrados
      </p>
    }
  `,
})
export class DepartmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  private readonly API = 'http://34.237.109.152:3000/api/v1/departments';

  readonly departments = signal<Department[]>([]);
  readonly loading = signal(false);
  readonly displayedColumns = ['name', 'description', 'actions'];

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.loading.set(true);
    this.http.get<Department[]>(this.API).subscribe({
      next: data => {
        this.departments.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    this.dialog
      .open(DepartmentDialogComponent, { data: null, width: '440px' })
      .afterClosed()
      .subscribe((result: { name: string; description: string } | null) => {
        if (!result) return;
        this.http.post<Department>(this.API, result).subscribe({
          next: response => {
            this.departments.update(list => [...list, response]);
            this.snack.open('Departamento creado', 'OK', { duration: 3000 });
          },
          error: (err) => {
            this.snack.open(
              err.error?.message ?? 'Error al crear el departamento',
              'OK', { duration: 4000 });
          },
        });
      });
  }

  openEditDialog(dept: Department): void {
    this.dialog
      .open(DepartmentDialogComponent, { data: dept, width: '440px' })
      .afterClosed()
      .subscribe((result: { name: string; description: string } | null) => {
        if (!result) return;
        this.http.put<Department>(`${this.API}/${dept.id}`, result).subscribe(response => {
          this.departments.update(list =>
            list.map(d => (d.id === dept.id ? response : d))
          );
          this.snack.open('Departamento actualizado', 'OK', { duration: 3000 });
        });
      });
  }
}
