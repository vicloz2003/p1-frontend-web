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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ReactiveFormsModule } from '@angular/forms';
import { BusinessPolicy } from '../../core/models/domain';
import { ProcessStatusResponse, UserResponse } from '../../core/models/responses';

interface StartProcessRequest {
  policyId: string;
  initialData: Record<string, never>;
  clientId: string | null;
}

@Component({
  selector: 'app-start-process',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatSnackBarModule,
    ReactiveFormsModule,
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

      <mat-card appearance="outlined" style="margin-bottom:24px;">
        <mat-card-header>
          <mat-card-title style="font-size:1rem;">
            <mat-icon>person_search</mat-icon>
            Asociar cliente (opcional)
          </mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding-top:16px;">

          <p style="font-size:0.85rem;
                    color:var(--mat-sys-on-surface-variant);
                    margin:0 0 16px;">
            Busca al cliente por email para asociarlo al trámite.
            Si no se asocia, el trámite se iniciará sin cliente.
          </p>

          <div style="display:flex; gap:8px; align-items:center;">
            <mat-form-field appearance="outline"
                            style="flex:1;" subscriptSizing="dynamic">
              <mat-label>Buscar cliente por email</mat-label>
              <input matInput
                     [value]="clientSearch()"
                     (input)="clientSearch.set($any($event.target).value)"
                     placeholder="ejemplo@correo.com">
              @if (selectedClient()) {
                <mat-icon matSuffix color="primary">check_circle</mat-icon>
              }
            </mat-form-field>
            <button mat-flat-button color="primary"
                    (click)="searchClient()"
                    [disabled]="clientSearch().length < 3 || searching()">
              @if (searching()) {
                Buscando&hellip;
              } @else {
                <mat-icon>search</mat-icon> Buscar
              }
            </button>
            @if (selectedClient()) {
              <button mat-stroked-button color="warn"
                      (click)="clearClient()">
                <mat-icon>clear</mat-icon>
              </button>
            }
          </div>

          @if (clientResults().length > 0) {
            <mat-list style="margin-top:8px;">
              @for (user of clientResults(); track user.id) {
                <mat-list-item (click)="selectClient(user)"
                               style="cursor:pointer;">
                  <mat-icon matListItemIcon>person</mat-icon>
                  <span matListItemTitle>{{ user.username }}</span>
                  <span matListItemLine>{{ user.email }}</span>
                </mat-list-item>
              }
            </mat-list>
          }

          @if (selectedClient(); as client) {
            <div style="display:flex; align-items:center; gap:8px;
                        margin-top:12px; padding:8px;
                        background:var(--mat-sys-primary-container);
                        border-radius:8px;">
              <mat-icon color="primary">person_check</mat-icon>
              <span style="font-size:0.9rem;">
                Cliente seleccionado:
                <strong>{{ client.username }}</strong>
                &mdash; {{ client.email }}
              </span>
            </div>
          }

        </mat-card-content>
      </mat-card>

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

  readonly clientSearch = signal('');
  readonly clientResults = signal<UserResponse[]>([]);
  readonly selectedClient = signal<UserResponse | null>(null);
  readonly searching = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<BusinessPolicy[]>(`${this.API}/policies/active`)
      .subscribe({
        next: (data) => {
          this.policies.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  searchClient(): void {
    if (this.clientSearch().length < 3) return;
    this.searching.set(true);
    this.http
      .get<UserResponse[]>(`${this.API}/users/search`, {
        params: { email: this.clientSearch() },
      })
      .subscribe({
        next: (data) => {
          this.clientResults.set(data.filter((u) => u.role === 'CLIENT'));
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  selectClient(user: UserResponse): void {
    this.selectedClient.set(user);
    this.clientResults.set([]);
    this.clientSearch.set(user.email);
  }

  clearClient(): void {
    this.selectedClient.set(null);
    this.clientSearch.set('');
    this.clientResults.set([]);
  }

  startProcess(policy: BusinessPolicy): void {
    this.starting.set(policy.id);
    const body: StartProcessRequest = {
      policyId: policy.id,
      initialData: {},
      clientId: this.selectedClient()?.id ?? null,
    };
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
