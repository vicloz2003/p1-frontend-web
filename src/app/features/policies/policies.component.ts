import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BusinessPolicy } from '../../core/models/domain';
import { PolicyService } from '../../core/services/policy.service';

@Component({
  selector: 'app-policies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <!-- ── Page header ── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Políticas de Negocio</h1>
        <p class="page-subtitle">{{ policies().length }} política{{ policies().length !== 1 ? 's' : '' }} registrada{{ policies().length !== 1 ? 's' : '' }}</p>
      </div>
      <button class="btn btn-primary" (click)="goToDesigner()">
        <mat-icon>add</mat-icon>
        Nueva política
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
        @if (!loading() && policies().length === 0) {
          <div class="empty-state">
            <mat-icon>policy</mat-icon>
            <p>No hay políticas registradas todavía</p>
            <button class="btn btn-primary" (click)="goToDesigner()">
              <mat-icon>add</mat-icon>
              Crear primera política
            </button>
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Creada</th>
                <th>Actualizada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (policy of policies(); track policy.id) {
                <tr>
                  <td>
                    <span style="font-weight:600; color:#0f172a;">{{ policy.name }}</span>
                  </td>
                  <td>
                    @if (policy.status === 'ACTIVE') {
                      <span class="badge badge-active">{{ policy.status }}</span>
                    } @else if (policy.status === 'DEPRECATED') {
                      <span class="badge badge-deprecated">{{ policy.status }}</span>
                    } @else {
                      <span class="badge badge-draft">{{ policy.status }}</span>
                    }
                  </td>
                  <td style="color:#64748b;">{{ policy.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td style="color:#64748b;">{{ policy.updatedAt | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <div style="display:flex; gap:4px; align-items:center;">
                      <button class="btn-icon" (click)="editPolicy(policy)"
                              matTooltip="Editar política">
                        <mat-icon>edit</mat-icon>
                      </button>

                      @if (policy.status === 'ACTIVE') {
                        <button class="btn-icon"
                                (click)="router.navigate(['/processes'], { queryParams: { policyId: policy.id } })"
                                matTooltip="Ver trámites">
                          <mat-icon>visibility</mat-icon>
                        </button>
                      }

                      @if (policy.status === 'DRAFT') {
                        <button class="btn-icon"
                                [disabled]="publishing() === policy.id"
                                (click)="publishPolicy(policy)"
                                matTooltip="Publicar política">
                          <mat-icon>publish</mat-icon>
                        </button>
                        <button class="btn-icon btn-icon-danger"
                                (click)="deletePolicy(policy)"
                                [disabled]="deleting() === policy.id"
                                matTooltip="Eliminar política">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      }
                    </div>
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
export class PoliciesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly policyService = inject(PolicyService);

  private readonly API = environment.apiUrl;

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly loading = signal(false);
  readonly publishing = signal<string | null>(null);
  readonly deleting = signal<string | null>(null);
  readonly displayedColumns = ['name', 'status', 'createdAt', 'updatedAt', 'actions'];

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.loading.set(true);
    this.http.get<BusinessPolicy[]>(`${this.API}/policies`).subscribe({
      next: data => {
        this.policies.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToDesigner(): void {
    this.router.navigate(['/designer']);
  }

  editPolicy(policy: BusinessPolicy): void {
    this.router.navigate(['/designer', policy.id]);
  }

  publishPolicy(policy: BusinessPolicy): void {
    this.publishing.set(policy.id);
    this.http.post<BusinessPolicy>(`${this.API}/policies/${policy.id}/publish`, {}).subscribe({
      next: response => {
        this.policies.update(list =>
          list.map(p => (p.id === policy.id ? response : p))
        );
        this.publishing.set(null);
        this.snack.open('Política publicada exitosamente', 'OK', { duration: 3000 });
      },
      error: () => {
        this.publishing.set(null);
        this.snack.open('Error al publicar la política', 'OK', { duration: 4000 });
      },
    });
  }

  deletePolicy(policy: BusinessPolicy): void {
    if (!confirm(`¿Eliminar la política "${policy.name}"? Esta acción no se puede deshacer.`)) return;
    this.deleting.set(policy.id);
    this.policyService.deletePolicy(policy.id).subscribe({
      next: () => {
        this.policies.update(list => list.filter(p => p.id !== policy.id));
        this.deleting.set(null);
        this.snack.open('Política eliminada', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.deleting.set(null);
        this.snack.open(
          err.error?.message ?? 'No se puede eliminar — tiene trámites activos',
          'OK', { duration: 4000 });
      },
    });
  }
}

