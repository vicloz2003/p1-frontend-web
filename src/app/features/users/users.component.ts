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
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Department } from '../../core/models/domain';
import { UserResponse } from '../../core/models/responses';

interface AssignDepartmentRequest {
  departmentId: string;
}

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatSnackBarModule,
    MatSelectModule,
  ],
  template: `
    <!-- ── Page header ── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestión de Usuarios</h1>
        <p class="page-subtitle">
          {{ users().length }} usuario{{ users().length !== 1 ? 's' : '' }} registrado{{ users().length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button class="btn-icon" (click)="ngOnInit()" title="Actualizar lista">
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    <!-- ── Loading bar ── -->
    @if (loading()) {
      <div style="height:3px; overflow:hidden; background:#eff6ff;">
        <div class="loading-bar" style="height:100%;"></div>
      </div>
    }

    <div class="page-body">
      @if (!loading() && users().length === 0) {
        <div class="card">
          <div class="empty-state">
            <mat-icon>group</mat-icon>
            <p>No hay usuarios registrados</p>
          </div>
        </div>
      } @else {
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Departamento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td>
                    <span style="font-weight:600; color:#0f172a;">{{ user.username }}</span>
                  </td>
                  <td style="color:#64748b; font-size:0.84rem;">{{ user.email }}</td>
                  <td>
                    @if (user.role === 'ADMIN_DESIGNER') {
                      <span class="badge badge-dl">Admin</span>
                    } @else if (user.role === 'CLIENT') {
                      <span class="badge badge-active">Client</span>
                    } @else {
                      <span class="badge badge-draft">{{ user.role }}</span>
                    }
                  </td>
                  <td>
                    @if (user.role === 'EMPLOYEE') {
                      <div class="select-wrapper">
                        <mat-select
                          [value]="user.departmentId ?? ''"
                          [disabled]="assigning() === user.id"
                          (selectionChange)="assignDepartment(user, $event.value)">
                          <mat-option value="">Sin departamento</mat-option>
                          @for (dept of departments(); track dept.id) {
                            <mat-option [value]="dept.id">{{ dept.name }}</mat-option>
                          }
                        </mat-select>
                      </div>
                    } @else {
                      <span style="color:#94a3b8; font-size:0.84rem;">—</span>
                    }
                  </td>
                  <td>
                    @if (user.role === 'EMPLOYEE') {
                      @if (user.departmentId) {
                        <span class="badge badge-active">
                          {{ getDepartmentName(user.departmentId) }}
                        </span>
                      } @else {
                        <span class="badge badge-warning">Sin asignar</span>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
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
