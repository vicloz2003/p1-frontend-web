import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { BusinessPolicy } from '../../core/models/domain';
import { ProcessStatusResponse, UserResponse } from '../../core/models/responses';

interface StartProcessRequest {
  policyId: string;
  initialData: Record<string, never>;
  clientId: string | null;
  confirmedDocumentIds: string[];
}

@Component({
  selector: 'app-start-process',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatChipsModule, MatDividerModule,
    MatFormFieldModule, MatInputModule, MatListModule,
    MatProgressBarModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <mat-toolbar>
      <mat-icon style="margin-right:8px;">add_circle</mat-icon>
      <span>Iniciar Trámite</span>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <div style="padding:24px; max-width:760px; margin:0 auto;">

      <!-- Client search -->
      <mat-card appearance="outlined" style="margin-bottom:24px;">
        <mat-card-header>
          <mat-icon mat-card-avatar>person_search</mat-icon>
          <mat-card-title>Asociar cliente</mat-card-title>
          <mat-card-subtitle>Opcional — busca por email</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content style="padding-top:16px;">

          <div style="display:flex; gap:8px; align-items:flex-start;">
            <mat-form-field appearance="outline" style="flex:1;" subscriptSizing="dynamic">
              <mat-label>Correo electrónico del cliente</mat-label>
              <mat-icon matPrefix>mail</mat-icon>
              <input matInput
                     [(ngModel)]="clientSearchText"
                     placeholder="cliente@ejemplo.com"
                     (keyup.enter)="searchClient()">
            </mat-form-field>
            <button mat-flat-button color="primary"
                    style="height:56px; margin-top:0;"
                    (click)="searchClient()"
                    [disabled]="clientSearchText.length < 3 || searching()">
              @if (searching()) { Buscando… } @else {
                <mat-icon>search</mat-icon> Buscar
              }
            </button>
            @if (selectedClient()) {
              <button mat-icon-button color="warn"
                      style="height:56px;"
                      matTooltip="Quitar cliente"
                      (click)="clearClient()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <!-- Search results -->
          @if (clientResults().length > 0) {
            <mat-list style="margin-top:4px;">
              @for (user of clientResults(); track user.id) {
                <mat-list-item (click)="selectClient(user)" style="cursor:pointer;">
                  <mat-icon matListItemIcon>person</mat-icon>
                  <span matListItemTitle>{{ user.username }}</span>
                  <span matListItemLine>{{ user.email }}</span>
                </mat-list-item>
              }
            </mat-list>
          }

          <!-- Selected client badge -->
          @if (selectedClient(); as client) {
            <div style="display:flex; align-items:center; gap:10px; margin-top:12px;
                        padding:10px 14px; border-radius:8px;
                        background:var(--mat-sys-primary-container);">
              <mat-icon color="primary">person_check</mat-icon>
              <div>
                <p style="margin:0; font-weight:600; font-size:0.9rem;">{{ client.username }}</p>
                <p style="margin:0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
                  {{ client.email }}
                </p>
              </div>
            </div>
          }

        </mat-card-content>
      </mat-card>

      <!-- Policy list -->
      <p style="font-size:0.85rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
                color:var(--mat-sys-on-surface-variant); margin:0 0 12px;">
        Políticas activas
      </p>

      @for (policy of policies(); track policy.id) {
        <mat-card appearance="outlined" style="margin-bottom:12px;">
          <mat-card-header>
            <mat-icon mat-card-avatar color="primary">description</mat-icon>
            <mat-card-title>{{ policy.name }}</mat-card-title>
            <mat-card-subtitle>
              {{ policy.description ?? 'Sin descripción' }}
            </mat-card-subtitle>
          </mat-card-header>

          @if ((policy.documentRequirements?.length ?? 0) > 0) {
            <mat-card-content style="padding-top:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-top:8px;
                          font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
                <mat-icon style="font-size:14px; width:14px; height:14px;">description</mat-icon>
                {{ policy.documentRequirements!.length }} requisito(s) de documentos —
                el cliente los carga desde la app móvil
              </div>
            </mat-card-content>
          }

          <mat-card-actions align="end">
            <button mat-flat-button color="primary"
                    (click)="startProcess(policy)"
                    [disabled]="starting() === policy.id">
              @if (starting() === policy.id) {
                <mat-icon>hourglass_empty</mat-icon> Iniciando…
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
                             color:var(--mat-sys-on-surface-variant);">policy</mat-icon>
            <p style="color:var(--mat-sys-on-surface-variant); margin-top:16px;">
              No hay políticas activas. Contacta al administrador.
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
  private readonly API = environment.apiUrl;

  readonly policies = signal<BusinessPolicy[]>([]);
  readonly loading = signal(false);
  readonly starting = signal<string | null>(null);
  readonly searching = signal(false);
  readonly clientResults = signal<UserResponse[]>([]);
  readonly selectedClient = signal<UserResponse | null>(null);

  clientSearchText = '';

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<BusinessPolicy[]>(`${this.API}/policies/active`).subscribe({
      next: data => { this.policies.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  searchClient(): void {
    if (this.clientSearchText.length < 3) return;
    this.searching.set(true);
    this.http
      .get<UserResponse[]>(`${this.API}/users/search`, {
        params: { email: this.clientSearchText },
      })
      .subscribe({
        next: data => {
          this.clientResults.set(data.filter(u => u.role === 'CLIENT'));
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  selectClient(user: UserResponse): void {
    this.selectedClient.set(user);
    this.clientResults.set([]);
    this.clientSearchText = user.email;
  }

  clearClient(): void {
    this.selectedClient.set(null);
    this.clientResults.set([]);
    this.clientSearchText = '';
  }

  startProcess(policy: BusinessPolicy): void {
    this.starting.set(policy.id);
    const body: StartProcessRequest = {
      policyId: policy.id,
      initialData: {},
      clientId: this.selectedClient()?.id ?? null,
      confirmedDocumentIds: [],   // Documents are the client's responsibility (mobile app)
    };
    this.http.post<ProcessStatusResponse>(`${this.API}/processes`, body).subscribe({
      next: () => {
        this.starting.set(null);
        this.snack.open('Trámite iniciado correctamente', 'OK', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.starting.set(null);
        const detail = err?.error?.detail ?? 'Error al iniciar el trámite';
        this.snack.open(detail, 'OK', { duration: 4000 });
      },
    });
  }
}
