import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Department } from '../../core/models/domain';
import { DepartmentDialogComponent } from './department-dialog/department-dialog.component';

@Component({
  selector: 'app-departments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <!-- ── Page header ── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Departamentos</h1>
        <p class="page-subtitle">
          {{ departments().length }} departamento{{ departments().length !== 1 ? 's' : '' }} registrado{{ departments().length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button class="btn btn-primary" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon>
        Nuevo departamento
      </button>
    </div>

    <!-- ── Loading bar ── -->
    @if (loading()) {
      <div style="height:3px; overflow:hidden; background:#eff6ff;">
        <div class="loading-bar" style="height:100%;"></div>
      </div>
    }

    <!-- ── Table card ── -->
    <div class="page-body">
      <div class="card">
        @if (!loading() && departments().length === 0) {
          <div class="empty-state">
            <mat-icon>business</mat-icon>
            <p>No hay departamentos registrados todavía</p>
            <button class="btn btn-primary" (click)="openCreateDialog()">
              <mat-icon>add</mat-icon>
              Crear primer departamento
            </button>
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (dept of departments(); track dept.id) {
                <tr>
                  <td>
                    <span style="font-weight:600; color:#0f172a;">{{ dept.name }}</span>
                  </td>
                  <td style="color:#64748b;">{{ dept.description ?? '—' }}</td>
                  <td>
                    <button class="btn-icon" (click)="openEditDialog(dept)">
                      <mat-icon>edit</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class DepartmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  private readonly API = `${environment.apiUrl}/departments`;

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
