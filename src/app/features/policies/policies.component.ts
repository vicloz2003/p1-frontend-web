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
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Políticas de Negocio</span>
      <span style="flex:1"></span>
      <button mat-flat-button (click)="goToDesigner()">
        <mat-icon>add</mat-icon>
        Nueva política
      </button>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }

    <mat-table [dataSource]="policies()" style="width:100%;">

      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef>Nombre</mat-header-cell>
        <mat-cell *matCellDef="let policy">{{ policy.name }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="status">
        <mat-header-cell *matHeaderCellDef>Estado</mat-header-cell>
        <mat-cell *matCellDef="let policy">
          <mat-chip-set>
            @if (policy.status === 'ACTIVE') {
              <mat-chip color="primary" highlighted>{{ policy.status }}</mat-chip>
            } @else if (policy.status === 'DEPRECATED') {
              <mat-chip color="warn">{{ policy.status }}</mat-chip>
            } @else {
              <mat-chip>{{ policy.status }}</mat-chip>
            }
          </mat-chip-set>
        </mat-cell>
      </ng-container>

      <ng-container matColumnDef="createdAt">
        <mat-header-cell *matHeaderCellDef>Creada</mat-header-cell>
        <mat-cell *matCellDef="let policy">{{ policy.createdAt | date:'dd/MM/yyyy' }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="updatedAt">
        <mat-header-cell *matHeaderCellDef>Actualizada</mat-header-cell>
        <mat-cell *matCellDef="let policy">{{ policy.updatedAt | date:'dd/MM/yyyy' }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="actions">
        <mat-header-cell *matHeaderCellDef>Acciones</mat-header-cell>
        <mat-cell *matCellDef="let policy">
          <button mat-icon-button
                  (click)="editPolicy(policy)"
                  matTooltip="Editar política">
            <mat-icon>edit</mat-icon>
          </button>

          @if (policy.status === 'DRAFT') {
            <button mat-icon-button
                    [disabled]="publishing() === policy.id"
                    (click)="publishPolicy(policy)"
                    matTooltip="Publicar política">
              <mat-icon>publish</mat-icon>
            </button>
          }

          @if (policy.status === 'DRAFT') {
            <button mat-icon-button color="warn"
                    (click)="deletePolicy(policy)"
                    [disabled]="deleting() === policy.id"
                    matTooltip="Eliminar política">
              <mat-icon>delete_outline</mat-icon>
            </button>
          }

          @if (policy.status === 'ACTIVE') {
            <button mat-icon-button
                    (click)="router.navigate(['/processes'], { queryParams: { policyId: policy.id } })"
                    matTooltip="Ver trámites">
              <mat-icon>visibility</mat-icon>
            </button>
          }
        </mat-cell>
      </ng-container>

      <mat-header-row *matHeaderRowDef="displayedColumns" />
      <mat-row *matRowDef="let row; columns: displayedColumns;" />
    </mat-table>

    @if (!loading() && policies().length === 0) {
      <div style="display:flex; flex-direction:column; align-items:center;
                  justify-content:center; gap:16px; margin-top:64px;">
        <mat-icon style="font-size:64px; width:64px; height:64px;
                         color: var(--mat-sys-on-surface-variant);">policy</mat-icon>
        <p style="color: var(--mat-sys-on-surface-variant); margin:0;">
          No hay políticas registradas
        </p>
        <button mat-flat-button color="primary" (click)="goToDesigner()">
          Crear primera política
        </button>
      </div>
    }
  `,
})
export class PoliciesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly policyService = inject(PolicyService);

  private readonly API = 'http://localhost:3000/api/v1';

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

