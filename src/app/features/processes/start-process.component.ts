import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BusinessPolicy } from '../../core/models/domain';
import { ProcessStatusResponse } from '../../core/models/responses';

interface StartProcessRequest {
  policyId: string;
  initialData: Record<string, never>;
}

@Component({
  selector: 'app-start-process',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <mat-toolbar>
      <span>Iniciar Trámite</span>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <div style="padding:24px; max-width:800px; margin:0 auto;">

      <p style="color:var(--mat-sys-on-surface-variant); margin-bottom:24px;">
        Selecciona una política activa para iniciar un nuevo trámite.
      </p>

      @for (policy of policies(); track policy.id) {
        <mat-card appearance="outlined" style="margin-bottom:16px;">
          <mat-card-header>
            <mat-card-title>{{ policy.name }}</mat-card-title>
            <mat-card-subtitle>
              {{ policy.description ?? 'Sin descripción' }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions align="end">
            <button mat-flat-button color="primary"
                    (click)="startProcess(policy)"
                    [disabled]="starting() === policy.id">
              @if (starting() === policy.id) {
                <mat-icon>hourglass_empty</mat-icon> Iniciando...
              } @else {
                <mat-icon>play_arrow</mat-icon> Iniciar trámite
              }
            </button>
          </mat-card-actions>
        </mat-card>
      }

      @if (!loading() && policies().length === 0) {
        <mat-card appearance="outlined">
          <mat-card-content style="text-align:center; padding:48px;">
            <mat-icon style="font-size:48px; width:48px; height:48px;
                             color:var(--mat-sys-on-surface-variant);">
              policy
            </mat-icon>
            <p style="color:var(--mat-sys-on-surface-variant); margin-top:16px;">
              No hay políticas activas disponibles.
              Contacta al administrador.
            </p>
          </mat-card-content>
        </mat-card>
      }

    </div>
  `,
})
export class StartProcessComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  private readonly API = 'http://localhost:3000/api/v1';

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly loading = signal(false);
  readonly starting = signal<string | null>(null);

  ngOnInit(): void {
  this.loading.set(true);
  this.http.get<BusinessPolicy[]>(`${this.API}/policies/active`)
    .subscribe({
      next: (data) => {
        this.policies.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
}

  startProcess(policy: BusinessPolicy): void {
    this.starting.set(policy.id);
    const body: StartProcessRequest = { policyId: policy.id, initialData: {} };
    this.http.post<ProcessStatusResponse>(`${this.API}/processes`, body).subscribe({
      next: () => {
        this.starting.set(null);
        this.snack.open('Trámite iniciado exitosamente', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.starting.set(null);
        this.snack.open('Error al iniciar el trámite', 'Cerrar', { duration: 3000 });
      },
    });
  }
}
