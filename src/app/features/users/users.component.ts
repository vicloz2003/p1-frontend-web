import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Department } from '../../core/models/domain';
import { UserResponse } from '../../core/models/responses';

interface AssignDepartmentRequest {
  departmentId: string;
}

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatChipsModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar>
      <span>Gestión de Usuarios</span>
      <span style="flex:1"></span>
      <button mat-icon-button (click)="ngOnInit()" matTooltip="Actualizar">
        <mat-icon>refresh</mat-icon>
      </button>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    @if (!loading() && users().length === 0) {
      <div style="display:flex; flex-direction:column; align-items:center;
                  justify-content:center; padding:64px 0; gap:16px;">
        <mat-icon style="font-size:64px; width:64px; height:64px; color:#9e9e9e;">
          group
        </mat-icon>
        <span style="font-size:1.1rem; color:#616161;">
          No hay usuarios registrados
        </span>
      </div>
    }

    @if (users().length > 0) {
      <table mat-table [dataSource]="users()" style="width:100%;">

        <!-- username -->
        <ng-container matColumnDef="username">
          <th mat-header-cell *matHeaderCellDef>Usuario</th>
          <td mat-cell *matCellDef="let user">{{ user.username }}</td>
        </ng-container>

        <!-- email -->
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let user">{{ user.email }}</td>
        </ng-container>

        <!-- role -->
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>Rol</th>
          <td mat-cell *matCellDef="let user">
            <mat-chip
              [color]="user.role === 'ADMIN_DESIGNER' ? 'primary' : ''"
              [highlighted]="user.role === 'ADMIN_DESIGNER'">
              {{ user.role }}
            </mat-chip>
          </td>
        </ng-container>

        <!-- department -->
        <ng-container matColumnDef="department">
          <th mat-header-cell *matHeaderCellDef>Departamento</th>
          <td mat-cell *matCellDef="let user">
            @if (user.role === 'EMPLOYEE') {
              <mat-select
                [value]="user.departmentId ?? ''"
                [disabled]="assigning() === user.id"
                (selectionChange)="assignDepartment(user, $event.value)"
                style="min-width:200px;">
                <mat-option value="">Sin departamento</mat-option>
                @for (dept of departments(); track dept.id) {
                  <mat-option [value]="dept.id">{{ dept.name }}</mat-option>
                }
              </mat-select>
            } @else {
              <span style="color:var(--mat-sys-on-surface-variant); font-size:0.85rem;">
                N/A — Administrador
              </span>
            }
          </td>
        </ng-container>

        <!-- status -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Estado asignación</th>
          <td mat-cell *matCellDef="let user">
            @if (user.role === 'EMPLOYEE') {
              @if (user.departmentId) {
                <mat-chip color="primary" highlighted>
                  <mat-icon>check_circle</mat-icon>
                  {{ getDepartmentName(user.departmentId) }}
                </mat-chip>
              } @else {
                <mat-chip color="warn">
                  <mat-icon>warning</mat-icon>
                  Sin asignar
                </mat-chip>
              }
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    }
  `,
})
export class UsersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);

  private readonly API = environment.apiUrl;

  readonly users = signal<UserResponse[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(false);
  readonly assigning = signal<string | null>(null);

  readonly columns = ['username', 'email', 'role', 'department', 'status'];

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      users: this.http.get<UserResponse[]>(`${this.API}/users`),
      departments: this.http.get<Department[]>(`${this.API}/departments`),
    }).subscribe({
      next: ({ users, departments }) => {
        this.users.set(users);
        this.departments.set(departments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getDepartmentName(departmentId: string | null): string {
    if (!departmentId) return 'Sin departamento';
    const found = this.departments().find(d => d.id === departmentId);
    return found ? found.name : 'Desconocido';
  }

  assignDepartment(user: UserResponse, departmentId: string): void {
    if (departmentId === '') return;
    this.assigning.set(user.id);
    const body: AssignDepartmentRequest = { departmentId };
    this.http
      .patch<UserResponse>(`${this.API}/users/${user.id}/department`, body)
      .subscribe({
        next: response => {
          this.users.update(list => list.map(u => (u.id === user.id ? response : u)));
          this.assigning.set(null);
          this.snack.open('Departamento asignado correctamente', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.assigning.set(null);
          this.snack.open('Error al asignar departamento', 'Cerrar', { duration: 3000 });
        },
      });
  }
}
